# Radio Garden for Move Everything

Browse and stream live radio stations from around the world on Ableton Move, powered by [Radio Garden](https://radio.garden).

## Features

- **200 cities** across 6 continents, organized by continent and country
- Live radio streaming via ffmpeg
- Play/pause and stop controls via knobs
- Works standalone or in Signal Chain

## Usage

1. Navigate: **Continent → Country → City**
2. Wait for stations to load from Radio Garden
3. Select a station to start streaming
4. **Knob 1**: Play/Pause | **Knob 7**: Stop

## Building

```bash
# Download ffmpeg for ARM64 (first time only)
./scripts/build-deps.sh

# Build module (cross-compiles via Docker)
./scripts/build.sh
```

## Installing

```bash
./scripts/install.sh
```

Or install via the **Module Store** on your Move.

## Requirements

- Move Everything host v0.3.0+
- Internet connection on Move (for API calls and radio streams)

## How It Works

1. City selection triggers a search via the Radio Garden API to find the place
2. Station list is fetched for that place
3. Audio is streamed through the bundled ffmpeg, decoded to PCM, and played through the DSP ring buffer

## License

MIT

## AI Assistance Disclaimer

This module is part of Move Everything and was developed with AI assistance, including Claude, Codex, and other AI assistants.

All architecture, implementation, and release decisions are reviewed by human maintainers.  
AI-assisted content may still contain errors, so please validate functionality, security, and license compatibility before production use.
