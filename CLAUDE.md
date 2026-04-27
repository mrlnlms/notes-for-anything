# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status atual

Projeto em **fase de discovery — ainda não há código**. O único conteúdo é `docs/01-discovery-binary-companion.md`, que é a fonte da verdade sobre tese, decisões tomadas, panorama técnico e plano. Sempre leia esse doc antes de propor qualquer coisa estrutural.

Working title do plugin: **Binary Companion** (vs `Binary Props` — decisão em aberto). Diretório fixo: `obsidian-binary-props`.

## Tese em uma linha

> Binário (PDF, imagem, áudio, vídeo, etc.) abre como Folder Notes abre `.md` em pastas: opt-in por arquivo, com sidecar `.md` companion, custom view embedando o binário + nota + toggle source, indicador visual no binário, companion deslocável via propriedade YAML `binary: <path>`.

## Decisões já tomadas (não relitigue sem motivo forte)

Da seção 4 do discovery — tratar como assentado:

- **Escopo**: qualquer binário desde o início, não só PDF
- **Promoção**: opt-in por arquivo via comando explícito (não auto-detecção como o `binary-file-manager`)
- **Persistência**: sidecar `.md` real do vault, não `data.json` centralizado
- **Localização**: companion pode morar em qualquer lugar, conectado via frontmatter `binary: <path>`
- **Visibilidade default**: companion invisível no file explorer; binário ganha underline
- **Custom view**: uma view agnóstica única (não uma por extensão)
- **Múltiplos companions por binário**: não suportado pela UI; modo defensivo (primeiro encontrado + warning) pra edge case de criação manual

Decisões em aberto (seção 5): nome do plugin, convenção de nomenclatura do companion ao lado do binário, mecanismo de toggle source, bypass rápido pro binário cru, template inicial.

## Arquitetura prevista (quando começar a implementar)

Componentes do MVP estimados em ~1.000-1.500 LOC. Os blocos críticos:

1. **Click intercept** — `registerDomEvent(document, 'click', handler, true)` em capture phase, `preventDefault()` + `stopImmediatePropagation()`. Pattern direto do Folder Notes
2. **Substituição de view ao abrir binário** — `workspace.on('active-leaf-change')` listener, **não** `registerExtensions` (conflita com player nativo de áudio/vídeo). Pattern já resolvido em 6 engines do Qualia Coding
3. **Custom view** — `ItemView` própria com `MarkdownRenderer` pra companion + embed nativo do binário (`![[arquivo.pdf]]`) + header com toggle source. Componente mais substantivo (~200-400 LOC)
4. **Índice reverso binário→companion** — via `metadataCache` + listeners de `vault.on('create' | 'rename' | 'delete')`
5. **Esconder companion** — body class toggle (`.hide-binary-companion`) + CSS cascata. Cópia direta do Folder Notes
6. **Underline no binário** — classe CSS no item do explorer + MutationObserver pra lazy render do file explorer

## Precedentes a estudar antes de implementar

Reuso pesado, não reinventar:

- **Qualia Coding (próprio)** — `local-workbench/My PROJECTS/Docs & Orgs/qualia-coding/.obsidian/plugins/qualia-coding/src/`. Mecanismo inteiro de interceptação + substituição de view pra binário já está pronto em 6 engines. `docs/ARCHITECTURE.md` e `docs/TECHNICAL-PATTERNS.md` (21 gotchas) são leitura obrigatória
- **Folder Notes (LostPaul)** — github.com/LostPaul/obsidian-folder-notes. 8 técnicas mapeadas no discovery (seção 6.2): hide via CSS body class, underline, click intercept, retry logic 5x500ms pra esperar render, MutationObserver
- **Annotator (elias-sundqvist)** — pattern `annotation-target: <pdf-path>` no frontmatter. Predecessor mais direto do YAML linking (workflow inverso: nota → binário, em vez de binário → nota)
- **Excalidraw (zsviczian)** — pattern de toggle binário↔source. Use o **mesmo verbo** ("Toggle between [view] and Markdown mode")
- **Attachment Sidecar (longy2k)** — concorrente recém-lançado dez/2025, ativo. Monitorar releases a cada 2-3 meses

## Quando começar a implementar

- Use a skill `obsidian-plugin-scaffold` pra setup inicial (esbuild 0.25, TS5, ESLint 9 flat, BRAT-ready manifest, hot-reload, demo vault, CI/CD)
- Use a skill `superpowers:brainstorming` antes de qualquer feature substantiva, depois `superpowers:writing-plans` antes de codar
- Pra edição CM6 (decorations, widgets, click intercept dentro do editor) e settings UI, ver as skills `obsidian-cm6`, `obsidian-core`, `obsidian-settings`, `obsidian-design`
- Spike técnico recomendado antes do MVP completo: protótipo só de click intercept + custom view trivial pra validar que não quebra o viewer nativo

## Convenções operacionais

- **Commits**: sempre via `~/.claude/scripts/commit.sh "mensagem"`. Conventional commits em pt-br (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Sem emoji. Sem `Co-Authored-By` (o script bloqueia)
- **Discovery doc é canônico**: se decidir mudar uma das decisões da seção 4, atualize o discovery na mesma sessão — não deixe esse CLAUDE.md e o discovery divergirem
- **Filosofia de coexistência com especialistas** (PDF++, Media Notes, Excalidraw, ePub Reader): o Companion é a camada de cidadania binária ("esse binário tem identidade no vault"); especialistas continuam fazendo a anotação fina dentro do domínio. Não competir, integrar
- **Escopo do MVP é estreito**: integração com Mirror Notes, refator do Qualia pra rodar em cima do Companion — ambas tentadoras, ambas **fora** do MVP (seção 10, risco de escopo)
