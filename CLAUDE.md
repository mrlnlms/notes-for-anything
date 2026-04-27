# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status atual

Plugin Obsidian **Binary Notes** funcional, primeira versão rodando. Plugin ID: `binary-notes`. Diretório do plugin: `obsidian-binary-props/` (legado do working title antigo). 61/61 testes passing, build clean.

## Tese em uma linha

> Binário (PDF, imagem, áudio, vídeo) abre como Folder Notes abre `.md` em pastas: opt-in por arquivo, sidecar `.md` companion conectado via frontmatter `binary: <path>`, click no binário abre o companion como **MarkdownView nativa** (Properties + body editáveis), botão de toggle bidirecional no header pra ir e voltar entre `.md` e binário cru.

## Arquitetura atual (refatorada — não é mais a do spec original)

A spec original (`docs/superpowers/specs/2026-04-27-binary-notes-design.md`) descrevia uma `ItemView` custom com embed + body. **Foi refatorado** pra largar a custom view e usar MarkdownView nativa do Obsidian — Properties editáveis vêm de graça.

### Componentes vivos

| Arquivo | Responsabilidade |
|---|---|
| `src/registry/companionRegistry.ts` | Map dual-source companion↔binário em memória, reativo a `metadataCache.changed`. **Regra: um companion por binário** (plugin previne na criação via commands.ts). Caso patológico de múltiplos `.md` apontando pro mesmo binário: last writer wins, sem tie-break. `writingInProgress` set anti-feedback-loop. Adaptado do `caseVariablesRegistry` do Qualia |
| `src/lifecycle/vaultLifecycleHandler.ts` | `vault.on('rename')` propaga novo path pro `binary:` no companion via `processFrontMatter`. `vault.on('delete')` cascateia binário→companion |
| `src/intercept/clickInterceptor.ts` | Capture phase click handler no explorer. Click no binário com companion → `leaf.openFile(companionFile)` (abre `.md` como MarkdownView) |
| `src/intercept/viewSwapper.ts` | Fallback pra abertura fora do explorer (drag/drop, comando externo, wikilink). Exporta `swapBypass: WeakSet<WorkspaceLeaf>` pra outros módulos sinalizarem "não swap esse leaf" — usado pelo header action button |
| `src/companion/companionHeaderActions.ts` | Adiciona action no header da view ativa: dentro do `.md` companion → "Open binary in viewer"; dentro do binário viewer (com companion) → "Open companion notes". Detecta tipo via path (não `instanceof View`). Cache `WeakMap<leaf, {el, targetPath}>` invalida quando target muda |
| `src/explorer/explorerDecorator.ts` | Underline em binários com companion + hide companions via body class. MutationObserver pra lazy render do explorer |
| `src/commands/commands.ts` | "Add Binary Notes" (cria companion idempotente + abre como MarkdownView). "Open binary in viewer" (palette equivalente do header action). Menu de contexto no `file-menu` |
| `src/settings/settingsTab.ts` + `src/settings/settings.ts` | Hide companions toggle + Companion template path |
| `src/main.ts` | Wiring de tudo |

### Componentes órfãos (refator deixou pra trás — não apagar sem confirmar)

- `src/view/binaryNotesView.ts` — a ItemView custom original (substituída por MarkdownView nativa)
- `src/view/headerActions.ts` — header actions da view custom (substituído pelo `companionHeaderActions.ts`)
- `BINARY_NOTES_VIEW_TYPE` em `src/constants.ts` — ainda registrado em `main.ts` pra evitar crash em workspace state restorado de versões antigas

## Decisões assentadas

- **Path no `binary:`**: absolute desde vault root, sempre **double-quoted** (`binary: "path/to/file.pdf"`) — preserva whitespace múltiplo e chars especiais YAML
- **Convenção de nome do companion side-by-side**: `<basename>.<ext>.md` (ex.: `paper.pdf.md`)
- **Cardinalidade**: **um companion por binário, regra estrita.** Plugin previne criação de segundo. Caso patológico (user editou manualmente): last writer wins, sem tie-break. O `.md` perdedor sai do índice (`getBinaryFor` retorna `null` pra ele) e vira nota normal — sem hide, sem header action. Não há lógica especial pra resolver isso, é responsabilidade do user limpar
- **Frontmatter é a fonte de verdade**: companion pode viver em qualquer lugar com qualquer nome. Fluxos de header action (`companionHeaderActions`) e lifecycle (`vaultLifecycleHandler`) consultam o registry, não o naming convention. `isCompanionPath()` só é usado pra descrever intenção em `commands.ts` (criação no padrão default)
- **Coexistência**: sempre intercepta. Source toggle delega ao viewer default registrado (PDF++ se instalado)
- **Companion abre como MarkdownView nativa** — Properties, body, backlinks, tags, tudo Obsidian-native
- **Body do companion não tem template embed automático** — user controla o body inteiro

## Comandos comuns

```bash
npm install        # primeira vez
npm run dev        # esbuild watch + copy pro demo/.obsidian/plugins/binary-notes/
npm run build      # production build (gera main.js)
npm test           # vitest watch mode
npm test -- --run  # single pass (CI mode) — 61 testes
npm run lint       # eslint flat config v9
```

Hot-reload via plugin pjeby `hot-reload` instalado no demo vault — recompilou? plugin recarrega automaticamente.

## Precedentes reaproveitados

- **Qualia Coding (próprio)** — `caseVariablesRegistry.ts` foi a base do `companionRegistry`. Patterns: `writingInProgress`, `onLayoutReady` deferred scan, `processFrontMatter`, `migrateFilePath`
- **Folder Notes (LostPaul)** — body class hide + CSS cascata, MutationObserver com retry, click intercept capture phase
- **Annotator (elias-sundqvist)** — pattern de YAML linking (`binary: <path>`)

## Gotchas aplicáveis (Qualia `docs/TECHNICAL-PATTERNS.md`)

- §8.6 — `active-leaf-change` em vez de `registerExtensions` (aplicado em `viewSwapper`)
- §8.8 — WeakSet pra evitar double-instrumentation (`viewSwapper.swapping` + exportado `swapBypass`)
- §19.5 — Detach manual de `view.addAction` (aplicado em `companionHeaderActions` via `WeakMap<leaf, ButtonState>`)
- §1.12 — MutationObserver self-suppression (não aplicável aqui — `ExplorerDecorator` só lê)
- §8.3 — `instanceof FileView` antes de operar em leaf — **aviso**: PDF/image views nem sempre extendem FileView no runtime real. `companionHeaderActions` detecta via `view.file` direto (não instanceof) por isso.

## Convenções operacionais

- **Commits**: sempre via `~/.claude/scripts/commit.sh "mensagem"`. Conventional commits em pt-br (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Sem emoji. Sem `Co-Authored-By` (o script bloqueia)
- **NÃO apagar arquivos** sem autorização literal e explícita do usuário (regra global). Mesmo arquivos órfãos do refator — pedir antes
- **Filosofia de coexistência**: Binary Notes é a camada de cidadania binária. Especialistas (PDF++, Media Notes, Excalidraw, ePub Reader) continuam fazendo a anotação fina. Não competir, integrar
- **Manual tests** (`docs/MANUAL-TESTS.md`): rodar em vault real após mudanças significativas — mocks vitest+jsdom não pegam bugs de runtime real (PDF.js, MarkdownView, etc)

## Tópicos abertos

- BinaryNotesView e headerActions órfãos: remover quando confirmado que ninguém precisa
- Embeds `![[arquivo.pdf]]` em outras notas: usam viewer nativo do Obsidian (não a custom view, que não existe mais)
- Backlinks panel: aparece nativo no MarkdownView do companion. Se quiser unificar com backlinks do binário cru, é design dedicado
- Coexistência específica com PDF++: bypass condicional via setting se demandar
