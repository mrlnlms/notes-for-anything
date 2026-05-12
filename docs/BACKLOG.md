# Backlog

Decisões pendentes, melhorias conhecidas e limpezas em fila pro plugin Notes for Anything. Próxima sessão começa aqui — olha o que tá em aberto, escolhe um item, ataca.

Itens **fechados** vão pro git history (não acumulam aqui). Itens **descartados** ficam com nota explicando por que.

---

## Decisões pendentes

Análise feita, esperando call do user. Implementação não foi iniciada.

### Cascade rename de filename

Quando user renomeia o binário, deveria renomear o companion `.md` junto se segue convenção `<binaryPath>.md`? E vice-versa (rename do `.md` → renomeia o binário)?

- **Hoje:** rename do binário atualiza só o frontmatter `binary:` no companion. Filename do `.md` não muda. Rename do `.md` atualiza só o índice interno. Filename do binário não muda. Sem cascade nas duas direções.
- **Análise completa:** `obsidian-plugins-workbench/notes-for-anything/2026-05-12-filename-cascade-decision.md` (pasta-irmã, não-versionada). Tabela de trade-offs por dimensão, edge cases (mudança de pasta, extensão não-suportada, event loop, caso patológico S12), mecânica de implementação (~15 linhas).
- **Recomendação cravada:** ambas heurísticas (A: rename binário → cascade `.md`; B: rename `.md` → cascade binário) com `isSupportedBinary` check na B. Cobre o caso comum (A diariamente, B raro mas filtrado pela heurística).
- **Custo:** ~15 linhas de código + 6 testes + ~5 linhas de doc no HOW-IT-WORKS.md.

---

## Melhorias conhecidas

Documentadas como limitações em `HOW-IT-WORKS.md > Known limitations`. Funcionam, mas tem caminho de melhoria.

### Flash breve no view swapper (camada 2)

Quick switcher, bookmark, search → wikilink, backlinks panel click — todos passam por `active-leaf-change`, que dispara DEPOIS do binário renderizar. Resultado: PDF aparece por uma fração de segundo antes do `.md` substituir.

- Hoje aceitável (documentado). Custo do usuário é estético, não funcional.
- Caminho de melhoria: interceptar antes do `active-leaf-change` via outro hook (provavelmente `file-open` ou observação direta do `WorkspaceLeaf.setViewState`). Investigação pendente pra mapear qual hook dispara antes do mount do viewer.
- Sem prioridade definida.

### Backlinks assimétricos no graph

`[[paper.pdf]]` em outras notas resolve pro **binário**, não pro companion `.md`. Companion não recebe esse backlink no painel próprio (vê só notas que linkam o `.md` direto). Com a migração pra wikilink no `binary:`, o **binário** ganha o companion como backlink, mas a direção inversa fica vazia.

- Workaround pro user: linkar `[[paper.pdf.md]]` direto quando quiser que o companion conte como target.
- Solução real: design dedicado de "virtual backlinks" — plugin escutaria backlinks do binário e exibiria também no painel do companion. Não trivial.
- Postergado por decisão do user ("o maior furo, vemos depois").

### Rename via filesystem (Finder/Explorer)

Obsidian não detecta rename externo como rename — vira `delete+create` no `vault.on`. Plugin cascateia o delete, e o companion vai pra Lixeira (recuperável via `fileManager.trashFile`). Binário renomeado fica órfão.

- Mitigação aplicada: `trashFile` no cascade (não destruição permanente). Companion sobrevive na Lixeira.
- Caminho de melhoria: detecção de sequência delete+create do mesmo basename num timeframe curto, convertendo em rename. Heurística frágil — `vault.on('raw')` só dá `path` sem tipo de evento. Worth tentar se rename externo virar caso frequente, mas hoje a recuperabilidade resolve o problema crítico.

---

## Limpezas técnicas pendentes

Código que sobrou de refatorações anteriores e ainda não foi removido. Não atrapalha runtime, mas adiciona ruído na leitura.

### Componentes órfãos do refator pra MarkdownView nativa

Quando a custom `ItemView` foi substituída pela `MarkdownView` nativa do Obsidian, ficaram pra trás:

- `src/view/binaryNotesView.ts` (`NotesForAnythingView`) — a ItemView custom original
- `src/view/headerActions.ts` — header actions da view custom (substituído por `companionHeaderActions.ts`)
- `NFA_VIEW_TYPE` em `src/constants.ts` — ainda registrado em `main.ts` pra evitar crash em workspace state restorado de versão antiga do plugin

**Remover quando:** houver confiança que ninguém vai abrir vault salvo com versão do plugin pré-refator. Pra plugin pessoal, basicamente qualquer momento. Em distribuição BRAT, dar uma versão de aviso antes.

---

## Coexistência e UX em consideração

Itens que funcionam hoje mas que talvez ganhem trabalho dedicado dependendo de uso real.

### Coexistência específica com PDF++

Hoje funciona bem: camada 1 (click interceptor) abre o companion, header action delega pro PDF++ no viewer, header action do PDF++ volta pro companion. Caso patológico (comando próprio do PDF++ tipo "Open PDF in new tab") segue o fluxo do PDF++ direto — aceitável por escolha explícita do user.

- Possível trabalho futuro: bypass condicional via setting se algum caso patológico aparecer no uso real.

### Embeds `![[arquivo.pdf]]` inline em outras notas

Usam o viewer nativo do Obsidian (inline preview). Não passam pelo intercept porque embeds não mudam a active leaf, e o comportamento esperado de embed é mostrar o conteúdo cru, não a nota companion.

- Sem ação prevista. Documentado em `HOW-IT-WORKS.md > Navigation` como "Not intercepted".

---

## Notas de processo

- **Decisões pendentes** com análise feita ficam em `obsidian-plugins-workbench/notes-for-anything/<YYYY-MM-DD>-<tema>-decision.md` (pasta-irmã não-versionada). Aqui no BACKLOG.md fica só o resumo + link.
- **Smoke pré-staged** pra validar features em vault real: `obsidian-plugins-workbench/notes-for-anything/smoke/` com `SMOKE-CHECKLIST.md` filtrado.
- **Próxima sessão:** olha aqui, escolhe um item, vai. Se mexer no escopo de uma decisão pendente, decide com o user primeiro (a recomendação tá cravada na análise, mas é o user que aprova).
