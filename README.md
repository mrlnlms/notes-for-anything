# Binary Notes

Promote binary files (PDF, image, audio, video) to first-class citizens in your Obsidian vault.

Right-click any supported binary → **Add Binary Notes**. The plugin creates a sidecar `.md` companion with frontmatter `binary: <path>`. From then on, clicking the binary in the file explorer opens a unified custom view with the binary embedded above and the companion's markdown below. Use the header's "Toggle source view" to drop into the native viewer (or PDF++ etc).

## Supported types

PDF, PNG/JPG/GIF/SVG/WEBP, MP3/M4A/WAV/OGG/FLAC, MP4/WEBM/MOV/MKV.

EPUB is intentionally out of scope (delegated to the ePub Reader plugin).

## How companions work

- A companion is just a `.md` file with `binary: <path>` in the frontmatter.
- Default location: alongside the binary (`paper.pdf` → `paper.pdf.md`).
- Companion can live anywhere in the vault — the frontmatter is the source of truth.
- One companion per binary, enforced on creation.
- Companions are hidden in the file explorer by default (toggle in settings).
  - Add `visible: true` in a companion's frontmatter to expose it individually.

## Installation

Via BRAT (until store release):
1. Install BRAT plugin
2. Add this repo URL
3. Enable "Binary Notes"

## Development

```bash
npm install        # install deps
npm run dev        # esbuild watch + hot-reload
npm test           # run vitest in watch mode
npm test -- --run  # single test pass (CI mode)
npm run build      # production build (generates main.js)
```

## Status

Personal-scale plugin built for the author's own workflow. See `docs/01-discovery-binary-companion.md` for design rationale and `docs/superpowers/specs/2026-04-27-binary-notes-design.md` for the technical spec.
