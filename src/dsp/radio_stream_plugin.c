/*
 * Radio Garden streaming DSP plugin for Move Anything.
 * Simplified from webstream's yt_stream_plugin.c — handles live radio
 * streams via ffmpeg pipe. No daemon, no search, no seeking.
 */
#include <ctype.h>
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#include "plugin_api_v1.h"

#define RING_SECONDS       30
#define RING_SAMPLES       (MOVE_SAMPLE_RATE * 2 * RING_SECONDS)
#define STREAM_URL_MAX     4096
#define DEBOUNCE_MS        220ULL
#define LOG_PATH           "/data/UserData/schwung/cache/radiogarden-runtime.log"

/* ffmpeg search paths (tried in order) */
#define FFMPEG_SYSTEM      "ffmpeg"

static const host_api_v1_t *g_host = NULL;

/* ── forward declarations ─────────────────────────────────────────── */

static void* stream_reap_thread_main(void *arg);

/* ── types ────────────────────────────────────────────────────────── */

typedef struct {
    FILE *pipe;
    pid_t pid;
} reap_job_t;

typedef struct {
    char module_dir[512];
    char stream_url[STREAM_URL_MAX];
    char station_name[256];
    char error_msg[256];

    FILE *pipe;
    int pipe_fd;
    pid_t stream_pid;
    bool stream_eof;
    volatile bool destroying;

    int16_t ring[RING_SAMPLES];
    size_t write_pos;
    uint64_t write_abs;
    uint64_t play_abs;
    uint64_t dropped_samples;
    uint64_t dropped_log_next;
    uint8_t pending_bytes[4];
    uint8_t pending_len;
    size_t prime_needed_samples;
    bool paused;

    float gain;
    int play_pause_step;
    int stop_step;
    uint64_t last_play_pause_ms;
    uint64_t last_stop_ms;
} radio_instance_t;

/* ── logging ──────────────────────────────────────────────────────── */

static void append_log(const char *msg) {
    FILE *fp;
    if (!msg || msg[0] == '\0') return;
    fp = fopen(LOG_PATH, "a");
    if (!fp) return;
    fprintf(fp, "%s\n", msg);
    fclose(fp);
}

static void rg_log(const char *msg) {
    append_log(msg);
    if (g_host && g_host->log) {
        char buf[384];
        snprintf(buf, sizeof(buf), "[rg] %s", msg);
        g_host->log(buf);
    }
}

/* ── utility ──────────────────────────────────────────────────────── */

static uint64_t now_ms(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (uint64_t)tv.tv_sec * 1000ULL + (uint64_t)tv.tv_usec / 1000ULL;
}

static void set_error(radio_instance_t *inst, const char *msg) {
    if (!inst) return;
    snprintf(inst->error_msg, sizeof(inst->error_msg), "%s", msg ? msg : "unknown error");
    rg_log(inst->error_msg);
}

static void clear_error(radio_instance_t *inst) {
    if (!inst) return;
    inst->error_msg[0] = '\0';
}

/* ── URL validation ───────────────────────────────────────────────── */

static bool is_allowed_url_char(unsigned char c) {
    if (isalnum(c)) return true;
    return c == ':' || c == '/' || c == '?' || c == '&' || c == '=' || c == '%' ||
           c == '.' || c == '_' || c == '-' || c == '+' || c == '#' || c == '~' ||
           c == ',';
}

static bool sanitize_url(const char *in, char *out, size_t out_len) {
    size_t i, j = 0;
    if (!in || !out || out_len == 0) return false;
    if (!(strncmp(in, "https://", 8) == 0 || strncmp(in, "http://", 7) == 0))
        return false;
    for (i = 0; in[i] != '\0'; i++) {
        unsigned char c = (unsigned char)in[i];
        if (!is_allowed_url_char(c)) return false;
        if (j + 1 >= out_len) return false;
        out[j++] = (char)c;
    }
    out[j] = '\0';
    return j > 0;
}

/* ── ring buffer ──────────────────────────────────────────────────── */

static uint64_t ring_oldest_abs(const radio_instance_t *inst) {
    if (!inst) return 0;
    if (inst->write_abs > (uint64_t)RING_SAMPLES)
        return inst->write_abs - (uint64_t)RING_SAMPLES;
    return 0;
}

static size_t ring_available(const radio_instance_t *inst) {
    uint64_t avail;
    if (!inst) return 0;
    if (inst->write_abs <= inst->play_abs) return 0;
    avail = inst->write_abs - inst->play_abs;
    if (avail > (uint64_t)RING_SAMPLES) avail = (uint64_t)RING_SAMPLES;
    return (size_t)avail;
}

static void ring_push(radio_instance_t *inst, const int16_t *samples, size_t n) {
    size_t i;
    uint64_t oldest;
    for (i = 0; i < n; i++) {
        inst->ring[inst->write_pos] = samples[i];
        inst->write_pos = (inst->write_pos + 1) % RING_SAMPLES;
        inst->write_abs++;
    }
    oldest = ring_oldest_abs(inst);
    if (inst->play_abs < oldest) {
        inst->dropped_samples += (oldest - inst->play_abs);
        inst->play_abs = oldest;
    }
}

static size_t ring_pop(radio_instance_t *inst, int16_t *out, size_t n) {
    size_t got, i;
    uint64_t abs_pos;
    if (!inst || !out || n == 0) return 0;
    got = ring_available(inst);
    if (got > n) got = n;
    abs_pos = inst->play_abs;
    for (i = 0; i < got; i++) {
        out[i] = inst->ring[(size_t)(abs_pos % (uint64_t)RING_SAMPLES)];
        abs_pos++;
    }
    inst->play_abs = abs_pos;
    return got;
}

static void clear_ring(radio_instance_t *inst) {
    if (!inst) return;
    inst->write_pos = 0;
    inst->write_abs = 0;
    inst->play_abs = 0;
    inst->dropped_samples = 0;
    inst->dropped_log_next = (uint64_t)MOVE_SAMPLE_RATE * 2ULL;
    inst->pending_len = 0;
    memset(inst->pending_bytes, 0, sizeof(inst->pending_bytes));
    inst->prime_needed_samples = 0;
}

/* ── stream process management ────────────────────────────────────── */

static void terminate_stream_process(pid_t pid) {
    int status;
    pid_t rc;
    if (pid <= 0) return;
    rc = waitpid(pid, &status, WNOHANG);
    if (rc == pid) return;
    (void)kill(-pid, SIGTERM);
    usleep(120000);
    rc = waitpid(pid, &status, WNOHANG);
    if (rc == 0) {
        (void)kill(-pid, SIGKILL);
        (void)waitpid(pid, &status, 0);
    }
}

static void schedule_stream_reap(FILE *pipe, pid_t pid) {
    pthread_t th;
    reap_job_t *job;

    if (!pipe && pid <= 0) return;

    job = malloc(sizeof(*job));
    if (!job) {
        if (pipe) fclose(pipe);
        if (pid > 0) terminate_stream_process(pid);
        return;
    }
    job->pipe = pipe;
    job->pid = pid;

    if (pthread_create(&th, NULL, stream_reap_thread_main, job) != 0) {
        if (pipe) fclose(pipe);
        if (pid > 0) terminate_stream_process(pid);
        free(job);
        return;
    }
    pthread_detach(th);
}

static void* stream_reap_thread_main(void *arg) {
    reap_job_t *job = (reap_job_t *)arg;
    FILE *pipe = NULL;
    pid_t pid = -1;
    if (job) {
        pipe = job->pipe;
        pid = job->pid;
        free(job);
    }
    if (pipe) fclose(pipe);
    if (pid > 0) terminate_stream_process(pid);
    return NULL;
}

static void stop_stream(radio_instance_t *inst) {
    FILE *pipe;
    pid_t pid;
    if (!inst || !inst->pipe) return;
    pipe = inst->pipe;
    pid = inst->stream_pid;
    inst->pipe = NULL;
    inst->pipe_fd = -1;
    inst->stream_pid = -1;
    schedule_stream_reap(pipe, pid);
}

/* Synchronous version for destroy — blocks until ffmpeg is dead */
static void stop_stream_sync(radio_instance_t *inst) {
    FILE *pipe;
    pid_t pid;
    if (!inst || !inst->pipe) return;
    pipe = inst->pipe;
    pid = inst->stream_pid;
    inst->pipe = NULL;
    inst->pipe_fd = -1;
    inst->stream_pid = -1;
    if (pipe) fclose(pipe);
    if (pid > 0) terminate_stream_process(pid);
}

/* ── ffmpeg spawning ──────────────────────────────────────────────── */

static int spawn_stream_command(radio_instance_t *inst, const char *cmd) {
    int pipefd[2];
    pid_t pid;
    FILE *fp;

    if (!inst || !cmd || cmd[0] == '\0') return -1;

    if (pipe(pipefd) != 0) {
        set_error(inst, "stream pipe failed");
        return -1;
    }

    pid = fork();
    if (pid < 0) {
        close(pipefd[0]);
        close(pipefd[1]);
        set_error(inst, "stream fork failed");
        return -1;
    }

    if (pid == 0) {
        (void)setpgid(0, 0);
        dup2(pipefd[1], STDOUT_FILENO);
        close(pipefd[0]);
        close(pipefd[1]);
        execl("/bin/sh", "sh", "-lc", cmd, (char *)NULL);
        _exit(127);
    }

    close(pipefd[1]);
    fp = fdopen(pipefd[0], "r");
    if (!fp) {
        close(pipefd[0]);
        terminate_stream_process(pid);
        set_error(inst, "stream fdopen failed");
        return -1;
    }

    inst->pipe = fp;
    inst->pipe_fd = fileno(fp);
    inst->stream_pid = pid;

    if (inst->pipe_fd < 0) {
        FILE *cp = inst->pipe;
        pid_t cpid = inst->stream_pid;
        inst->pipe = NULL;
        inst->pipe_fd = -1;
        inst->stream_pid = -1;
        schedule_stream_reap(cp, cpid);
        set_error(inst, "stream fileno failed");
        return -1;
    }

    if (fcntl(inst->pipe_fd, F_SETFL,
              fcntl(inst->pipe_fd, F_GETFL, 0) | O_NONBLOCK) < 0) {
        FILE *cp = inst->pipe;
        pid_t cpid = inst->stream_pid;
        inst->pipe = NULL;
        inst->pipe_fd = -1;
        inst->stream_pid = -1;
        schedule_stream_reap(cp, cpid);
        set_error(inst, "stream non-blocking failed");
        return -1;
    }

    return 0;
}

static int find_ffmpeg(const radio_instance_t *inst, char *out, size_t out_len) {
    char path[1024];

    /* 1. module_dir/bin/ffmpeg (bundled) */
    snprintf(path, sizeof(path), "%s/bin/ffmpeg", inst->module_dir);
    if (access(path, X_OK) == 0) {
        snprintf(out, out_len, "%s", path);
        return 0;
    }

    /* 2. system ffmpeg */
    if (access("/usr/bin/ffmpeg", X_OK) == 0) {
        snprintf(out, out_len, "/usr/bin/ffmpeg");
        return 0;
    }

    /* 3. PATH fallback */
    snprintf(out, out_len, "ffmpeg");
    return 0;
}

static int start_stream(radio_instance_t *inst) {
    char cmd[8192];
    char ffmpeg_path[1024];
    char clean_url[STREAM_URL_MAX];

    if (!inst || inst->stream_url[0] == '\0') return -1;

    if (!sanitize_url(inst->stream_url, clean_url, sizeof(clean_url))) {
        set_error(inst, "invalid stream URL");
        return -1;
    }

    stop_stream(inst);
    find_ffmpeg(inst, ffmpeg_path, sizeof(ffmpeg_path));

    snprintf(cmd, sizeof(cmd),
        "exec \"%s\" -hide_banner -loglevel error "
        "-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 "
        "-user_agent \"Mozilla/5.0\" "
        "-i \"%s\" -vn -sn -dn "
        "-af \"aresample=%d:async=1:min_hard_comp=0.100:first_pts=0\" "
        "-f s16le -ac 2 -ar %d pipe:1",
        ffmpeg_path, clean_url, MOVE_SAMPLE_RATE, MOVE_SAMPLE_RATE);

    if (spawn_stream_command(inst, cmd) != 0) {
        set_error(inst, "failed to launch ffmpeg pipeline");
        return -1;
    }

    clear_error(inst);
    inst->stream_eof = false;
    inst->prime_needed_samples = (size_t)MOVE_SAMPLE_RATE; /* ~0.5s stereo */
    rg_log("radio stream started");
    return 0;
}

/* ── stop everything ──────────────────────────────────────────────── */

static void stop_everything(radio_instance_t *inst) {
    if (!inst) return;
    inst->stream_url[0] = '\0';
    inst->station_name[0] = '\0';
    inst->stream_eof = false;
    inst->paused = false;
    stop_stream(inst);
    clear_ring(inst);
    clear_error(inst);
}

/* ── pump pipe ────────────────────────────────────────────────────── */

static void pump_pipe(radio_instance_t *inst) {
    uint8_t buf[4096];
    uint8_t merged[4100];
    int16_t samples[2048];

    while (inst->pipe && !inst->stream_eof) {
        if (ring_available(inst) + 2048 >= RING_SAMPLES)
            break;

        ssize_t n = read(inst->pipe_fd, buf, sizeof(buf));
        if (n > 0) {
            size_t merged_bytes = inst->pending_len;
            size_t aligned_bytes, remainder, sample_count;

            if (inst->pending_len > 0)
                memcpy(merged, inst->pending_bytes, inst->pending_len);

            memcpy(merged + merged_bytes, buf, (size_t)n);
            merged_bytes += (size_t)n;

            aligned_bytes = merged_bytes & ~((size_t)3U);
            remainder = merged_bytes - aligned_bytes;
            if (remainder > 0)
                memcpy(inst->pending_bytes, merged + aligned_bytes, remainder);
            inst->pending_len = (uint8_t)remainder;

            sample_count = aligned_bytes / sizeof(int16_t);
            if (sample_count > 0) {
                memcpy(samples, merged, sample_count * sizeof(int16_t));
                ring_push(inst, samples, sample_count);
            }
            if ((size_t)n < sizeof(buf))
                break;
            continue;
        }
        if (n == 0) {
            inst->stream_eof = true;
            set_error(inst, "stream ended");
            stop_stream(inst);
            break;
        }
        if (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR)
            break;
        inst->stream_eof = true;
        set_error(inst, "stream read error");
        stop_stream(inst);
        break;
    }
}

/* ── trigger/debounce helpers ─────────────────────────────────────── */

static bool parse_trigger_value(const char *val, int *step) {
    int prev;
    if (!val || !step) return false;
    if (strcmp(val, "trigger") == 0 || strcmp(val, "on") == 0) return true;
    if (strcmp(val, "idle") == 0 || strcmp(val, "off") == 0) return false;
    prev = *step;
    *step = atoi(val);
    return *step > prev;
}

static bool allow_trigger(uint64_t *last_ms) {
    uint64_t now;
    if (!last_ms) return true;
    now = now_ms();
    if (*last_ms != 0 && now > *last_ms && (now - *last_ms) < DEBOUNCE_MS)
        return false;
    *last_ms = now;
    return true;
}

/* ── plugin API v2 ────────────────────────────────────────────────── */

static void* v2_create_instance(const char *module_dir, const char *json_defaults) {
    radio_instance_t *inst = calloc(1, sizeof(*inst));
    if (!inst) return NULL;

    snprintf(inst->module_dir, sizeof(inst->module_dir), "%s",
             module_dir ? module_dir : ".");
    inst->gain = 1.0f;
    inst->pipe_fd = -1;
    inst->stream_pid = -1;

    (void)json_defaults;
    return inst;
}

static void v2_destroy_instance(void *instance) {
    radio_instance_t *inst = (radio_instance_t *)instance;
    if (!inst) return;
    /* Signal audio thread to stop touching this instance */
    inst->destroying = true;
    /* Synchronous cleanup — block until ffmpeg is fully dead */
    stop_stream_sync(inst);
    free(inst);
}

static void v2_on_midi(void *instance, const uint8_t *msg, int len, int source) {
    (void)instance; (void)msg; (void)len; (void)source;
}

static void v2_set_param(void *instance, const char *key, const char *val) {
    radio_instance_t *inst = (radio_instance_t *)instance;
    if (!inst || !key || !val) return;

    if (strcmp(key, "gain") == 0) {
        float g = (float)atof(val);
        if (g < 0.0f) g = 0.0f;
        if (g > 2.0f) g = 2.0f;
        inst->gain = g;
        return;
    }

    if (strcmp(key, "stream_url") == 0) {
        if (val[0] == '\0') {
            stop_everything(inst);
            return;
        }
        snprintf(inst->stream_url, sizeof(inst->stream_url), "%s", val);
        clear_ring(inst);
        clear_error(inst);
        inst->stream_eof = false;
        inst->paused = false;
        if (start_stream(inst) != 0) {
            inst->stream_eof = true;
        }
        return;
    }

    if (strcmp(key, "station_name") == 0) {
        snprintf(inst->station_name, sizeof(inst->station_name), "%s", val);
        return;
    }

    if (strcmp(key, "play_pause_toggle") == 0) {
        if (inst->stream_url[0] != '\0' && !inst->stream_eof)
            inst->paused = !inst->paused;
        return;
    }

    if (strcmp(key, "play_pause_step") == 0) {
        if (parse_trigger_value(val, &inst->play_pause_step) &&
            allow_trigger(&inst->last_play_pause_ms) &&
            inst->stream_url[0] != '\0' && !inst->stream_eof)
            inst->paused = !inst->paused;
        return;
    }

    if (strcmp(key, "stop") == 0) {
        stop_everything(inst);
        return;
    }

    if (strcmp(key, "stop_step") == 0) {
        if (parse_trigger_value(val, &inst->stop_step) &&
            allow_trigger(&inst->last_stop_ms))
            stop_everything(inst);
        return;
    }
}

static int v2_get_param(void *instance, const char *key, char *buf, int buf_len) {
    radio_instance_t *inst = (radio_instance_t *)instance;
    if (!key || !buf || buf_len <= 0) return -1;

    if (strcmp(key, "gain") == 0)
        return snprintf(buf, (size_t)buf_len, "%.2f", inst ? inst->gain : 1.0f);

    if (strcmp(key, "play_pause_step") == 0)
        return snprintf(buf, (size_t)buf_len, "idle");

    if (strcmp(key, "stop_step") == 0)
        return snprintf(buf, (size_t)buf_len, "idle");

    if (strcmp(key, "preset_name") == 0 || strcmp(key, "name") == 0)
        return snprintf(buf, (size_t)buf_len, "%s",
                        (inst && inst->station_name[0]) ? inst->station_name : "Radio Garden");

    if (strcmp(key, "stream_url") == 0)
        return snprintf(buf, (size_t)buf_len, "%s", inst ? inst->stream_url : "");

    if (strcmp(key, "station_name") == 0)
        return snprintf(buf, (size_t)buf_len, "%s", inst ? inst->station_name : "");

    if (strcmp(key, "stream_status") == 0) {
        if (!inst) return snprintf(buf, (size_t)buf_len, "stopped");
        if (inst->stream_url[0] == '\0') return snprintf(buf, (size_t)buf_len, "stopped");
        if (inst->paused) return snprintf(buf, (size_t)buf_len, "paused");
        if (!inst->pipe && !inst->stream_eof) return snprintf(buf, (size_t)buf_len, "loading");
        if (inst->stream_eof) return snprintf(buf, (size_t)buf_len, "eof");
        if (inst->prime_needed_samples > 0 &&
            ring_available(inst) < inst->prime_needed_samples)
            return snprintf(buf, (size_t)buf_len, "buffering");
        return snprintf(buf, (size_t)buf_len, "streaming");
    }

    return -1;
}

static int v2_get_error(void *instance, char *buf, int buf_len) {
    radio_instance_t *inst = (radio_instance_t *)instance;
    if (!inst || !inst->error_msg[0]) return 0;
    return snprintf(buf, (size_t)buf_len, "%s", inst->error_msg);
}

static void v2_render_block(void *instance, int16_t *out_interleaved_lr, int frames) {
    radio_instance_t *inst = (radio_instance_t *)instance;
    size_t needed, got, i;

    if (!out_interleaved_lr || frames <= 0) return;

    needed = (size_t)frames * 2;
    memset(out_interleaved_lr, 0, needed * sizeof(int16_t));

    if (!inst) return;
    if (inst->destroying) return;
    if (inst->stream_url[0] == '\0') return;
    if (inst->stream_eof) return;
    if (inst->paused) return;

    if (!inst->pipe) {
        /* no pipe yet, try starting stream */
        if (start_stream(inst) != 0) {
            inst->stream_eof = true;
        }
        return;
    }

    pump_pipe(inst);

    if (inst->prime_needed_samples > 0) {
        if (ring_available(inst) < inst->prime_needed_samples && !inst->stream_eof)
            return;
        inst->prime_needed_samples = 0;
    }

    got = ring_pop(inst, out_interleaved_lr, needed);

    if (inst->dropped_samples >= inst->dropped_log_next) {
        char log_msg[128];
        snprintf(log_msg, sizeof(log_msg),
                 "ring overflow dropped_samples=%llu",
                 (unsigned long long)inst->dropped_samples);
        rg_log(log_msg);
        inst->dropped_log_next += (uint64_t)MOVE_SAMPLE_RATE * 2ULL;
    }

    if (inst->gain != 1.0f) {
        for (i = 0; i < got; i++) {
            float s = out_interleaved_lr[i] * inst->gain;
            if (s > 32767.0f) s = 32767.0f;
            if (s < -32768.0f) s = -32768.0f;
            out_interleaved_lr[i] = (int16_t)s;
        }
    }
}

/* ── export ───────────────────────────────────────────────────────── */

static plugin_api_v2_t g_plugin_api_v2 = {
    .api_version = MOVE_PLUGIN_API_VERSION_2,
    .create_instance = v2_create_instance,
    .destroy_instance = v2_destroy_instance,
    .on_midi = v2_on_midi,
    .set_param = v2_set_param,
    .get_param = v2_get_param,
    .get_error = v2_get_error,
    .render_block = v2_render_block,
};

plugin_api_v2_t* move_plugin_init_v2(const host_api_v1_t *host) {
    g_host = host;
    rg_log("radiogarden plugin v2 initialized");
    return &g_plugin_api_v2;
}
