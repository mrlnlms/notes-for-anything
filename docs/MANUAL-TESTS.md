# Manual Test Scenarios

Roda em vault real (Obsidian aberto, `npm run dev` ativo, plugin habilitado).

## Setup
1. Vault zerado (ou um vault de uso real onde o plugin foi instalado via BRAT)
2. Adicionar arquivos: `paper.pdf`, `img.png`, `song.mp3`, `clip.mp4`

## Cenários

### S1 — Criação de companion
- [ ] Right-click em `paper.pdf` → menu mostra "Add companion note"
- [ ] Click → companion `paper.pdf.md` é criado ao lado, frontmatter `binary: "paper.pdf"` (double-quoted)
- [ ] Companion abre como **MarkdownView nativa**: painel Properties (binary editável) + body vazio
- [ ] No painel Properties, "Add property" funciona (criar `tags`, `aliases`, custom keys etc)
- [ ] Editar body livremente — fica como markdown puro (sem template forçado)

### S2 — Click no binário com companion
- [ ] Click em `paper.pdf` no explorer → abre o `.md` companion (MarkdownView, mesma leaf)
- [ ] Painel Properties no topo, body editável, backlinks/tags/links funcionam normalmente

### S3 — Botão "Open binary in viewer" (header do companion)
- [ ] Dentro do `.md` companion, header tem ícone **"Open binary in viewer"** (image-file)
- [ ] Click → mesma leaf substitui pelo viewer nativo do binário (PDF.js, image viewer, ou PDF++ se instalado)
- [ ] PDF carrega sem erro `Transport destroyed` no console (race com ViewSwapper resolvida via `swapBypass`)

### S3.1 — Botão "Open companion notes" (header do binário viewer)
- [ ] Dentro do viewer do binário, header tem ícone **"Open companion notes"** (file-text)
- [ ] Click → volta pro `.md` companion na mesma leaf
- [ ] Trocar de binário/companion na mesma aba (ex.: clicar em outro binário no explorer) **atualiza o botão pra apontar pro novo target** — não precisa fechar/abrir aba

### S4 — Hide companion (Settings)
- [ ] Setting "Hide companions in file explorer" ON: `paper.pdf.md` invisível no explorer
- [ ] Toggle OFF: `paper.pdf.md` aparece
- [ ] Adicionar `visible: true` no frontmatter de `img.png.md` → aparece mesmo com hide ON

### S5 — Underline indicator
- [ ] `paper.pdf` no explorer mostra underline pontilhado (indicador de companion)
- [ ] Deletar `paper.pdf.md` → underline some

### S6 — Rename do binário
Testar via 3 caminhos diferentes:
- [ ] F2 no item do explorer
- [ ] "Rename file..." no menu de contexto
- [ ] Arrastando pra outra pasta (move)

Em cada caminho:
- [ ] Frontmatter `binary:` no companion atualiza pro novo path
- [ ] Click no binário renomeado continua abrindo o `.md` companion

### S7 — Delete do binário (cascade)
- [ ] Deletar `paper.pdf` → companion `paper.pdf.md` desaparece junto (silencioso)

### S8 — Múltiplos tipos
- [ ] Repetir S1-S3 pra `img.png`, `song.mp3`, `clip.mp4`
- [ ] Cada tipo abre o companion `.md` (MarkdownView), e o botão "Open binary in viewer" abre no viewer nativo correspondente (image, audio, video)

### S9 — Coexistência com PDF++
- [ ] Instalar PDF++
- [ ] Click em `paper.pdf` no explorer → companion `.md` abre (Notes for Anything ganha via capture phase)
- [ ] Botão "Open binary in viewer" → PDF++ assume (porque é o default registrado pra `.pdf`)
- [ ] Botão "Open companion notes" no header do PDF++ ainda funciona — volta pro `.md`
- [ ] **Caso não coberto pelo intercept:** se o usuário invoca um comando próprio do PDF++ (ex.: "PDF++: Open PDF in new tab"), o fluxo do PDF++ assume direto. Comportamento aceitável (usuário escolheu o caminho específico do PDF++)

### S10 — Hot-reload
- [ ] Com plugin ativo, editar `src/companion/companionHeaderActions.ts` → esbuild recompila → hot-reload re-executa o plugin
- [ ] Reabrir companion ou binário → **não há buttons duplicados** no header (WeakMap detach manual funcionando)

### S11 — Paths com whitespace múltiplo / chars especiais
- [ ] Adicionar binário com nome contendo 2+ espaços consecutivos (ex.: `(2008) International  Handbook.pdf`)
- [ ] "Add companion note" → companion criado com `binary: "..."` quoted preservando espaços
- [ ] Click no binário abre o `.md` companion sem erro "Binary not found"

### S12 — Caso patológico: múltiplos `.md` apontando pro mesmo binário
Regra: **um companion por binário**. Plugin previne via "Add companion note". Caso o user edite manualmente um `.md` random pra ter `binary: paper.pdf` enquanto já existe `paper.pdf.md`:
- [ ] Last writer wins — o `.md` cuja sincronização foi mais recente vira o ativo
- [ ] Sem warning ruidoso, sem tie-break — comportamento determinístico apenas pelo timing
- [ ] Click em `paper.pdf` abre o ativo. O `.md` "perdedor" continua existindo no vault como nota normal apontando pro mesmo binário, mas não é o que abre via click
- [ ] Rename/delete do binário só afeta o ativo. Companion não-ativo fica órfão (responsabilidade do user limpar)

## Cenários de cobertura de caminhos (S13-S16)

Objetivo: validar que a **camada 2 (ViewSwapper via `active-leaf-change`)** cobre todos os caminhos além do file explorer click. Esperado em todos: ViewSwapper detecta a leaf abrindo o binário e troca pelo `.md` companion. Se algum cenário abrir o PDF cru sem trocar, é bug.

### S13 — Quick switcher abre binário → ViewSwapper troca pelo `.md`
Setup: `paper.pdf` + `paper.pdf.md` existem.
- [ ] Cmd/Ctrl+O → digita `paper.pdf` → Enter
- [ ] Resultado esperado: **abre o companion `paper.pdf.md`** (MarkdownView), NÃO o PDF cru
- [ ] Se abrir o PDF e depois trocar pro `.md` com flash visível, anotar (é aceitável mas vale registrar)

### S14 — Bookmark do binário → ViewSwapper troca pelo `.md`
- [ ] Right-click em `paper.pdf` no explorer → **Bookmark** (cria bookmark)
- [ ] Abrir o Bookmarks panel (sidebar) → click no bookmark de `paper.pdf`
- [ ] Resultado esperado: abre o companion `paper.pdf.md`
- [ ] Anotar se houve flash do PDF antes de trocar

### S15 — Search panel: click em resultado leva ao wikilink → troca pelo `.md`
Setup:
1. Criar nota `links.md` com conteúdo `[[paper.pdf]]` e algum texto único, ex.: `linkin-park-pdf-ref`
- [ ] Cmd/Ctrl+Shift+F (Search panel) → busca por `linkin-park-pdf-ref`
- [ ] Click no resultado abre `links.md`
- [ ] No `links.md`, click no link `[[paper.pdf]]`
- [ ] Resultado esperado: abre o companion `paper.pdf.md` (não o PDF)

### S16 — Backlinks panel → ViewSwapper troca pelo `.md`
Setup: existe `references.md` com `[[paper.pdf]]` no body.
- [ ] Abrir `references.md`
- [ ] Abrir Backlinks panel (sidebar direita) — irrelevante pra esse teste
- [ ] No `references.md`, abrir **Outline / Links panel** ou usar **Cmd/Ctrl+click no `[[paper.pdf]]`** pra simular click de backlink panel
- [ ] Alternativa mais limpa: criar `nota-A.md` com `[[paper.pdf]]`, abrir `paper.pdf.md` (companion), na sidebar Backlinks panel aparece `nota-A.md` apontando pro PDF → click no backlink abre `nota-A.md`, depois click no link `[[paper.pdf]]` lá dentro
- [ ] Resultado esperado: companion abre via wikilink (camada 2)

**Observação sobre Backlinks panel**: o caminho mais comum é "ver lista de notas que referenciam o PDF". Esse aparece no Backlinks panel da **própria PDF view** ou do **companion `.md`**. Validar se o link nesse panel, quando clicado, leva à nota que referencia (esperado: sim, abre a nota normal).
