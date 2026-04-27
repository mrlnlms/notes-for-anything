# Discovery — Binary Notes

> Registro da primeira sessão de discussão sobre a ideia. Documento de discovery, não spec. Captura tese, decisões tomadas, decisões em aberto, panorama técnico e histórico relevante. Serve de ponto de partida pra próxima sessão.
>
> **Atualização 2026-04-27:** nome final escolhido = **Binary Notes** (após brainstorm). Plugin foi implementado, refatorado e está rodando — ver `CLAUDE.md` na raiz pra arquitetura atual. Esse discovery doc fica como registro do raciocínio inicial.

**Data:** 2026-04-26
**Diretório do plugin:** `obsidian-binary-props` (legado do working title)
**Nome final:** Binary Notes

---

## 1. Problema

Binários (PDF, imagens, áudios, vídeos, EPUB, etc.) são cidadãos de segunda classe no Obsidian. Você pode linká-los e embedá-los, mas não pode:

- Atrelar metadados estruturados (frontmatter / properties) a eles
- Anotar livremente em markdown
- Indexá-los via Dataview, Bases, busca, grafo, backlinks
- Codificar/categorizar/etiquetar de forma nativa

A dor concreta aparece em pelo menos dois contextos pessoais:

- **Qualia Coding** — variáveis por arquivo (case variables) já existem pra binários, mas vivem só em `data.json` do plugin, sem cidadania nativa
- **Workflow geral** — necessidade recorrente de "essa imagem/PDF tem contexto, alias, origem, anotações" sem perder a UX nativa do Obsidian

---

## 2. Tese central

> **Cristalização (sessão 1):** binário abre como Folder Notes abre `.md` em pastas. Ponto.

Um binário no vault deve poder ser **promovido** (opt-in, por arquivo) a um objeto com:

1. Uma **nota markdown companion** que carrega frontmatter, conteúdo, anotações, properties
2. **Custom view** que se abre quando você clica no binário — mostra o binário embedado + a nota companion + toggle pro source view (igual Excalidraw)
3. **Cidadania nativa**: a nota companion é um `.md` real do vault → backlinks, grafo, search, Dataview, Bases, embeds funcionam de graça
4. **Sem poluição visual**: companion é invisível no file explorer por padrão; binário ganha indicador (underline) sinalizando que tem companion
5. **Deslocável**: companion pode morar em qualquer lugar do vault, conectado ao binário via propriedade YAML — não precisa estar no mesmo path

A combinação 1+2+3+4+5 não existe em nenhum plugin atual. Cada peça tem precedente, ninguém juntou.

---

## 3. Fluxo de UX desenhado

1. Vault zerado, plugin instalado
2. Usuário insere `documento.pdf` — clica nele, abre o viewer nativo do Obsidian (PDF.js). Comportamento padrão preservado
3. Botão direito no `.pdf` → comando "Create binary companion" (ou nome similar)
4. Plugin cria `.md` companion com frontmatter mínimo `binary: <path-do-pdf>`
5. Companion fica **invisível** no file explorer; PDF ganha **underline** (mesmo padrão visual do Folder Notes pra pastas com nota)
6. A partir desse momento, click no PDF abre a **view do plugin** (não o viewer nativo)
7. View do plugin renderiza tudo via **`MarkdownRenderer`**: o binário aparece como embed nativo (`![[arquivo.pdf]]` resolve pro viewer nativo de cada extensão — PDF.js, `<audio>`, `<video>`, `<img>`) seguido do conteúdo do companion. **Não monta viewer manual por tipo.** O Qualia faz manual (Fabric.js no image, WaveSurfer no audio/video) porque o payload dele é annotation overlay; o Companion não tem esse payload, então `MarkdownRenderer` resolve direto e a view fica magra
8. Header da view tem **toggle pro source view** — clica e vai pro binário cru
9. Companion é uma nota `.md` normal do vault — pode ser editada via outro modo, aparece em backlinks/grafo/search, indexável via Dataview, etc.

### Variantes/opções

- **Visibilidade**: default invisível, mas usuário pode tornar companion visível no explorer via override (frontmatter `visible: true` ou setting global)
- **Localização**: default ao lado do binário (implícito por convenção de nome), mas pode estar em qualquer lugar (explícito via propriedade `binary:`)

---

## 4. Decisões tomadas

| Decisão | Resolução |
|---|---|
| Escopo de tipos | **Qualquer binário** desde o começo (PDF, png, mp3, mp4, etc.) — não restrito a PDF |
| Modelo de promoção | **Opt-in por arquivo** via comando explícito (não automático tipo binary-file-manager) |
| Persistência | **Sidecar `.md`** (não `data.json` centralizado) — pra ganhar cidadania nativa no Obsidian |
| Localização do companion | **Pode morar em qualquer lugar** do vault, conectado via propriedade YAML `binary: <path>` |
| Visibilidade default | **Invisível** no file explorer (companion oculto, binário ganha underline) |
| Custom view | **Uma view agnóstica** que renderiza binário embedado + nota companion + toggle source — não uma view por extensão |
| Múltiplos companions por binário | **Não suportado pela UI**. Edge case (criação manual por fora) tratado em modo defensivo: usa o primeiro encontrado, warning discreto |

---

## 5. Decisões em aberto

- **Nome do plugin** — Binary Companion? Binary Props? PDF Companion? Outro? (working title atual: `binary-props` pelo nome do diretório)
- **Convenção de nomenclatura do companion** quando criado ao lado do binário — `arquivo.pdf.md`? `arquivo.md`? `INFO_arquivo_PDF.md` (legado do binary-file-manager)? `arquivo.pdf.companion.md`? Tem peso técnico: define como o plugin descobre companions implícitos via path
- **Mecanismo de toggle pro source view** — botão no header? comando? atalho de teclado? modifier key (Ctrl+click)? Provavelmente combinação
- **Comportamento default quando companion existe mas usuário só quer abrir o binário rapidamente** — modifier key bypass? Setting per-binary?
- **Que metadados/seções vêm no template inicial do companion** — frontmatter mínimo? template configurável tipo Folder Notes?

---

## 6. Panorama técnico — o que está pavimentado

### 6.1 Qualia Coding (próprio)

- **Interceptação de binários já resolvida** em 6 engines (PDF, image, audio, video, csv, md)
- Pattern usado: `active-leaf-change` listener (não `registerExtensions`, que conflita com player nativo de audio/video). Tem flash visível curto (viewer nativo abre antes do swap) — custo aceito, documentado em `TECHNICAL-PATTERNS.md` §8.6
- Reaproveitável: o mecanismo inteiro de "detectar abertura de binário e substituir a view" (`src/core/fileInterceptor.ts`, `src/core/mediaToggleButton.ts`)
- **Registry dual-source `.md`/binário com API uniforme** (`src/core/caseVariables/caseVariablesRegistry.ts`) — precedente direto pro índice reverso do Companion. Patterns reaproveitáveis listados explicitamente: `writingInProgress` set anti-feedback-loop, initial scan deferido pra `onLayoutReady`, filter de `OBSIDIAN_RESERVED`, escrita via `fileManager.processFrontMatter`, bulk write com uma só chamada, `migrateFilePath` em rename
- Local de referência: `local-workbench/My PROJECTS/Docs & Orgs/qualia-coding/.obsidian/plugins/qualia-coding/src/`
- Docs valiosos: `docs/ARCHITECTURE.md`, `docs/TECHNICAL-PATTERNS.md` (21 gotchas catalogados — §8.6 registerExtensions vs intercept, §8.8 WeakSet anti-double-instrumentation, §19.5 detach manual de `view.addAction`, §1.12 MutationObserver self-suppression são os críticos pro Companion)

### 6.2 Folder Notes (público — inspiração direta)

Mapa técnico das 8 técnicas relevantes (ver investigação anexada na sessão):

**Reaproveitáveis diretas:**
1. **Esconder companion**: body class toggle (`.hide-folder-note`) + CSS cascata (`.is-folder-note { display: none }`)
2. **Underline**: classe CSS no item (`.has-folder-note`) com setting per-estilo (underline, bold, cursive)
3. **Click intercept**: `registerDomEvent(document, 'click', ..., true)` em capture phase + `preventDefault()` + `stopImmediatePropagation()`
4. **Sync com filesystem**: `vault.on('create')`, `vault.on('rename')`, `vault.on('delete')` listeners
5. **Pattern "detached"**: companion deslocável — Folder Notes guarda a referência num array em `data.json`; nós provavelmente vamos guardar via propriedade YAML no próprio companion (mais nativo, mais robusto)

**Adaptação fácil:**
- `workspace.on('file-menu')` pra registrar "Create binary companion" no botão direito

**Gotchas conhecidos (já documentados no código deles):**
- Retry logic de 5 tentativas com 500ms pra esperar elementos do file explorer renderizarem
- MutationObserver pra detectar novos itens aparecendo no explorer (lazy render)

### 6.3 Mirror Notes (próprio — futuro alinhamento)

- Faz render de templates dinâmicos baseado em frontmatter
- **Não é dependência**, mas pode integrar no futuro: o companion pode ter um Mirror Notes template configurado, gerando view dinâmica baseada nas properties do binário
- Fica fora do escopo da semente inicial

### 6.4 Excalidraw (público — inspiração de pattern)

- Pattern "custom view + source toggle" vem dele
- Diferença: Excalidraw registra extensão própria (`.excalidraw.md`); aqui vamos interceptar binários que **já têm viewer nativo** — caminho é o `active-leaf-change` do Qualia, não `registerExtensions`

---

## 7. Histórico — Uso do `obsidian-binary-file-manager` (qawatake) anos atrás

> Plugin de terceiro (autor japonês) que toquei intensamente entre ~2022-2023 em pelo menos 5 vaults. **Não é meu código** — não tem timeline pessoal pra reconstruir. Mas tem aprendizado prático que vale capturar.

> **Status confirmado em 2026-04:** o plugin está **abandonado**. Última release **v0.3.0 em jan/2022** (4 anos parado, zero commits desde então). Nota: o "0.12.0" que apareceu em investigação inicial era na verdade o `minAppVersion` do manifest, não a versão do plugin. **Versão real instalada em meus vaults: 0.3.0.** Issues abertas pedindo (a) localização do companion, (b) opt-in via scope e (c) UX entre binário e companion ficaram sem resposta. Comunidade já trata como abandonado.

### O que ele faz

- Detecta automaticamente arquivos binários adicionados ao vault
- Cria sidecar `.md` automático com nome configurável (eu usava `INFO_{{NAME}}_{{EXTENSION:UP}}`)
- Suporta template Templater customizado pro conteúdo inicial do sidecar
- Permite tagging, aliases, internal links, full-text search dos binários **indiretamente** via o sidecar

### Como eu usei

Template Templater (registrado nas notas pessoais em `MOSx.Vault/.../binary-files/`) que:

- Prompt pedindo alias inicial pro arquivo
- Movia o binário pra pasta organizada por extensão (`Files & Media/pdf/`, `/png/`, `/gif/`, `/docx/`)
- Criava companion com frontmatter rico: `aliases`, `original-name`, `type`, `created-at`, `source`, `file-ext`, `redirect`
- Usava callouts (`[!Notes]-`, `[!info]-`) com link bidirecional + embed do binário (`![[{{PATH}}]]`)

### Limites que bati na prática

- **Sidecar fica visível no explorer.** Tentei contornar movendo binários pra `Files & Media/<ext>/` separados, mas isso só "esconde indo pra outra pasta", não resolve. O sidecar continua poluindo o vault
- **Sidecar amarrado ao path do binário.** Não dá pra organizar livremente — o sidecar segue o binário
- **Sem custom view.** Click no binário continua abrindo o viewer nativo. A "nota" e o "binário" são duas entidades separadas que você abre uma de cada vez. Sem unificação visual
- **Criação automática pra todos os binários.** Polui muito em vaults com muitos arquivos. Não é opt-in
- **Sem indicador visual no binário.** Você não vê de relance quais binários têm sidecar e quais não — precisa ir lá conferir

### O que isso ensina pro Binary Companion

Cada um desses limites é exatamente o que a tese atual endereça:

| Limite do binary-file-manager | Como Binary Companion resolve |
|---|---|
| Sidecar visível | Invisível por default, padrão Folder Notes (CSS body class) |
| Amarrado ao path | Companion deslocável via propriedade YAML |
| Sem custom view | Custom view registrada + interceptação via `active-leaf-change` |
| Criação automática pra tudo | Opt-in por arquivo via comando do menu de contexto |
| Sem indicador visual | Underline no binário, padrão Folder Notes |

Em outras palavras: o Binary Companion é o `binary-file-manager` levado **cinco passos adiante**, integrando lições do Folder Notes (UX visual + ocultação) e do Excalidraw (custom view + source toggle).

### Pasta com as notas históricas

`local-workbench/obsidian/_my-vaults/MOSx.Vault/MOSx/sources/Obsidian/Plugins/binary-files/`

- `Binary Files - Explanation and Template.md` — workflow + template Templater completo
- `BinaryFiles Template.md` — template mínimo de metadados (path, name, basename, extension)
- `Pickup binary files.md` — snippet Templater pra suggester de arquivo
- `binary file manager path padrão.md` — padrão de nomenclatura usado (`INFO_{{NAME}}_{{EXTENSION:UP}}`)

---

## 8. Panorama de mercado em 2026

Pesquisa de mercado feita na sessão pra confirmar o gap. Resultado: **gap real e aberto**, mas com sinais de movimento recente que vale acompanhar.

### 8.1 Sucessores do `binary-file-manager`

- ⭐ **`Attachment Sidecar`** (longy2k) — **v1.0.0 em dez/2025, ATIVO, recém-saído do forno**. Concorrente mais próximo. Tem **toggle Show/Hide Sidecar Files** (resolve ocultação) e integração com Bases. **Não tem** custom view, deslocamento via YAML, indicador visual no binário. **Vale monitorar releases dele** — pode evoluir e fechar parte do gap. Repo: `github.com/longy2k/obsidian-attachment-sidecar`
- **`Sidecars`** (Alb-O) — **abandonado**, autor procura sucessor ("NO LONGER MAINTAINED — looking for takeover"). Tinha scoping por wildcards/regex, detecção de órfãos com cleanup, **estilização visual no explorer**. Era o mais perto da nossa tese — morreu. Sinal de que sidecar genérico é difícil de manter sozinho.
- **`Media Companion`** — ativo, foco em mídia (imagem/vídeo). Tem **gallery view** interessante de estudar como referência de browsing. 6.5k downloads, 63 stars.

### 8.2 Vizinhos relevantes (mesmo nicho, escopo/abordagem diferente)

- ⭐ **PDF++** (RyotaUshio) — **muito ativo**, v0.40.31 em ago/2025. **Tese filosoficamente diferente**: anotações distribuídas via backlinks (`[[link]]` pra seleção do PDF vira highlight), não sidecar 1:1. Vai dominar PDF independente do que fizermos. **Decisão futura: integrar/coexistir, não competir.** Repo: `github.com/RyotaUshio/obsidian-pdf-plus`
- ⭐ **Annotator** (elias-sundqvist) — **pattern muito próximo do nosso**: nota com frontmatter `annotation-target: <pdf-path>`. É o predecessor mais direto da ideia "YAML linkando sidecar deslocado". Workflow inverso do nosso ("criar nota → apontar pra binário" vs "criar companion partir do binário"), mas vale **estudo aprofundado** da implementação. Repo: `github.com/elias-sundqvist/obsidian-annotator`
- **Excalidraw** (zsviczian) — pattern "toggle binário↔source" já mainstream na comunidade. **Use o mesmo verbo na UX** ("Toggle between [view] and Markdown mode"). Diferença: Excalidraw é arquivo dele mesmo (`.excalidraw.md`); nós interceptamos binário externo.
- **Media Notes** (jemstelos) — best-in-class pra **vídeo+timestamp**. Boa referência pra UX quando o companion for de áudio/vídeo. Pattern: nota com player embedado e `[HH:MM:SS]` linkando de volta.
- **ePub Reader** (caronchen) — leitor `.epub` nativo via custom view registrada. Padrão "registrar view pra extensão" na prática.
- **Custom File Extensions and Types** (MeepTech) — registra extensões pra views existentes do Obsidian. Útil de conhecer mas nenhum desses cria custom view rica embutindo binário + nota.

### 8.3 Status do nicho

- **Especialistas por mídia prosperam**: PDF++, Media Notes, Excalidraw, ePub Reader — todos ativos e com base de usuários
- **Sidecar genérico morre ou estagna**: BFM (2022), Sidecars (abandonado), Attachment Sidecar (recém-nascido, minimalista)
- **Ninguém juntou** sidecar genérico + custom view embedada + source toggle + deslocamento flexível + estética nativa

### 8.4 Gap real confirmado

A combinação específica do Binary Companion é **genuinamente nova**. Diferenciais que ninguém faz hoje:

| Diferencial | Quem chega perto |
|---|---|
| Custom view com binário **externo** embedado + companion + toggle | Excalidraw (mas pra arquivo próprio do plugin) |
| Deslocamento via propriedade YAML | Annotator (com workflow inverso) |
| Underline + ocultação combinados em **binários** | Folder Notes (mas pra pasta) |
| Opt-in por arquivo via comando + os 3 acima juntos | **Ninguém** |

### 8.5 Demanda silenciosa da comunidade

Issues abertas no `binary-file-manager` (nunca atendidas) sinalizam dor real e compartilhada:

- #4 (jul/2022) — "Option to keep metadata files in same folder as original" → **localização do companion**
- #6 (ago/2022) — "For auto-detection: specify folder(s) to watch" → **escopo / opt-in**
- #13 (fev/2024) — "Navigation Links to Meta File" → **relação UX entre binário e companion**

Isso valida que a tese não é só "ideia legal minha" — é uma dor compartilhada sem solução.

### 8.6 Nota sobre core do Obsidian

Discussão oficial no fórum ("Property support for non-markdown files") confirma que **Obsidian core não suporta** properties em binários. Workaround universal hoje é... sidecar `.md`. **Estamos no caminho que o ecossistema demanda.**

### 8.7 Tamanho da demanda — números reais

Pesquisa de downloads/stars dos plugins **mais próximos da nossa tese** (sidecar genérico pra binários, não os especialistas):

| Plugin | Status | Downloads | Stars | Store oficial |
|---|---|---|---|---|
| **binary-file-manager** (qawatake) | Abandonado 4 anos | **11.279** | 81 | Sim |
| **Sidecars** (Alb-O → awesym) | Abandonado, fork dormente | n/d | 0 | **Não** |
| **Attachment Sidecar** (longy2k) | Recém-lançado dez/2025 | n/d (BRAT-only) | 4 | **Não** |
| **Media Companion** | Ativo, mas especialista mídia | 6.527 | 63 | Sim |

**Leitura honesta:**

- **Sidecar genérico de fato no store oficial = só o `binary-file-manager`.** E ele tá morto há 4 anos
- **11.279 downloads num plugin abandonado há 4 anos é o sinal mais importante.** Pessoas continuam descobrindo, instalando e usando ele apesar de zero suporte e zero features modernas (Bases etc). Demanda residual real, não inflada
- Os sucessores (Sidecars, Attachment Sidecar) **nem entraram no store oficial** — distribuição BRAT/manual limita descoberta drasticamente. Não dá pra inferir demanda real deles
- Media Companion (6.527) sinaliza que o **teto absoluto desse nicho** é provavelmente entre **5k-30k downloads** pra plugins de binário/mídia no Obsidian (PDF++ é outra liga, killer app específico)

**Caracterização do nicho:** não é blue ocean comercial — é **abandoned ocean**. Espaço aberto porque os anteriores desistiram, não porque não há usuários.

**Estimativa realista pro Binary Companion se virar plugin oficial bem feito:**
- **Curto prazo (6m no store):** ~500-2k downloads (nicho técnico, descoberta lenta)
- **Médio prazo (~2 anos):** ~5k-15k se chegar a substituir o `binary-file-manager` na busca
- **Teto realista:** difícil ultrapassar 20-30k sem virar specialist (tipo Media Companion fez pra mídia)

**Implicação estratégica:** vale como **projeto pessoal + portfolio + uso próprio** com upside modesto. Não vale apostar como produto comercial. Mas a tese técnica é sólida e a dor é real — os 11k abandonados não mentem. Se o objetivo é construir algo útil pra si mesmo (e pra Qualia, eventualmente), e ganhar uns milhares de usuários no caminho como bônus, é projeto viável e honesto.

---

## 9. Estimativa de esforço

**Grau de dificuldade: baixo-médio.** ~80% das peças prontas em código próprio (Qualia) ou público (Folder Notes).

### Componentes do MVP

| # | Componente | LOC estimado |
|---|---|---|
| 1 | Scaffold + manifest + build | trivial (skill `obsidian-plugin-scaffold` existe) |
| 2 | Comando "Create binary companion" via `file-menu` | ~50 |
| 3 | Criar `.md` com frontmatter `binary: <path>` | trivial |
| 4 | Índice reverso (binário → companion) via `metadataCache` + listeners — adapta `caseVariablesRegistry` do Qualia, especializa pra chave `binary:` | ~60 |
| 5 | Esconder companions via CSS toggle | ~20 (cópia direta do Folder Notes) |
| 6 | Underline em binário com companion | ~30 + MutationObserver |
| 7 | Click intercept → abre view do plugin | ~80 (combina pattern Qualia + Folder Notes) |
| 8 | **Custom view** com binário embedado + companion renderizado + toggle source | **~200-400** |
| 9 | Listeners `vault.rename` / `vault.delete` pra manter `binary:` em sync | ~60 |
| 10 | Settings page | ~100 |

**Total estimado: ~1.000-1.500 linhas pro MVP funcional.**

**Tempo: fim de semana focado** ou ~3 sessões de trabalho. Plugin público polido em ~2-3 semanas part-time.

### Componente mais substantivo

A **custom view** (#8). Integra `MarkdownRenderer` dentro de uma `ItemView` própria, header com toggle source, embed do binário. Tem precedente em vários plugins, mas é onde mora o detalhe — links internos, edit mode, scroll preservation, dark mode, lifecycle.

---

## 10. Riscos

### Risco técnico — **baixo**

- **Conflito com viewers nativos por extensão**: PDF, png, mp3, mp4 todos têm viewer nativo. Mitigação: pattern `active-leaf-change` do Qualia já resolve. Roadmap pavimentado
- **Coexistência com plugins de viewer (PDF++, Excalidraw, ePub Reader)**: o `fileInterceptor` do Qualia opera em "first registered wins" — sem detecção de conflito explícita. Mitigação concreta: detectar plugins conhecidos no `onload` e settings escolhe modo (bypass / coexistir / assumir). Não é "filosofia" em prosa, é decisão a ser desenhada
- **Edge cases de file lifecycle**: rename, delete, conflito de nome, vault offline. Clássico de plugin Obsidian, mas atenção necessária

### Risco de UX — **baixo-médio**

- **"Magia" do click no PDF abrir uma nota pode confundir**. Mitigação: opt-in por arquivo (não automático), toggle source sempre acessível, indicador visual (underline) sinalizando "esse arquivo tem companion"
- **Vault com sync (Obsidian Sync, iCloud, Dropbox)**: deveria funcionar via `metadataCache` padrão, mas é vetor clássico de bugs

### Risco de escopo — **a vigiar**

- A integração com Mirror Notes é tentadora mas fica **fora do MVP**. Sem disciplina, vira feature creep
- Repensar relação Qualia ↔ Companion (Qualia poderia ser construído em cima do Companion como base genérica) é insight legítimo mas **não é tarefa desse plugin** — é refator separado do Qualia

### Risco competitivo — **monitorar**

- **`Attachment Sidecar`** (longy2k) lançou v1.0.0 em **dez/2025**. Está ativo e pode evoluir pra cobrir parte do gap (ocultação já tem). Vale acompanhar releases dele a cada ~2-3 meses
- Se ele implementar custom view + deslocamento via YAML antes de nós lançarmos, o diferencial se reduz. Mitigação: focar nos 3 pontos onde ninguém está (custom view embedada + YAML linking + indicador visual em binário) e priorizar lançar MVP cedo
- Não é risco bloqueador: nicho é grande o suficiente pra dois plugins coexistirem com filosofias diferentes

---

## 11. Insight estratégico

### 11.1 Hierarquia conceitual: Companion como base do Qualia

A discussão revelou uma leitura interessante da hierarquia conceitual:

> **Binary Companion é a generalização "Obsidian-nativa" do que o Qualia faz pra um domínio específico.**
>
> - **Qualia**: binário → UI de QDA (codes, markers, coordenadas), persistência em `data.json`
> - **Companion**: binário → nota markdown agnóstica (Dataview, properties, embeds, qualquer markdown), persistência em sidecar `.md`
>
> Mecanismo de interceptação idêntico. Diferença: o **payload da view**.
>
> Em tese, Qualia poderia ser refatorado pra usar Companion como infraestrutura base ("binário tem nota markdown") e adicionar sua camada de domínio em cima ("essa nota tem seções específicas pra coding"). Não é tarefa desse plugin, mas é uma direção futura possível.

### 11.2 Posicionamento de mercado: framework de cidadania binária

Pesquisa de mercado (seção 8) revelou um posicionamento estratégico forte:

> **Binary Companion não é "mais um plugin de sidecar". É o framework de cidadania binária do Obsidian — a cola que falta entre os especialistas.**

O ecossistema atual tem **especialistas por mídia** que dominam seus nichos:
- **PDF++** domina anotação de PDF (via backlinks)
- **Media Notes** domina vídeo+timestamp
- **Excalidraw** domina drawing
- **ePub Reader** domina epub

Cada um resolve a anotação **fina** dentro do seu domínio. **Ninguém resolve a camada de baixo**: "esse binário, qualquer que seja a extensão, é um cidadão de primeira no vault, com sidecar canônico, identidade própria, metadados estruturados, indexável, conectado".

**Filosofia de coexistência:** o Companion é onde os metadados estruturados, anotações livres, e contexto vivem (o "card" do binário no vault). Os especialistas continuam fazendo a anotação fina dentro do domínio deles, e podem **referenciar** o companion ou ser **embedados** nele.

Exemplo concreto pra PDF:
- **PDF++**: faz highlights via backlinks distribuídos, viewer enriquecido
- **Companion**: o sidecar do PDF tem `aliases`, `origin`, `tags`, `read-status`, `notes`, e pode embedar o PDF com PDF++ rodando dentro da custom view

Isso é compatível, não competitivo. Cada um faz o que faz melhor.

**Composição de frontmatter no mesmo `.md`.** Argumento técnico que sustenta o slogan: o sidecar do Companion pode carregar simultaneamente `binary: doc.pdf` (Companion) + `caseId: case-X` + `methodology: thematic` (Qualia) + `aliases: [...]` (Obsidian core) num único arquivo. Cada plugin filtra o que enxerga (`OBSIDIAN_RESERVED` no Qualia, chave específica `binary:` no Companion). Não há conflito — há **composição**. O companion é cidadão de primeira não só do Obsidian (backlinks, grafo, Dataview, Bases), mas do **ecossistema de plugins inteiro** sem precisar conhecer eles. Isso é o que torna a tese tecnicamente real, não só elegante.

### 11.3 Implicação prática

Se essa leitura colar, o nome do plugin pode refletir isso. **"Binary Props"** (working title atual) é mais leve, mas **"Binary Companion"** comunica melhor o posicionamento de "cidadania nativa" + "cola entre especialistas". Decisão fica em aberto.

---

## 12. Próximos passos possíveis

Sem ordem fixa, à vontade do humor:

- Decidir nome do plugin (Binary Companion vs Binary Props vs outro)
- Decidir convenção de nomenclatura do companion
- Estudar implementação do **Annotator** (pattern `annotation-target: <path>` no frontmatter) — é o predecessor mais direto do nosso YAML linking
- Estudar o **`Attachment Sidecar`** (longy2k) — recém-lançado, vale ver como ele resolve show/hide e setup de Bases
- Estudar o **gallery view** do **Media Companion** como referência de browsing
- Olhar mais a fundo a custom view: que componentes Obsidian usar (MarkdownView estendida? ItemView com MarkdownRenderer?)
- Spike técnico curto: protótipo só do click intercept + custom view trivial pra validar que não quebra o viewer nativo
- Entrar em modo plan/spec formal (skill `superpowers:brainstorming` → `writing-plans`) quando quiser começar a implementar
- Considerar usar `obsidian-plugin-scaffold` pra setup inicial quando decidir começar
- **Acompanhar releases do `Attachment Sidecar`** a cada ~2-3 meses pra reagir caso ele vá pra cima do gap

---

## Apêndice A — Sources da pesquisa de mercado

- Attachment Sidecar (longy2k): https://github.com/longy2k/obsidian-attachment-sidecar
- Sidecars (Alb-O, abandoned): https://github.com/Alb-O/obsidian-sidecars
- Binary File Manager (qawatake): https://github.com/qawatake/obsidian-binary-file-manager-plugin
- PDF++ (RyotaUshio): https://github.com/RyotaUshio/obsidian-pdf-plus
- Annotator (elias-sundqvist): https://github.com/elias-sundqvist/obsidian-annotator
- Excalidraw (zsviczian): https://github.com/zsviczian/obsidian-excalidraw-plugin
- Folder Notes (LostPaul): https://github.com/LostPaul/obsidian-folder-notes
- Media Notes (jemstelos): https://github.com/jemstelos/obsidian-media-notes
- ePub Reader (caronchen): https://github.com/caronchen/obsidian-epub-plugin
- Custom File Extensions (MeepTech): https://github.com/MeepTech/obsidian-custom-file-extensions-plugin
- Forum: Property support for non-markdown files: https://forum.obsidian.md/t/property-support-for-non-markdown-files/64386
- Sidecar Files tag em ObsidianStats: https://www.obsidianstats.com/tags/sidecar-files
