# Notes for Anything

**Click a PDF and the companion note opens — with Properties, backlinks, and everything a native Obsidian note has.** Click the toggle in the header to go back to the PDF.

Works the same way for images, audio, and video. The file is the entry point; the note is one click away.

<!--
GIF placeholder.

Should show, in order:
  1. File explorer with `paper.pdf` underlined (companion indicator)
  2. Click on `paper.pdf` → `paper.pdf.md` opens as a MarkdownView with the
     Properties panel at the top (`binary: "paper.pdf"`) and an empty body
  3. User types a few words in the body, adds a property like `tags: [research]`
  4. Click the "Open binary in viewer" header action → same tab swaps to
     PDF.js showing the actual PDF
  5. Click "Open companion notes" in the PDF header → back to the markdown
-->

![Notes for Anything in action](docs/notes-for-anything-demo.gif)

## Why

Obsidian lets you embed a PDF inside a note, but the file itself is a dead-end: no frontmatter, no Properties, no backlinks. Existing sidecar plugins create a metadata file but leave you to find and open it manually.

Notes for Anything makes the **file** the entry point. Click it and you land on a native MarkdownView with full Properties editor, body, backlinks, tags, and embeds — same as any other note. A header action toggles back to the file's native viewer when you need to look at the file itself.

## UX: click → companion

| Where you click | What happens |
|---|---|
| File in explorer (with companion) | Opens the `.md` companion in the active tab |
| File in explorer (no companion) | Native viewer (or whichever plugin handles it) |
| Inside a companion `.md` | Header button **Open binary in viewer** swaps to the file |
| Inside a file viewer (with companion) | Header button **Open companion notes** goes back to the `.md` |

The interception covers all the ways you might open a file in Obsidian — explorer click, drag/drop, wikilink, quick switcher, command palette, bookmarks, backlinks panel, search panel. The toggle in the header is the only way to see the file's native viewer when a companion exists.

## Capability: just a markdown note

The companion is a plain `.md` file with `binary: <path>` in the frontmatter:

```yaml
---
binary: "papers/attention-is-all-you-need.pdf"
---

Notes start here. Standard markdown. Add Properties through the
Obsidian UI like you would in any other note.
```

Because it's standard markdown:
- **Properties editor** works out of the box — add `author`, `tags`, `year`, `status`, anything
- **Backlinks panel** shows which notes link to this companion
- **Tags, embeds, wikilinks, dataview queries** — all work
- **Companion can live anywhere** in the vault, named anything. The `binary:` frontmatter is the source of truth
- **If the plugin stops working**, your notes are still plain markdown. No proprietary format.

## Works with PDF++

[PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus) handles annotation, highlights, and rich navigation **inside** the PDF. Notes for Anything handles the companion note **alongside** the PDF. Use both:

- Click `paper.pdf` → companion `.md` opens (with Properties, summary, links to relevant sections)
- Click **Open binary in viewer** in the companion header → PDF++ takes over for highlighting and sidenotes
- Click **Open companion notes** in the PDF++ header → back to the `.md`

## Works with Obsidian Bases

Companions are regular `.md` files with frontmatter. Point a Base at the folder containing your companions and you get a filterable gallery of your annotated files — no extra configuration.

## Quick start

1. Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat) (see [Installation](#installation))
2. Right-click any supported file → **Add companion note**
3. The companion opens automatically. Add Properties, write notes
4. Click the file in the explorer anytime — the companion opens

## Supported types

PDF, PNG, JPG, GIF, SVG, WEBP, MP3, M4A, WAV, OGG, FLAC, MP4, WEBM, MOV, MKV.

EPUB is intentionally out of scope — delegated to the [ePub Reader](https://github.com/caronchen/obsidian-epub-reader) plugin.

## Installation

Until the community plugin store release:

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. BRAT → **Add Beta plugin** → `mrlnlms/notes-for-anything`
3. Enable **Notes for Anything** in Community plugins

## Reference

See [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) for the full behavior reference — cardinality rules, rename/delete cascade, hide/visible toggle, header actions, and coexistence details.

## Development

```bash
npm install        # install deps
npm run dev        # esbuild watch
npm test           # run vitest in watch mode
npm test -- --run  # single test pass (CI mode)
npm run build      # production build
```

## Status

Personal-scale plugin built for the author's workflow. Feedback and issues welcome.
