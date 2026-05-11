# How it works

Reference for the behavior and conventions of Notes for Anything. The [README](../README.md) covers the pitch and quick start — this doc covers the mechanics.

## What a companion is

A companion is a plain `.md` file with `binary: <path>` in its frontmatter:

```yaml
---
binary: "papers/2024-attention-is-all-you-need.pdf"
---
```

The frontmatter is the **source of truth**. The companion can live anywhere in the vault, named anything. The plugin tracks the link via `metadataCache`, not via filename conventions.

### Path quoting

The `binary:` value is always **double-quoted**. This preserves:
- Multiple consecutive whitespace (e.g., `(2008) International  Handbook.pdf`)
- YAML-significant characters (`:`, `#`, `&`, etc.)

If you edit the frontmatter manually, keep the quotes.

### Default location

When you run **Add companion note**, the file is created side-by-side with the binary, named `<basename>.<ext>.md`:

```
papers/
  attention-is-all-you-need.pdf
  attention-is-all-you-need.pdf.md   ← companion
```

This is just the default. You can move the companion anywhere later — as long as the `binary:` frontmatter points to a real file, the link works.

## One companion per binary

Strict rule. The **Add companion note** command refuses to create a second companion for a binary that already has one.

### Pathological case: two `.md` files pointing to the same binary

This can happen if you edit frontmatter manually or have a sync conflict. The plugin's behavior:

- **Last writer wins.** The `.md` whose `metadataCache` event fired most recently becomes the active companion.
- **No tie-break, no warning.** Deterministic by timing only.
- **Click on the binary** opens the active companion.
- **The losing `.md`** still exists in your vault as a regular note. It's not hidden, doesn't get the header action button, and doesn't appear in the explorer underline indicator.
- **Rename/delete cascade** only affects the active companion. The loser becomes an orphan (its `binary:` may now point to a renamed or deleted file). Cleanup is your responsibility.

## Navigation

Clicking or opening a binary that has a companion always lands you on the `.md` companion. Two layers handle this:

| Path | Layer | Mechanism |
|---|---|---|
| Click in file explorer | Click interceptor | DOM `click` listener in capture phase, prevents default before native viewer opens (no flash) |
| Drag/drop into workspace | View swapper | `active-leaf-change` listener swaps the binary view for the companion |
| Wikilink `[[paper.pdf]]` | View swapper | same |
| Quick switcher | View swapper | same |
| Command palette (Open file) | View swapper | same |
| Bookmark click | View swapper | same |
| Backlinks panel click | View swapper | same |
| Search panel click | View swapper | same |
| Embed `![[paper.pdf]]` inline | **Not intercepted** | Embeds don't change the active leaf, and inline preview of the binary is usually what you want |

## Header action buttons

The companion `.md` and the binary viewer both expose a header action button to toggle between them:

| Where you are | Button | Action |
|---|---|---|
| Inside the companion `.md` | **Open binary in viewer** | Same leaf swaps to the native viewer (PDF.js, image, audio, video, or PDF++ if installed) |
| Inside the binary viewer (companion exists) | **Open companion notes** | Same leaf swaps to the `.md` companion |

The button updates dynamically when you switch tabs to a different binary or companion — no need to close and reopen.

## Hide companions

Companions are hidden in the file explorer by default. Toggle in **Settings → Notes for Anything → Hide companions in file explorer**.

To expose a specific companion individually, add `visible: true` to its frontmatter:

```yaml
---
binary: "papers/important.pdf"
visible: true
---
```

That companion will show in the explorer even when the global hide is on.

## Underline indicator

Binaries that have a companion show a dotted underline in the file explorer. Visual cue that clicking will open the `.md` instead of the native viewer. The indicator updates reactively when companions are created or deleted.

## Rename and delete cascade

- **Rename binary**: the `binary:` field in the companion is updated automatically. Works across all rename paths — F2, context menu, drag to another folder.
- **Delete binary**: the companion is removed (silently, no prompt).
- **Rename or delete companion**: no cascade. The binary is untouched. If you delete the companion, the binary goes back to opening in its native viewer on click.

## Coexistence with PDF++

Notes for Anything intercepts the click on the binary in the file explorer; PDF++ handles rendering and annotation inside the PDF viewer.

- Click `paper.pdf` in explorer → companion `.md` opens (Notes for Anything wins via capture phase)
- Click **Open binary in viewer** in the companion header → PDF++ takes over (it's the registered default for `.pdf`)
- Click **Open companion notes** in the PDF++ header → back to the `.md`

Not covered by the intercept: if you invoke a PDF++-specific command (e.g., "PDF++: Open PDF in new tab"), the PDF++ flow takes over directly. This is intentional — you chose the PDF++ path explicitly.

## Supported file types

PDF, PNG/JPG/GIF/SVG/WEBP, MP3/M4A/WAV/OGG/FLAC, MP4/WEBM/MOV/MKV.

EPUB is out of scope (delegated to the [ePub Reader](https://github.com/caronchen/obsidian-epub-reader) plugin).
