#ifndef SCHWUNG_GAIN_STATE_H
#define SCHWUNG_GAIN_STATE_H

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static inline int gain_state_encode(float gain, char *buf, int buf_len) {
    if (!buf || buf_len <= 0) return -1;
    int wrote = snprintf(buf, (size_t)buf_len, "{\"v\":1,\"gain\":%.6f}", gain);
    return wrote >= 0 && wrote < buf_len ? wrote : -1;
}

static inline int gain_state_decode(const char *json, float *gain) {
    const char *value;
    char *end;
    if (!json || !gain) return -1;
    value = strstr(json, "\"gain\":");
    if (!value) return -1;
    value += strlen("\"gain\":");
    *gain = strtof(value, &end);
    return end != value && isfinite(*gain) ? 0 : -1;
}

#endif
