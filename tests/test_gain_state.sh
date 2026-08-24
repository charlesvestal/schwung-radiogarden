#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
binary="${TMPDIR:-/tmp}/radiogarden-gain-state"
cc -std=c11 -Wall -Wextra -Werror "$repo_root/tests/test_gain_state.c" -lm -o "$binary"
"$binary"
