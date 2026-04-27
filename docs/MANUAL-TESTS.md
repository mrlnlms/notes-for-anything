# Manual Test Scenarios

Roda em vault real (Obsidian aberto, `npm run dev` ativo, plugin habilitado).

## Setup
1. Vault zerado no demo vault
2. Adicionar arquivos: `paper.pdf`, `img.png`, `song.mp3`, `clip.mp4`

## Cenários

### S1 — Criação de companion
- [ ] Right-click em `paper.pdf` → menu mostra "Add Binary Notes"
- [ ] Click → companion `paper.pdf.md` é criado ao lado
- [ ] Custom view abre com PDF embedado e body vazio
- [ ] Editar body do companion (via Quick Switcher abrindo `paper.pdf.md`) reflete na próxima abertura da view

### S2 — Click no binário com companion
- [ ] Click em `paper.pdf` no explorer → custom view abre direto, sem flicker
- [ ] PDF aparece embedado no topo
- [ ] Body do companion (se houver) aparece abaixo

### S3 — Toggle source view
- [ ] Header da custom view tem botão "Toggle source view"
- [ ] Click no botão → leaf substitui pra viewer nativo do PDF (ou PDF++ se instalado)
- [ ] Verificar que o viewer de PDF funciona normalmente
- [ ] **Caminho de volta:** após toggle source, clicar no binário no explorer deve reabrir a custom view do Binary Notes (via `ClickInterceptor`). Não há botão "voltar" dentro da source view — esse é o comportamento esperado nessa primeira versão.

### S4 — Hide companion
- [ ] Setting "Hide companions" ON: `paper.pdf.md` invisível no explorer
- [ ] Toggle OFF: `paper.pdf.md` aparece
- [ ] Adicionar `visible: true` no frontmatter de `img.png.md` → aparece mesmo com hide ON

### S5 — Underline
- [ ] `paper.pdf` no explorer mostra underline pontilhado (indicador de companion)
- [ ] Deletar `paper.pdf.md` → underline some

### S6 — Rename do binário
Testar via 3 caminhos diferentes (Obsidian dispara `vault.on('rename')` em todos, mas vale confirmar):
- [ ] Renomear via F2 no item do explorer
- [ ] Renomear via "Rename file..." no menu de contexto
- [ ] Renomear arrastando pra outra pasta (move)
Em cada caminho:
- [ ] Frontmatter `binary:` no companion atualiza pro novo path
- [ ] Click no binário renomeado continua abrindo a custom view com o body original

### S7 — Delete do binário (cascade)
- [ ] Deletar `paper.pdf` → companion `paper.pdf.md` desaparece junto

### S8 — Múltiplos tipos
- [ ] Repetir S1-S2 pra `img.png`, `song.mp3`, `clip.mp4`
- [ ] Cada tipo abre a custom view com viewer nativo correspondente

### S9 — Coexistência com PDF++
- [ ] Instalar PDF++ (se ainda não)
- [ ] Click em `paper.pdf` no explorer → custom view do Binary Notes abre (Binary Notes ganha via capture phase)
- [ ] Toggle source view → PDF++ assume (porque PDF++ é o default registrado)
- [ ] **Caso não coberto pelo intercept:** se o usuário invoca um comando próprio do PDF++ (ex.: "PDF++: Open PDF in new tab") pra abrir `paper.pdf`, o fluxo do PDF++ assume — Binary Notes NÃO captura. Esse é o comportamento esperado conforme spec §7 (usuário escolheu explicitamente o caminho do PDF++).

### S10 — Hot-reload
- [ ] Com plugin ativo e custom view aberta, editar `src/main.ts` → triggera hot-reload
- [ ] Reabrir custom view → não há buttons duplicados no header
