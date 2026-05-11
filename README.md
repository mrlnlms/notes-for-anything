# Notes for Anything

Pair any file (PDF, image, audio, video) with a sidecar markdown note in your Obsidian vault.

Right-click any supported file → **Add companion note**. The plugin creates a sidecar `.md` companion with frontmatter `binary: <path>`. From then on, clicking the file in the file explorer opens the companion as a **native Obsidian MarkdownView** — Properties editor, body, backlinks, tags, all standard markdown features work as-is. A header action button toggles to the file's native viewer (PDF.js, image viewer, etc) and back.

## Supported types

PDF, PNG/JPG/GIF/SVG/WEBP, MP3/M4A/WAV/OGG/FLAC, MP4/WEBM/MOV/MKV.

EPUB is intentionally out of scope (delegated to the ePub Reader plugin).

## How companions work

- A companion is just a `.md` file with `binary: <path>` in the frontmatter (path is double-quoted so paths with spaces or special YAML chars survive).
- Default location: alongside the file (`paper.pdf` → `paper.pdf.md`).
- Companion can live anywhere in the vault — the frontmatter is the source of truth.
- One companion per file, enforced by the **Add companion note** command. If two `.md` files end up pointing to the same file (manual edit, sync conflict), the last one written wins — the other becomes a regular note.
- Companions are hidden in the file explorer by default (toggle in settings).
  - Add `visible: true` in a companion's frontmatter to expose it individually.

## Navigation

| Where you are | Click does |
|---|---|
| File in explorer (with companion) | Opens the `.md` companion (MarkdownView with Properties + body) |
| File in explorer (no companion) | Native viewer (or whichever plugin handles it) |
| Inside a companion `.md` | Header button **Open binary in viewer** opens the file in the same leaf |
| Inside a file viewer (with companion) | Header button **Open companion notes** goes back to the `.md` |

Rename or delete cascades: rename the file → `binary:` in the companion is updated; delete the file → companion is removed.

## Installation

Via [BRAT](https://github.com/TfTHacker/obsidian42-brat) (until community plugin store release):

1. Install the BRAT plugin in your vault
2. BRAT → **Add Beta plugin** → `mrlnlms/notes-for-anything`
3. Enable **Notes for Anything** in Community plugins

## Development

```bash
npm install        # install deps
npm run dev        # esbuild watch
npm test           # run vitest in watch mode
npm test -- --run  # single test pass (CI mode)
npm run build      # production build (generates main.js)
```

## Status

Personal-scale plugin built for the author's own workflow. Feedback and issues welcome.
