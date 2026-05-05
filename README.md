# PeakPick 🏔️📸

**AI-powered photo selection tool** — automatically score, sort, and curate your photo library. Open source, offline-first, cross-platform.

## Features

- **Auto-scoring** — ML models rate your photos by aesthetic quality
- **Interactive UI** — Browse thumbnails grid, see scores, override ratings
- **Preference Learning** — Your corrections train the model (online learning)
- **Batch Operations** — Delete all photos below a threshold in one click
- **USB Auto-Import** — Plug in a camera/card, import instantly
- **Pluggable Backends** — CUDA GPU or CPU inference, swap models
- **Offline** — Everything runs locally, no cloud required

## Architecture

```
┌──────────────────────────────────────┐
│  Tauri Desktop Shell (Rust)          │
│  ┌────────────────────────────────┐  │
│  │  React + TypeScript Frontend  │  │
│  │  (Photo grid, ratings, UI)    │  │
│  └────────────┬───────────────────┘  │
│               │ IPC (invoke)         │
│  ┌────────────▼───────────────────┐  │
│  │  Rust Backend                  │  │
│  │  (File system, USB events,    │  │
│  │   ML process management)      │  │
│  └────────────┬───────────────────┘  │
└───────────────┼──────────────────────┘
                │ HTTP (localhost)
┌───────────────▼──────────────────────┐
│  Python ML Backend (FastAPI)         │
│  ┌──────────┬──────────┬──────────┐  │
│  │ Scoring  │ Online   │ SQLite   │  │
│  │ Models   │ Learning │ Storage  │  │
│  │ (CUDA/   │ (LoRA,   │ (Photos, │  │
│  │  CPU)    │  kNN)    │  Scores) │  │
│  └──────────┴──────────┴──────────┘  │
└──────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- **Rust** 1.70+ (install via [rustup](https://rustup.rs))
- **Node.js** 18+
- **Python** 3.10–3.12
- **System deps** (Linux): `webkit2gtk-4.1`, `libsoup-3.0`, `librsvg2`

### Development

```bash
# Frontend + Tauri dev mode
npm install
npm run tauri dev

# Python ML backend (separate terminal)
cd ml-backend
pip install -r requirements.txt
uvicorn peakpick_ml.server:app --reload --port 37421
```

### GPU Acceleration

```bash
cd ml-backend
pip install -e ".[cuda]"   # CUDA
pip install -e ".[cpu]"    # CPU-only
```

## Project Structure

```
PeakPick/
├── src/                  # React frontend (Vite)
├── src-tauri/            # Tauri Rust desktop shell
├── ml-backend/           # Python ML backend
│   ├── peakpick_ml/      # Scoring, learning, DB
│   ├── requirements.txt
│   └── pyproject.toml
├── README.md
└── LICENSE
```

## License

MIT
