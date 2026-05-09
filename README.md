# Binary Notes

Promote binary files (PDF, image, audio, video) to first-class citizens in your Obsidian vault.

Right-click any supported binary → **Add Binary Notes**. The plugin creates a sidecar `.md` companion with frontmatter `binary: <path>`. From then on, clicking the binary in the file explorer opens the companion as a **native Obsidian MarkdownView** — Properties editor, body, backlinks, tags, all standard markdown features work as-is. A header action button toggles to the binary's native viewer (PDF.js, image viewer, etc) and back.

## Supported types

PDF, PNG/JPG/GIF/SVG/WEBP, MP3/M4A/WAV/OGG/FLAC, MP4/WEBM/MOV/MKV.

EPUB is intentionally out of scope (delegated to the ePub Reader plugin).

## How companions work

- A companion is just a `.md` file with `binary: <path>` in the frontmatter (path is double-quoted so paths with spaces or special YAML chars survive).
- Default location: alongside the binary (`paper.pdf` → `paper.pdf.md`).
- Companion can live anywhere in the vault — the frontmatter is the source of truth.
- One companion per binary, enforced by the **Add Binary Notes** command. If two `.md` files end up pointing to the same binary (manual edit, sync conflict), the last one written wins — the other becomes a regular note.
- Companions are hidden in the file explorer by default (toggle in settings).
  - Add `visible: true` in a companion's frontmatter to expose it individually.

## Navigation

| Where you are | Click does |
|---|---|
| Binary in explorer (with companion) | Opens the `.md` companion (MarkdownView with Properties + body) |
| Binary in explorer (no companion) | Native viewer (or whichever plugin handles it) |
| Inside a companion `.md` | Header button **Open binary in viewer** opens the binary in the same leaf |
| Inside a binary viewer (with companion) | Header button **Open companion notes** goes back to the `.md` |

Rename or delete cascades: rename the binary → `binary:` in the companion is updated; delete the binary → companion is removed.

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

Personal-scale plugin built for the author's own workflow.
