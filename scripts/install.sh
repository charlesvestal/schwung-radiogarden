#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$REPO_ROOT/dist/radiogarden-module.tar.gz" ]; then
  "$REPO_ROOT/scripts/build.sh"
fi

scp -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new \
  "$REPO_ROOT/dist/radiogarden-module.tar.gz" \
  ableton@move.local:/data/UserData/schwung/

ssh -o ConnectTimeout=8 ableton@move.local '
  set -e
  cd /data/UserData/schwung
  mkdir -p modules/sound_generators
  # 0.3.0 dropped the full-screen UI for a browser page; extraction does not
  # delete, and a leftover ui_chain.js is still found by the host.
  rm -f modules/sound_generators/radiogarden/ui.js modules/sound_generators/radiogarden/ui_chain.js
  tar -xzf radiogarden-module.tar.gz -C modules/sound_generators/
  rm -f radiogarden-module.tar.gz
  echo "Installed to /data/UserData/schwung/modules/sound_generators/radiogarden"
'
