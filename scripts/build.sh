#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="move-anything-radiogarden-builder"

if [ -z "${CROSS_PREFIX:-}" ] && [ ! -f "/.dockerenv" ]; then
  echo "=== Radio Garden Module Build (via Docker) ==="
  if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
    docker build -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile" "$REPO_ROOT"
  fi
  docker run --rm \
    -v "$REPO_ROOT:/build" \
    -u "$(id -u):$(id -g)" \
    -w /build \
    "$IMAGE_NAME" \
    ./scripts/build.sh
  exit 0
fi

CROSS_PREFIX="${CROSS_PREFIX:-aarch64-linux-gnu-}"

cd "$REPO_ROOT"
rm -rf build/module dist/radiogarden
mkdir -p build/module dist/radiogarden

echo "Compiling v2 DSP plugin..."
"${CROSS_PREFIX}gcc" -O3 -g -shared -fPIC \
  src/dsp/radio_stream_plugin.c \
  -o build/module/dsp.so \
  -Isrc/dsp \
  -lpthread -lm

cat src/module.json > dist/radiogarden/module.json
[ -f src/help.json ] && cat src/help.json > dist/radiogarden/help.json
cat src/ui.js > dist/radiogarden/ui.js
cat src/ui_chain.js > dist/radiogarden/ui_chain.js
cat build/module/dsp.so > dist/radiogarden/dsp.so
chmod +x dist/radiogarden/dsp.so

# Bundle ffmpeg (required — run ./scripts/build-deps.sh first)
if [ -f "$REPO_ROOT/build/deps/bin/ffmpeg" ]; then
  echo "Bundling ffmpeg..."
  mkdir -p dist/radiogarden/bin
  cp "$REPO_ROOT/build/deps/bin/ffmpeg" dist/radiogarden/bin/ffmpeg
  chmod +x dist/radiogarden/bin/ffmpeg
  # Include FFmpeg GPL license for compliance
  FFMPEG_LICENSE="$REPO_ROOT/build/deps/work/ffmpeg-extract/ffmpeg-master-latest-linuxarm64-gpl/LICENSE.txt"
  if [ -f "$FFMPEG_LICENSE" ]; then
    cp "$FFMPEG_LICENSE" dist/radiogarden/FFMPEG_LICENSE.txt
  fi
else
  echo "WARNING: build/deps/bin/ffmpeg not found."
  echo "         Run ./scripts/build-deps.sh first to download ffmpeg."
  echo "         Module will fall back to system ffmpeg on device."
fi

# Create tarball for release
cd dist
tar -czvf radiogarden-module.tar.gz radiogarden/
cd ..

echo "=== Build Complete ==="
echo "Module dir: dist/radiogarden"
echo "Tarball: dist/radiogarden-module.tar.gz"
