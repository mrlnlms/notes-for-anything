# How it works

Reference for the behavior and conventions of Notes for Anything. The [README](../README.md) covers the pitch and quick start — this doc covers the mechanics.

## What a companion is

A companion is a plain `.md` file with `binary: <wikilink>` in its frontmatter:

```yaml
---
binary: "[[papers/2024-attention-is-all-you-need.pdf]]"
---
```

The frontmatter is the **source of truth**. The companion can live anywhere in the vault, named anything. The plugin tracks the link via `metadataCache`, not via filename conventions.

The wikilink format lets Obsidian's link graph index the companion→binary bridge: the binary's backlinks panel shows the companion, and Obsidian auto-updates the link on internal renames when **Auto-update internal links** is on. Shortname wikilinks (`[[paper.pdf]]`) are resolved via `getFirstLinkpathDest` — give a full path when the basename isn't unique in your vault.

### Path quoting

The `binary:` value is always **double-quoted**. This is required: without quotes, YAML interprets `[[...]]` as a nested flow array and the value gets parsed as garbage. The quotes also preserve:
- Multiple consecutive whitespace (e.g., `(2008) International  Handbook.pdf`)
- YAML-significant characters (`:`, `#`, `&`, etc.)

If you edit the frontmatter manually, keep both the quotes and the `[[...]]`.

### Legacy path-literal format

Companions created before the wikilink migration use a bare path string:

```yaml
---
binary: "papers/foo.pdf"
---
```

This format is still read correctly (back compat). Rename-binary updates preserve whichever format the companion currently uses. You can migrate manually by wrapping the path in `[[...]]`.

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

Every path that goes through the **view swapper** (everything except the explorer click) opens the native binary viewer first and swaps to the companion right after — there's a brief flash of the binary before the `.md` takes over. Only the file explorer click avoids this, because it intercepts in the capture phase before any viewer mounts.

## Header action buttons

The companion `.md` and the binary viewer both expose a header action button to toggle between them:

| Where you are | Button | Action |
|---|---|---|
| Inside the companion `.md` | **Open binary in viewer** | Same leaf swaps to the native viewer (PDF.js, image, audio, video, or PDF++ if installed) |
| Inside the binary viewer (companion exists) | **Open companion notes** | Same leaf swaps to the `.md` companion |

The button updates dynamically when you switch tabs to a different binary or companion — no need to close and reopen.

## Hide companions

Companions are hidden in the file explorer by default. Toggle in **Settings → Notes for Anything → Hide companions in file explorer**.

This setting also governs **whether the plugin intercepts navigation**:

- **Hide companions ON (default)** — companion `.md` files are hidden from the explorer, and clicking a binary opens the companion. All the navigation paths (table above) reroute to the companion.
- **Hide companions OFF** — companion `.md` files appear in the explorer next to binaries. Clicking a binary opens the binary directly (no intercept). The bridge to the companion is only the header action button ("Open companion notes" in the binary viewer).

The reasoning: if you've opted into seeing both files in the explorer, you've also opted into navigating them as plain files. The plugin doesn't get in the way.

To expose a specific companion individually while keeping the global hide on, add `visible: true` to its frontmatter:

```yaml
---
binary: "[[papers/important.pdf]]"
visible: true
---
```

That companion will show in the explorer even when the global hide is on. The `visible: true` override is independent of the intercept behavior — clicking the binary still routes to the companion as long as Hide companions is ON globally.

## Underline indicator

Binaries that have a companion show a dotted underline in the file explorer. Visual cue that clicking will open the `.md` instead of the native viewer. The indicator updates reactively when companions are created or deleted.

## Rename and delete cascade

- **Rename binary (inside Obsidian)**: the `binary:` field in the companion is updated automatically. Works across all internal rename paths — F2, context menu, drag to another folder.
- **Delete binary**: the companion is sent to the **Trash** (via `fileManager.trashFile`, which respects your Files & Links → Deleted files preference: system trash or local `.trash/`). Recoverable, not destroyed.
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

## Known limitations

### Backlinks: notes that link `[[paper.pdf]]` don't show up in the companion's panel

Obsidian indexes backlinks by the actual link target. A wikilink `[[paper.pdf]]` in some other note resolves to the **binary**, not to the companion `paper.pdf.md`, so:

- The binary's backlinks panel shows everyone who links the PDF — including the companion (because of the wikilink in `binary:`).
- The companion's backlinks panel **does not** show notes that link `[[paper.pdf]]`. It only sees notes that link the companion `.md` directly.
- "Unlinked mentions" in the companion's panel may pick up text matches, but linked backlinks won't appear.

If you want a backlink to count toward the companion, link it directly: `[[paper.pdf.md]]`. You lose the "open the binary" affordance through that wikilink, but the graph stays consistent.

### Brief flash on non-explorer open paths

See the note in [Navigation](#navigation). Quick switcher, bookmark click, search-result wikilink, backlinks panel click, etc., all show the binary viewer for a fraction of a second before the swap. Only file explorer click is flash-free.

### Rename via filesystem (Finder/Explorer) is treated as delete + create

When you rename a binary **outside** Obsidian (e.g., via Finder), Obsidian's vault watcher doesn't always identify it as a rename. For small/large files where its internal matching fails, the event surfaces as `delete(oldPath)` followed by `create(newPath)` — not as a `rename`.

The plugin cascades the delete to the companion, but **sends it to the Trash** (not permanent destruction) precisely to make this case recoverable:

- The renamed binary keeps its name and is now untracked (no companion).
- The original companion sits in the Trash. You can restore it manually and update its `binary:` to point to the new path.

If you need rename tracking from outside the app, prefer Obsidian's native rename (F2, drag, context menu) — those always go through `vault.on('rename')` and update the companion frontmatter automatically.
