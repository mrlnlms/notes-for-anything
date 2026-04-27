# Manual Test Scenarios

Roda em vault real (Obsidian aberto, `npm run dev` ativo, plugin habilitado).

## Setup
1. Vault zerado (ou o do dev — `obsidian-plugins-workbench`)
2. Adicionar arquivos: `paper.pdf`, `img.png`, `song.mp3`, `clip.mp4`

## Cenários

### S1 — Criação de companion
- [ ] Right-click em `paper.pdf` → menu mostra "Add Binary Notes"
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
- [ ] Click em `paper.pdf` no explorer → companion `.md` abre (Binary Notes ganha via capture phase)
- [ ] Botão "Open binary in viewer" → PDF++ assume (porque é o default registrado pra `.pdf`)
- [ ] Botão "Open companion notes" no header do PDF++ ainda funciona — volta pro `.md`
- [ ] **Caso não coberto pelo intercept:** se o usuário invoca um comando próprio do PDF++ (ex.: "PDF++: Open PDF in new tab"), o fluxo do PDF++ assume direto. Comportamento aceitável (usuário escolheu o caminho específico do PDF++)

### S10 — Hot-reload
- [ ] Com plugin ativo, editar `src/companion/companionHeaderActions.ts` → esbuild recompila → hot-reload re-executa o plugin
- [ ] Reabrir companion ou binário → **não há buttons duplicados** no header (WeakMap detach manual funcionando)

### S11 — Paths com whitespace múltiplo / chars especiais
- [ ] Adicionar binário com nome contendo 2+ espaços consecutivos (ex.: `(2008) International  Handbook.pdf`)
- [ ] "Add Binary Notes" → companion criado com `binary: "..."` quoted preservando espaços
- [ ] Click no binário abre o `.md` companion sem erro "Binary not found"

### S12 — Sync conflict / múltiplos companions defensivo
- [ ] Criar manualmente um segundo `.md` em outra pasta com `binary: "paper.pdf"` (apontando pro mesmo binário)
- [ ] Click em `paper.pdf` → registry escolhe silenciosamente o companion **ao lado do binário** (preferência alphabetical fallback se nenhum estiver ao lado)
- [ ] Sem warning ruidoso
