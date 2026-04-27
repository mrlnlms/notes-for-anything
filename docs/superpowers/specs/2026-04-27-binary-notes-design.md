# Binary Notes — Design Spec

**Data:** 2026-04-27
**Status:** validado, aguardando spec review
**Discovery base:** `docs/01-discovery-binary-companion.md`

---

## 1. Tese

Binário no vault (PDF, imagem, áudio, vídeo) ganha cidadania nativa de primeira classe via uma nota markdown companion. Click no binário abre uma custom view que renderiza o binário embedado + a nota, com toggle pro viewer source. Inspiração estrutural: Folder Notes (`.md` que abre como pasta).

---

## 2. Escopo

**Tipos cobertos:**
- PDF
- Imagem (png, jpg, jpeg, gif, svg, webp)
- Áudio (mp3, m4a, wav, ogg, flac)
- Vídeo (mp4, webm, mov, mkv)

Critério: tudo que o Obsidian renderiza nativamente via `![[arquivo]]`.

**Fora de escopo:**
- EPUB — depende do plugin ePub Reader, não tem viewer nativo. Pode ser adicionado em iteração futura via integração com ePub Reader.
- Tipos sem viewer nativo (zip, exe, etc) — não há o que embedar.

---

## 3. Modelo de dados

### Companion
- Arquivo `.md` regular do vault
- Frontmatter contém `binary: <absolute-path-from-vault-root>`
- Body é markdown livre (qualquer conteúdo do usuário)

### Convenção de nome (criação ao lado)
- Formato: `<basename>.<ext>.md`
- Exemplo: `paper.pdf` → `paper.pdf.md`
- Padrão Obsidian-native (Excalidraw usa `.excalidraw.md`, Markwhen usa `.mw.md`)
- Quando visível, ordena junto do binário no explorer

### Localização default
- Ao lado do binário, hardcoded
- Pode morar em qualquer lugar (frontmatter `binary:` é source of truth) — usuário move manualmente

### Cardinalidade
- **Um companion por binário.** Plugin garante isso na criação:
  - Comando "Add Binary Notes" em binário com companion existente abre o existente em vez de criar segundo
- Edge case (criação manual, sync conflict, dois `.md` apontando pro mesmo binário): plugin escolhe silenciosamente — prefere o que está ao lado do binário, depois ordem alfabética por path

### Path resolution
- `binary:` é absolute path desde a vault root
- Resolvido via `app.vault.getAbstractFileByPath(path)`
- Wikilink (`[[arquivo.pdf]]`) descartado: ambíguo se houver dois arquivos com mesmo basename
- Case-sensitivity: o vault do Obsidian é case-sensitive na interface, mas em sistemas case-insensitive (macOS APFS default, Windows NTFS) há ambiguidade real. Plugin usa o path como vem do `getAbstractFileByPath` (case do filesystem). Edge case raro mas existe em vaults sincronizados entre macOS/Linux

---

## 4. Fluxo de UX

1. Vault zerado, plugin instalado. Usuário insere `paper.pdf`. Click no PDF → viewer nativo do Obsidian (PDF.js) ou plugin especialista se ativo (PDF++).
2. Botão direito no `paper.pdf` no explorer → comando **"Add Binary Notes"** no menu de contexto.
3. Plugin cria `paper.pdf.md` ao lado, com frontmatter mínimo `binary: paper.pdf` (ou caminho completo se em subpasta) e body vazio (ou template configurado).
4. Plugin abre o novo companion na custom view.
5. A partir desse momento:
   - Click no `paper.pdf` no explorer → custom view do plugin (sempre).
   - `paper.pdf.md` fica invisível no explorer (default).
   - `paper.pdf` ganha underline no explorer (indicador "tem companion").
6. Custom view renderiza:
   - Embed do binário (`![[paper.pdf]]`) via `MarkdownRenderer.render` no topo
   - Body do companion abaixo, também via `MarkdownRenderer.render`
   - Header com botão **"Toggle source view"** + comando equivalente na palette
7. Click no toggle source → `setViewState` pro view type default registrado (PDF++ se instalado, viewer nativo Obsidian caso contrário).

---

## 5. Arquitetura

### Componentes principais

| Componente | Responsabilidade |
|---|---|
| `ClickInterceptor` | Caminho **primário** pra abertura via explorer. Capture-phase click handler global; `preventDefault()` + `stopImmediatePropagation()`; abre `BinaryNotesView` direto se binário tem companion |
| `ViewSwapper` | Caminho **fallback** pra outras vias de abertura (drag/drop, comando do Obsidian, click em wikilink em outra nota — `active-leaf-change` cobre esses). Reativo a `active-leaf-change`; faz `setViewState` pra `BinaryNotesView` se a leaf abriu um binário com companion. Tem flicker visível curto (Qualia §8.6) — aceito |
| `BinaryNotesView` | `ItemView` própria; renderiza embed + body + header com toggle. **Preview-only** nessa primeira versão — edit do body acontece abrindo o `.md` direto (Quick Switcher, ou click no companion via `visible: true` se exposto). Edit inline na custom view fica como tópico aberto pra iteração futura |
| `CompanionRegistry` | Adapta `caseVariablesRegistry` do Qualia. Mantém `Map<binaryPath, companionPath>` em memória. Listeners de vault e metadataCache mantêm o índice |
| `ExplorerDecorator` | Aplica classe `.has-binary-companion` em items do explorer cujo binário tem companion. Usa MutationObserver pra lazy render |
| `VaultLifecycleHandler` | Listeners de `create`, `rename`, `delete`. Cascade delete, rename propagation |
| `SettingsTab` | UI de settings (hide companions, companion template) |
| `Commands` | Registra comandos "Add Binary Notes", "Toggle source view" |

### Patterns reaproveitados

**De Qualia Coding (`src/core/`):**
- `fileInterceptor.ts` — pattern de `active-leaf-change` + `setViewState` pra swap de view
- `mediaToggleButton.ts` — pattern de `view.addAction` pra botão no header (com WeakMap pra detach manual no unload, evitando duplicação em hot-reload)
- `caseVariables/caseVariablesRegistry.ts` — pattern dual-source `.md`/binário com API uniforme. Especializa pra chave `binary:`. Herda: `writingInProgress` set anti-feedback-loop, initial scan deferido pra `onLayoutReady`, escrita via `fileManager.processFrontMatter`, `migrateFilePath` em rename

**De Folder Notes (LostPaul):**
- Body class toggle (`hide-binary-companion`) + CSS cascata (`.is-binary-companion { display: none }`) pra ocultar companions
- Classe CSS no item do explorer (`.has-binary-companion`) pra underline
- `registerDomEvent(document, 'click', handler, true)` em capture phase
- MutationObserver com retry 5x500ms pra esperar items do explorer renderizarem (lazy render)

**De Annotator (elias-sundqvist):**
- Pattern de YAML linking entre nota e binário (`annotation-target` lá, `binary` aqui)

### Gotchas catalogados aplicáveis (ver `qualia-coding/docs/TECHNICAL-PATTERNS.md`)
- §8.6: `active-leaf-change` em vez de `registerExtensions` (conflito em extensões nativas)
- §8.8: WeakSet pra evitar double-instrumentation
- §19.5: detach manual de `view.addAction` (Obsidian não limpa no unload — duplica em hot-reload)
- §1.12: MutationObserver self-suppression (overlay próprio dispara feedback loop)
- §8.3: verificar `instanceof FileView` antes de operar em leaf

---

## 6. Data flow

### Criação de companion
1. User invoca "Add Binary Notes" no menu de contexto do binário
2. `Commands` consulta `CompanionRegistry.getCompanionFor(binaryPath)`
3. Se já existe → abre o companion existente na custom view
4. Se não existe:
   a. Resolve path do companion: `<binaryPath>.md` (ou caminho do template)
   b. Cria arquivo via `app.vault.create(path, content)` com frontmatter `binary: <path>`
   c. `metadataCache.on('changed')` dispara → `CompanionRegistry.syncFromFrontmatter` atualiza índice
   d. `ExplorerDecorator` reage e adiciona underline no binário
   e. Plugin abre o companion na `BinaryNotesView`

### Click em binário com companion
1. `ClickInterceptor` captura o click no item do explorer (capture phase, antes de qualquer handler nativo do Obsidian)
2. Verifica via registry: binário tem companion?
3. Se sim: `preventDefault()` + `stopImmediatePropagation()`, depois abre nova leaf com `BinaryNotesView` carregando o companion (sem flicker — viewer nativo nem chega a ser invocado)
4. Se não: deixa o click seguir (viewer nativo ou plugin especialista assume)
5. Se o binário foi aberto por outra via (drag, comando do Obsidian, wikilink): `ViewSwapper` reage via `active-leaf-change`, faz `setViewState` (com flicker breve aceito — Qualia §8.6). Click intercept é primário e silencioso; `ViewSwapper` é safety net

### Rename do binário
1. `vault.on('rename')` dispara
2. `VaultLifecycleHandler` consulta registry: havia companion apontando pro path antigo?
3. Se sim: atualiza `binary:` no companion via `processFrontMatter`
4. `metadataCache.on('changed')` dispara → registry atualiza índice automaticamente

### Delete do binário
1. `vault.on('delete')` dispara
2. `VaultLifecycleHandler` consulta registry: havia companion?
3. Se sim: deleta companion via `app.vault.delete(companionFile)` (silencioso — usuário já confirmou no nativo)
4. Registry detecta via `vault.on('delete')` do companion e remove do índice

### Delete do companion
1. `vault.on('delete')` dispara
2. Registry remove entrada do índice
3. `ExplorerDecorator` re-renderiza, binário perde underline
4. Próximo click no binário vai pro viewer nativo / plugin especialista
5. Binário **não é tocado**

### Edit do `binary:` no companion
1. User edita o frontmatter manualmente (re-vincula companion pra outro binário)
2. `metadataCache.on('changed')` dispara → registry re-sincroniza
3. `ExplorerDecorator` atualiza underline (remove do antigo, adiciona no novo)
4. Se o novo destino do `binary:` já tinha companion: aplica regra de tie-break da §10 (prefere ao lado do binário, depois alfabético). Companion antigo do destino não é deletado — só perde a posição "ativa" no registry

---

## 7. Coexistência com outros plugins

- Binary Notes **sempre intercepta**. Não detecta plugins ativos.
- Source toggle usa `setViewState` pro view type default registrado:
  - PDF++ instalado → toggle abre PDF++ (ele já é o default registrado)
  - Sem plugin especialista → abre viewer nativo Obsidian (PDF.js, `<audio>`, etc)
- **Risco residual** aplica ao caminho `ViewSwapper` (via `active-leaf-change`): se outro plugin também usa `active-leaf-change` pra `setViewState`, há corrida — vence quem dispara por último (handlers em ordem de registro, sem `stopPropagation` disponível em event refs). O `ClickInterceptor` (caminho primário) não tem essa fragilidade — capture phase + `stopImmediatePropagation` garante que o handler de Binary Notes (registrado primeiro em `onload`) bloqueia outros.
- **Caso não coberto pelo intercept**: se PDF++ (ou outro plugin especialista) é usado pra abrir o binário via comando próprio dele (ex.: "PDF++: Open PDF in new tab"), Binary Notes não captura — fluxo nativo do PDF++ assume. Comportamento aceitável: usuário escolheu explicitamente o caminho do PDF++.

---

## 8. Settings

| Setting | Default | Descrição |
|---|---|---|
| `Hide companions in file explorer` | ON | Body class toggle. Aplica `.is-binary-companion { display: none }` |
| `Companion template` | (vazio) | Path opcional pra `.md` modelo. Conteúdo é copiado no body do companion na criação. Frontmatter `binary:` é prepended automaticamente |

---

## 9. Frontmatter contract per-companion

| Chave | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `binary` | string | Sim | Absolute path do binário desde vault root |
| `visible` | boolean | Não | Se `true`, sobrepõe o `Hide companions` global pra esse companion específico |

Outras chaves no frontmatter: livres. Não conflitam com Binary Notes (filter por chave específica). Permitem composição com outros plugins (Qualia Coding, Dataview, etc).

---

## 10. Error handling

| Cenário | Tratamento |
|---|---|
| `binary:` aponta pra path inexistente | Companion fica órfão. View renderiza body normal sem embed. Notice silencioso na view ("Binary not found: X"). Não bloqueia edit |
| Múltiplos companions pro mesmo binário (criação manual, sync) | Registry escolhe silenciosamente: prefere ao lado do binário, depois alfabético. Sem warning ruidoso |
| Companion sem frontmatter `binary:` | Não é considerado companion. Tratado como markdown comum |
| Binário com extensão fora do escopo | Plugin ignora completamente. Click vai pro comportamento default do Obsidian |
| Companion deletado durante view aberta | View detecta via `vault.on('delete')`, fecha leaf graciosamente |
| Path no `binary:` malformado (caracteres inválidos, etc) | View renderiza erro inline. Logs no console |

---

## 11. Testing

### Unit
- `CompanionRegistry`: setVariable, removeVariable, migrateFilePath, getCompanionFor, getBinaryFor
- Path resolution: absolute path normalization, edge cases
- Frontmatter parsing: chaves obrigatórias, opcionais, malformadas

### Integration
- Vault listeners: criação, rename, delete propagam corretamente pro índice
- `metadataCache.on('changed')` dispara `syncFromFrontmatter` sem feedback loop
- Hot-reload do plugin não duplica buttons no header (WeakMap detach)
- MutationObserver no explorer aplica underline em items renderizados lazy

### Manual / E2E
- Cenário completo de criação de companion via menu de contexto pra cada tipo (PDF, image, audio, video)
- Toggle source view abre o viewer correto (com e sem PDF++ instalado)
- Rename do binário propaga pro companion sem quebrar
- Delete do binário cascateia silenciosamente
- Hide companion ON/OFF afeta visualmente o explorer

Setup: usar `obsidian-test-setup` skill (vitest + jsdom + mocks de Obsidian).

---

## 12. Tópicos abertos pra calibrar via uso (fora deste spec)

- **Embeds `![[arquivo.pdf]]` em outras notas**: continuam mostrando viewer nativo (default Obsidian) ou mudam pra custom view? Decisão precisa de uso real pra calibrar.
- **Backlinks panel**: unificar backlinks pro binário com backlinks pro companion (alias semântico)? Pulo do gato potente, mas exige design dedicado.
- **Edit inline do body do companion na custom view**: hoje é preview-only. Permitir edit dentro da view (toggle edit/preview, ou `MarkdownView` estendida) é desejável mas adiciona complexidade. Decidir após uso real.
- **Comando "Find orphan companions"**: utility pra limpar companions cujo binário foi deletado fora do plugin. Adicionar se demandar.
- **Integração com Mirror Notes**: companion poderia usar template Mirror Notes pra view dinâmica baseada nas properties. Fora do escopo inicial.
- **Refator do Qualia Coding pra usar Binary Notes como infraestrutura base**: insight da §11.1 do discovery. Tarefa separada do Qualia, não desse plugin.

---

## 13. Estimativa de esforço

Ajustada com base nos refinamentos da sessão de brainstorm:

| Componente | LOC estimado |
|---|---|
| Scaffold + manifest + build | trivial (skill `obsidian-plugin-scaffold`) |
| `Commands` (Add Binary Notes, Toggle source view) | ~50 |
| `CompanionRegistry` (adapta Qualia) | ~60 |
| `ClickInterceptor` + `ViewSwapper` | ~100 |
| `BinaryNotesView` (custom view) | ~250 |
| `ExplorerDecorator` (hide + underline + MutationObserver) | ~80 |
| `VaultLifecycleHandler` (rename/delete cascade) | ~80 |
| `SettingsTab` | ~80 |
| Styles (CSS body class + cascata + underline) | ~30 |
| Testes unit + integration | ~250 |

**Total: ~1.000 LOC pro plugin funcional.**

Tempo: ~2-3 sessões focadas pra primeira versão funcional. Polimento pra release pública: ~2 semanas part-time.

---

## Apêndice — Decisões registradas da sessão de brainstorm (2026-04-27)

| ID | Decisão | Resolução |
|---|---|---|
| A | Nome do plugin | **Binary Notes** |
| F | Escopo de tipos | PDF, image, audio, video. EPUB fora |
| B1 | Convenção de nomenclatura | `<basename>.<ext>.md` |
| B2 | Localização default | Ao lado do binário, hardcoded |
| B3 | Formato do path no `binary:` | Absolute path desde vault root |
| C1 | Toggle source view | Botão no header + comando na palette |
| C2 | Bypass rápido pro binário cru | Não há. Toggle source no header é o único caminho |
| C3 | Vocabulário do comando | "Add Binary Notes" |
| C4 | Template inicial | Frontmatter mínimo + setting opcional pra template path |
| C5 | Override de visibilidade | Setting global + frontmatter `visible: true` per-companion |
| D1 | Delete do binário | Cascade silencioso. Reverse não cascateia |
| D2 | Rename do binário | Atualiza `binary:` no companion automaticamente |
| D3 | Múltiplos companions | Plugin previne na criação. Defensive fallback pra criação manual: prefere ao lado, depois alfabético |
| E1 | Coexistência com plugins de viewer | Sempre intercepta. Source toggle delega ao viewer default registrado |
