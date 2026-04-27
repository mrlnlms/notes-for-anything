# Binary Notes Implementation Plan

> **⚠️ HISTÓRICO — plano original.** Foi executado integralmente (Tasks 1-18, ~19 commits), mas após testes manuais o desenho da `BinaryNotesView` custom foi descartado em favor de `MarkdownView` nativa do Obsidian. Ver `CLAUDE.md` na raiz pra arquitetura corrente.
>
> Tasks que sobrevivem ao refator: registry, lifecycle, click intercept, view swapper, explorer decorator, settings, commands, mock infra, testes (61 deles).
> Tasks revisadas/substituídas: `BinaryNotesView` custom + `headerActions` originais → órfãos; substituídos por `companionHeaderActions.ts` que adiciona botão bidirecional na MarkdownView nativa e no viewer do binário.
>
> Pra agentes que forem trabalhar no plugin: leiam `CLAUDE.md` primeiro. Esse plano fica como histórico de execução.

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o plugin Obsidian Binary Notes — promoção opt-in de binários (PDF, image, audio, video) a cidadãos de primeira via sidecar `.md` companion + custom view embedando binário e nota.

**Architecture:** Plugin TypeScript single-package. Click intercept em capture phase (caminho primário) + `active-leaf-change` (fallback) substituem viewers nativos por uma `ItemView` própria que renderiza embed do binário e body do companion via `MarkdownRenderer`. Registry dual-source (frontmatter `binary:` no companion + índice em memória) adapta o `caseVariablesRegistry.ts` do Qualia Coding. Hide/underline via body class + CSS cascata (Folder Notes pattern).

**Tech Stack:** TypeScript 5, esbuild 0.25, ESLint 9 flat config, Vitest + jsdom, Obsidian Plugin API.

**Spec:** `docs/superpowers/specs/2026-04-27-binary-notes-design.md`
**Discovery:** `docs/01-discovery-binary-companion.md`
**Patterns reference:** `/Users/mosx/Desktop/obsidian-plugins-workbench/.obsidian/plugins/obsidian-qualia-coding/src/` (Qualia Coding — mesmo autor)

---

## File Structure

```
binary-notes/
├── manifest.json                             # gerado pelo scaffold
├── package.json                              # gerado pelo scaffold
├── tsconfig.json                             # gerado pelo scaffold
├── esbuild.config.mjs                        # gerado pelo scaffold
├── vitest.config.ts                          # gerado pelo obsidian-test-setup
├── styles.css                                # hide companion + underline + view
├── src/
│   ├── main.ts                               # plugin entry, lifecycle, wiring
│   ├── constants.ts                          # view types, CSS classes, comando IDs
│   ├── types.ts                              # interfaces compartilhadas
│   ├── settings/
│   │   ├── settings.ts                       # interface BinaryNotesSettings + DEFAULT
│   │   └── settingsTab.ts                    # PluginSettingTab UI
│   ├── registry/
│   │   └── companionRegistry.ts              # adapta caseVariablesRegistry do Qualia
│   ├── utils/
│   │   └── pathResolver.ts                   # path normalization, resolution, extension check
│   ├── view/
│   │   ├── binaryNotesView.ts                # ItemView custom (preview-only)
│   │   └── headerActions.ts                  # botão "Toggle source view" (com WeakMap detach)
│   ├── intercept/
│   │   ├── clickInterceptor.ts               # capture phase click handler (primário)
│   │   └── viewSwapper.ts                    # active-leaf-change handler (fallback)
│   ├── explorer/
│   │   └── explorerDecorator.ts              # underline + hide via classes + MutationObserver
│   ├── lifecycle/
│   │   └── vaultLifecycleHandler.ts          # vault.on(rename/delete) cascade
│   └── commands/
│       └── commands.ts                       # registra "Add Binary Notes" e "Toggle source view"
└── tests/
    ├── obsidian.mock.ts                      # mock de Obsidian API (gerado pela skill)
    ├── pluginFactory.ts                      # factory de plugin pra testes (gerado)
    ├── utils/
    │   └── pathResolver.test.ts
    ├── registry/
    │   └── companionRegistry.test.ts
    ├── lifecycle/
    │   └── vaultLifecycleHandler.test.ts
    ├── intercept/
    │   └── clickInterceptor.test.ts
    └── view/
        └── binaryNotesView.test.ts
```

---

## Chunk 1: Scaffold e infraestrutura

### Task 1: Inicializar git e scaffold do plugin

**Files:**
- Create: `.git/` (via `git init`)
- Create: `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `manifest.json`, `src/main.ts`, `.eslintrc`, `.gitignore`, etc (via skill)

- [ ] **Step 1: Verificar diretório atual e estado do repo**

Run: `ls /Users/mosx/Desktop/obsidian-plugins-workbench/.obsidian/plugins/obsidian-binary-props/`
Expected: ver `docs/`, `CLAUDE.md` (sem `.git`, sem `package.json`, sem `src/`)

- [ ] **Step 2: Inicializar git**

Run: `cd /Users/mosx/Desktop/obsidian-plugins-workbench/.obsidian/plugins/obsidian-binary-props/ && git init`
Expected: "Initialized empty Git repository in ..."

- [ ] **Step 3: Invocar skill `obsidian-plugin-scaffold`**

Use a skill `obsidian-plugin-scaffold` no diretório `obsidian-binary-props`. Parâmetros mínimos:
- Nome do plugin: `Binary Notes`
- ID do plugin: `binary-notes`
- Description: `Promote binary files (PDF, image, audio, video) to first-class citizens with sidecar markdown notes and a unified custom view.`
- Author: Marlon Lemes
- Version inicial: `0.1.0`
- minAppVersion: a mais recente estável

Saída esperada: `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `src/main.ts` minimal, hot-reload setup, demo vault, CI/CD, `npm run dev` funcional.

- [ ] **Step 4: Validar o scaffold**

Run: `npm install`
Expected: instalação sem erros

Run: `npm run dev`
Expected: build watch rodando, gera `main.js` (Ctrl+C pra parar)

Run: `git status`
Expected: ver os arquivos do scaffold como untracked

- [ ] **Step 5: Commit do scaffold**

Antes de adicionar, valide que os paths existem no scaffold. Run: `ls -la` e revise visualmente. Use `git add <path>` por arquivo/pasta presente — se algo do esperado não foi gerado pelo scaffold, NÃO mascare com `2>/dev/null`; investigue e corrija.

```bash
git add manifest.json package.json package-lock.json tsconfig.json esbuild.config.mjs src/ styles.css
# Adicione individualmente os opcionais SE existirem (verificados em ls):
#   git add eslint.config.js
#   git add versions.json
#   git add .gitignore
#   git add .github/
#   git add scripts/
#   git add demo/
~/.claude/scripts/commit.sh "chore: scaffold inicial via obsidian-plugin-scaffold skill"
```

---

### Task 2: Setup test infra (Vitest + jsdom + mocks)

**Files:**
- Create via skill: `vitest.config.ts`, `tests/obsidian.mock.ts`, `tests/pluginFactory.ts`, package.json scripts (`test`, `test:watch`)

- [ ] **Step 1: Invocar skill `obsidian-test-setup`**

Use a skill `obsidian-test-setup` em modo "initial setup from zero". A skill instala dependências (`vitest`, `jsdom`, `@vitest/ui`), cria `vitest.config.ts`, mocks de Obsidian (`obsidian.mock.ts`), `pluginFactory.ts`, e adiciona scripts ao `package.json`.

Saída esperada: arquivos criados, comando `npm test` reconhece (mesmo sem testes ainda).

- [ ] **Step 2: Validar que test runner roda**

Run: `npm test -- --run`
Expected: "No test files found" (ou similar — sem testes ainda, mas sem erro)

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts tests/ package.json package-lock.json
~/.claude/scripts/commit.sh "chore: setup vitest + jsdom + obsidian mocks"
```

---

### Task 2.5: Estender `obsidian.mock.ts` com helpers usados no plano

A skill `obsidian-test-setup` cria `obsidian.mock.ts` e `pluginFactory.ts` com mocks básicos. Os testes deste plano usam helpers customizados que provavelmente NÃO vêm prontos. Adicione-os agora pra que cada task de teste subsequente funcione sem fricção. Se algum já existir, deixe como está.

**Files:**
- Modify: `tests/obsidian.mock.ts`
- Modify: `tests/pluginFactory.ts`

**Helpers a garantir:**

| Helper | Onde | Propósito |
|---|---|---|
| `vault.__setFile(path, frontmatter, kind?, body?)` | mock | Adiciona arquivo ao vault virtual com FM e body opcionais (`kind` = `'md' \| 'binary'`, default `'md'`) |
| `vault.__deleteFile(path)` | mock | Remove arquivo do vault virtual sem disparar evento |
| `vault.__getFile(path)` | mock | Recupera o objeto interno (com `.content`) pra asserções |
| `vault.__triggerRename(oldPath, newPath)` | mock | Renomeia no vault virtual e dispara `vault.on('rename')` |
| `vault.__triggerDelete(path)` | mock | Dispara `vault.on('delete')` (com TFile correspondente) |
| `metadataCache.__triggerChanged(path)` | mock | Lê o FM do arquivo virtual e dispara `metadataCache.on('changed')` |
| `workspace.__triggerLayoutReady()` | mock | Dispara `workspace.onLayoutReady` callbacks registrados |
| `workspace.__createLeaf()` | mock | Cria um leaf virtual mínimo (com `setViewState`, `view`, etc) |
| `workspace.__createLeafWithFile(path, viewType)` | mock | Leaf com `view` que é `FileView` apontando pro path |
| `workspace.__createLeafWithViewType(viewType)` | mock | Leaf cujo `view.getViewType()` retorna o tipo dado |
| `workspace.__triggerActiveLeafChange(leaf)` | mock | Dispara `workspace.on('active-leaf-change')` com o leaf dado |
| `workspace.__getLastSetViewState()` | mock | Retorna `{ type, state }` do último `setViewState` chamado em qualquer leaf, ou `null` |
| `workspace.__resetSetViewStateLog()` | mock | Limpa o log do `__getLastSetViewState` |
| `workspace.__setActiveFile(path)` | mock | Faz `getActiveFile()` retornar o file desse path |
| `fileManager.__mockProcessFrontMatter(path, fmRef)` | mock | Quando `processFrontMatter` for chamado para esse path, executa o callback passando `fmRef` (mutate-in-place) |
| `MarkdownRenderer.render` | mock | Exposto como `vi.fn()` instalado em `app.MarkdownRenderer.render` (espião pra assertions) |
| `leaf.__getActions()` | mock | Retorna array dos elements adicionados via `view.addAction` na leaf |
| `plugin.__runCommand(commandId)` | factory | Executa o callback do comando registrado por id (chama `checkCallback(false)` se for o caso) |

- [ ] **Step 1: Editar `tests/obsidian.mock.ts`**

Adicionar (ou completar) cada helper acima. Pode usar mocks simples (Maps internos pra arquivos, arrays pra logs). Exporte `TFile` como classe simples com `path`, `extension`, `name`, `basename` mínimos. Garanta que `TFile` instanceof check funciona no runtime de teste.

- [ ] **Step 2: Editar `tests/pluginFactory.ts`**

Adicionar `__runCommand(commandId)` no plugin retornado: itera comandos registrados via `addCommand`, encontra por id, executa.

- [ ] **Step 3: Smoke test dos helpers**

Crie `tests/__helpers.test.ts` mínimo:

```typescript
import { describe, it, expect } from 'vitest';
import { createPlugin } from './pluginFactory';

describe('mock helpers smoke', () => {
  it('vault.__setFile + getAbstractFileByPath devolve TFile', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', { foo: 'bar' });
    const f = plugin.app.vault.getAbstractFileByPath('a.md');
    expect(f).toBeTruthy();
    expect(f?.path).toBe('a.md');
  });

  it('metadataCache.__triggerChanged dispara handler', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', { foo: 'bar' });
    let fired = false;
    plugin.app.metadataCache.on('changed', () => { fired = true; });
    plugin.app.metadataCache.__triggerChanged('a.md');
    expect(fired).toBe(true);
  });

  it('workspace.__triggerLayoutReady executa callbacks pendentes', async () => {
    const plugin = createPlugin();
    let ran = false;
    plugin.app.workspace.onLayoutReady(() => { ran = true; });
    await plugin.app.workspace.__triggerLayoutReady();
    expect(ran).toBe(true);
  });
});
```

Run: `npm test -- --run tests/__helpers.test.ts`
Expected: PASS — confirma que o mock está coerente antes das tasks de domínio.

- [ ] **Step 4: Commit**

```bash
git add tests/obsidian.mock.ts tests/pluginFactory.ts tests/__helpers.test.ts
~/.claude/scripts/commit.sh "chore(tests): estender obsidian mock com helpers de vault/workspace/metadataCache"
```

---

### Task 3: Constantes e types base

**Files:**
- Create: `src/constants.ts`
- Create: `src/types.ts`
- Modify: `src/main.ts` (importar constantes pra warm-up)

- [ ] **Step 1: Escrever `src/constants.ts`**

```typescript
// src/constants.ts

/** View type ID pra a custom view */
export const BINARY_NOTES_VIEW_TYPE = 'binary-notes-view';

/** ID do comando "Add Binary Notes" */
export const CMD_ADD_BINARY_NOTES = 'add-binary-notes';

/** ID do comando "Toggle source view" */
export const CMD_TOGGLE_SOURCE = 'toggle-source-view';

/** Frontmatter key que define a relação companion → binário */
export const FM_KEY_BINARY = 'binary';

/** Frontmatter key opcional pra override de visibilidade per-companion */
export const FM_KEY_VISIBLE = 'visible';

/** CSS classes aplicadas no DOM */
export const CSS_CLASSES = {
  /** Body class aplicada quando "Hide companions" está ON */
  bodyHide: 'hide-binary-companion',
  /** Aplicada no item do explorer que é companion (pra hide cascade) */
  itemIsCompanion: 'is-binary-companion',
  /** Aplicada no item do binário que tem companion (pra underline) */
  itemHasCompanion: 'has-binary-companion',
} as const;

/** Extensões de binário cobertas pelo plugin */
export const SUPPORTED_EXTENSIONS = new Set([
  'pdf',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',
  'mp3', 'm4a', 'wav', 'ogg', 'flac',
  'mp4', 'webm', 'mov', 'mkv',
]);
```

- [ ] **Step 2: Escrever `src/types.ts`**

```typescript
// src/types.ts
import type { TFile } from 'obsidian';

/** Entrada do índice reverso binário → companion */
export interface CompanionEntry {
  binaryPath: string;
  companionPath: string;
  visible: boolean; // do frontmatter `visible:`
}

/** Callback de mutação no registry */
export type RegistryMutationListener = (
  binaryPath: string,
  companionPath: string | null,
) => void;
```

- [ ] **Step 3: Commit**

```bash
git add src/constants.ts src/types.ts
~/.claude/scripts/commit.sh "feat: add constants and base types"
```

---

### Task 4: Settings interface e defaults

**Files:**
- Create: `src/settings/settings.ts`

- [ ] **Step 1: Escrever `src/settings/settings.ts`**

```typescript
// src/settings/settings.ts

export interface BinaryNotesSettings {
  /** Esconder companions no file explorer (body class toggle) */
  hideCompanions: boolean;
  /** Path opcional pra `.md` template usado como conteúdo inicial do companion */
  companionTemplatePath: string;
}

export const DEFAULT_SETTINGS: BinaryNotesSettings = {
  hideCompanions: true,
  companionTemplatePath: '',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/settings/settings.ts
~/.claude/scripts/commit.sh "feat: add settings interface and defaults"
```

---

## Chunk 2: Camada de dados (path resolver + registry)

### Task 5: PathResolver com TDD

**Files:**
- Create: `tests/utils/pathResolver.test.ts`
- Create: `src/utils/pathResolver.ts`

- [ ] **Step 1: Escrever testes (RED)**

```typescript
// tests/utils/pathResolver.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  isSupportedBinary,
  defaultCompanionPath,
  isCompanionPath,
} from '../../src/utils/pathResolver';

describe('pathResolver', () => {
  describe('isSupportedBinary', () => {
    it('reconhece extensões cobertas', () => {
      expect(isSupportedBinary('paper.pdf')).toBe(true);
      expect(isSupportedBinary('img.png')).toBe(true);
      expect(isSupportedBinary('song.mp3')).toBe(true);
      expect(isSupportedBinary('clip.MP4')).toBe(true); // case insensitive
      expect(isSupportedBinary('sub/path/file.webm')).toBe(true);
    });
    it('rejeita extensões fora do escopo', () => {
      expect(isSupportedBinary('doc.epub')).toBe(false);
      expect(isSupportedBinary('archive.zip')).toBe(false);
      expect(isSupportedBinary('note.md')).toBe(false);
      expect(isSupportedBinary('no-extension')).toBe(false);
    });
  });

  describe('defaultCompanionPath', () => {
    it('appenda .md preservando extensão original', () => {
      expect(defaultCompanionPath('paper.pdf')).toBe('paper.pdf.md');
      expect(defaultCompanionPath('sub/img.png')).toBe('sub/img.png.md');
    });
  });

  describe('isCompanionPath', () => {
    it('detecta nomes no formato <basename>.<ext>.md quando ext é suportada', () => {
      expect(isCompanionPath('paper.pdf.md')).toBe(true);
      expect(isCompanionPath('sub/img.png.md')).toBe(true);
    });
    it('rejeita .md soltos ou extensão não suportada', () => {
      expect(isCompanionPath('note.md')).toBe(false);
      expect(isCompanionPath('arquivo.epub.md')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run pra ver fail**

Run: `npm test -- --run tests/utils/pathResolver.test.ts`
Expected: FAIL — "Cannot find module '../../src/utils/pathResolver'"

- [ ] **Step 3: Implementar `src/utils/pathResolver.ts`**

```typescript
// src/utils/pathResolver.ts
import { SUPPORTED_EXTENSIONS } from '../constants';

function getExtension(path: string): string | null {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return null;
  return path.slice(dot + 1).toLowerCase();
}

export function isSupportedBinary(path: string): boolean {
  const ext = getExtension(path);
  return ext !== null && SUPPORTED_EXTENSIONS.has(ext);
}

export function defaultCompanionPath(binaryPath: string): string {
  return `${binaryPath}.md`;
}

export function isCompanionPath(path: string): boolean {
  if (!path.endsWith('.md')) return false;
  const withoutMd = path.slice(0, -3);
  return isSupportedBinary(withoutMd);
}
```

- [ ] **Step 4: Run pra ver pass**

Run: `npm test -- --run tests/utils/pathResolver.test.ts`
Expected: PASS — todos os 7 cases

- [ ] **Step 5: Commit**

```bash
git add tests/utils/pathResolver.test.ts src/utils/pathResolver.ts
~/.claude/scripts/commit.sh "feat(utils): add pathResolver com isSupportedBinary, defaultCompanionPath, isCompanionPath"
```

---

### Task 6: CompanionRegistry — testes base (RED)

**Files:**
- Create: `tests/registry/companionRegistry.test.ts`

- [ ] **Step 1: Escrever testes do core do registry**

Referência: o registry adapta `src/core/caseVariables/caseVariablesRegistry.ts` do Qualia, especializa pra chave `binary:`. Patterns críticos a herdar (do Qualia):
- `writingInProgress` set anti-feedback-loop
- Initial scan deferido pra `onLayoutReady`
- Escrita via `fileManager.processFrontMatter`
- `migrateFilePath` em rename

```typescript
// tests/registry/companionRegistry.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';

describe('CompanionRegistry', () => {
  let registry: CompanionRegistry;
  let plugin: ReturnType<typeof createPlugin>;

  beforeEach(() => {
    plugin = createPlugin();
    registry = new CompanionRegistry(plugin.app);
  });

  describe('inicialização', () => {
    it('começa com índice vazio', () => {
      expect(registry.getCompanionFor('paper.pdf')).toBeNull();
      expect(registry.getBinaryFor('paper.pdf.md')).toBeNull();
    });

    it('initialize() varre vault e popula índice na onLayoutReady', async () => {
      plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();
      expect(registry.getCompanionFor('paper.pdf')).toBe('paper.pdf.md');
      expect(registry.getBinaryFor('paper.pdf.md')).toBe('paper.pdf');
    });
  });

  describe('lookup', () => {
    beforeEach(async () => {
      plugin.app.vault.__setFile('a.pdf.md', { binary: 'a.pdf' });
      plugin.app.vault.__setFile('b.png.md', { binary: 'b.png', visible: true });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();
    });

    it('getCompanionFor retorna path do companion', () => {
      expect(registry.getCompanionFor('a.pdf')).toBe('a.pdf.md');
      expect(registry.getCompanionFor('b.png')).toBe('b.png.md');
      expect(registry.getCompanionFor('z.pdf')).toBeNull();
    });

    it('getBinaryFor retorna path do binário', () => {
      expect(registry.getBinaryFor('a.pdf.md')).toBe('a.pdf');
    });

    it('isCompanionVisible respeita frontmatter `visible: true`', () => {
      expect(registry.isCompanionVisible('a.pdf.md')).toBe(false);
      expect(registry.isCompanionVisible('b.png.md')).toBe(true);
    });
  });

  describe('reativo a metadataCache changes', () => {
    it('detecta novo companion criado', async () => {
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();

      plugin.app.vault.__setFile('new.pdf.md', { binary: 'new.pdf' });
      plugin.app.metadataCache.__triggerChanged('new.pdf.md');

      expect(registry.getCompanionFor('new.pdf')).toBe('new.pdf.md');
    });

    it('remove entrada quando frontmatter binary: é deletado', async () => {
      plugin.app.vault.__setFile('a.pdf.md', { binary: 'a.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();

      plugin.app.vault.__setFile('a.pdf.md', {}); // frontmatter sem binary
      plugin.app.metadataCache.__triggerChanged('a.pdf.md');

      expect(registry.getCompanionFor('a.pdf')).toBeNull();
    });
  });

  describe('múltiplos companions pro mesmo binário (defensive)', () => {
    it('prefere o companion ao lado do binário', async () => {
      plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
      plugin.app.vault.__setFile('outro/paper.pdf.md', { binary: 'paper.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();
      expect(registry.getCompanionFor('paper.pdf')).toBe('paper.pdf.md');
    });

    it('fallback alfabético quando nenhum está ao lado', async () => {
      plugin.app.vault.__setFile('zz/paper.pdf.md', { binary: 'paper.pdf' });
      plugin.app.vault.__setFile('aa/paper.pdf.md', { binary: 'paper.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();
      expect(registry.getCompanionFor('paper.pdf')).toBe('aa/paper.pdf.md');
    });
  });

  describe('migrateFilePath', () => {
    it('atualiza índice quando companion é renomeado', async () => {
      plugin.app.vault.__setFile('old.pdf.md', { binary: 'paper.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();

      registry.migrateFilePath('old.pdf.md', 'new.pdf.md');

      expect(registry.getCompanionFor('paper.pdf')).toBe('new.pdf.md');
      expect(registry.getBinaryFor('old.pdf.md')).toBeNull();
      expect(registry.getBinaryFor('new.pdf.md')).toBe('paper.pdf');
    });
  });
});
```

- [ ] **Step 2: Run pra ver fail**

Run: `npm test -- --run tests/registry/companionRegistry.test.ts`
Expected: FAIL — "Cannot find module '../../src/registry/companionRegistry'"

- [ ] **Step 3: Confirmar que `pluginFactory` mock cobre os helpers usados**

Run: `grep -E '__setFile|__triggerLayoutReady|__triggerChanged' tests/obsidian.mock.ts tests/pluginFactory.ts`
Expected: ver os helpers `__setFile`, `__triggerLayoutReady`, `__triggerChanged`. Se faltarem, adicionar antes de implementar (extender `obsidian.mock.ts`).

---

### Task 7: CompanionRegistry — implementação (GREEN)

**Files:**
- Create: `src/registry/companionRegistry.ts`

- [ ] **Step 1: Implementar `src/registry/companionRegistry.ts`**

```typescript
// src/registry/companionRegistry.ts
import { App, EventRef, TFile } from 'obsidian';
import { FM_KEY_BINARY, FM_KEY_VISIBLE } from '../constants';
import type { RegistryMutationListener } from '../types';

interface CompanionMeta {
  companionPath: string;
  visible: boolean;
}

export class CompanionRegistry {
  // Map<binaryPath, CompanionMeta> — escolha já resolvida quando há múltiplos
  private byBinary = new Map<string, CompanionMeta>();
  // Map<companionPath, binaryPath> — reverse lookup
  private byCompanion = new Map<string, string>();
  // Pra resolver tie-break: Map<binaryPath, Set<companionPath>>
  private candidates = new Map<string, Set<string>>();

  private metadataCacheRef: EventRef | null = null;
  private writingInProgress = new Set<string>();
  private listeners = new Set<RegistryMutationListener>();

  constructor(private app: App) {}

  initialize(): void {
    this.metadataCacheRef = this.app.metadataCache.on('changed', (file: TFile) => {
      if (file.extension === 'md' && !this.writingInProgress.has(file.path)) {
        this.syncFromFrontmatter(file.path);
      }
    });

    // Initial scan deferido pra evitar deadlock no onload
    this.app.workspace.onLayoutReady(() => {
      for (const file of this.app.vault.getMarkdownFiles()) {
        this.syncFromFrontmatter(file.path);
      }
    });
  }

  unload(): void {
    if (this.metadataCacheRef) {
      this.app.metadataCache.offref(this.metadataCacheRef);
      this.metadataCacheRef = null;
    }
    this.listeners.clear();
  }

  getCompanionFor(binaryPath: string): string | null {
    return this.byBinary.get(binaryPath)?.companionPath ?? null;
  }

  getBinaryFor(companionPath: string): string | null {
    return this.byCompanion.get(companionPath) ?? null;
  }

  isCompanionVisible(companionPath: string): boolean {
    const binaryPath = this.byCompanion.get(companionPath);
    if (!binaryPath) return false;
    const meta = this.byBinary.get(binaryPath);
    return meta?.visible ?? false;
  }

  hasCompanion(binaryPath: string): boolean {
    return this.byBinary.has(binaryPath);
  }

  addOnMutate(fn: RegistryMutationListener): void {
    this.listeners.add(fn);
  }

  removeOnMutate(fn: RegistryMutationListener): void {
    this.listeners.delete(fn);
  }

  /** Marca writingInProgress antes de processFrontMatter; libera no próximo tick */
  beginWrite(companionPath: string): void {
    this.writingInProgress.add(companionPath);
  }

  endWrite(companionPath: string): void {
    setTimeout(() => this.writingInProgress.delete(companionPath), 0);
  }

  /** Re-vincula o índice quando um companion é renomeado */
  migrateFilePath(oldPath: string, newPath: string): void {
    const binaryPath = this.byCompanion.get(oldPath);
    if (!binaryPath) return;

    this.byCompanion.delete(oldPath);
    this.byCompanion.set(newPath, binaryPath);

    const set = this.candidates.get(binaryPath);
    if (set) {
      set.delete(oldPath);
      set.add(newPath);
    }

    const meta = this.byBinary.get(binaryPath);
    if (meta && meta.companionPath === oldPath) {
      this.byBinary.set(binaryPath, { ...meta, companionPath: newPath });
    }
    this.notify(binaryPath);
  }

  /** Lê o frontmatter do file e atualiza índice */
  private syncFromFrontmatter(companionPath: string): void {
    const file = this.app.vault.getAbstractFileByPath(companionPath);
    if (!(file instanceof TFile)) {
      this.handleCompanionRemoved(companionPath);
      return;
    }
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const binaryPath = fm[FM_KEY_BINARY];

    if (typeof binaryPath !== 'string') {
      this.handleCompanionRemoved(companionPath);
      return;
    }

    const visible = fm[FM_KEY_VISIBLE] === true;

    // Re-vincular: se companionPath já estava ligado a outro binário, limpar
    const previousBinary = this.byCompanion.get(companionPath);
    if (previousBinary && previousBinary !== binaryPath) {
      this.removeCandidate(previousBinary, companionPath);
    }

    this.byCompanion.set(companionPath, binaryPath);
    this.addCandidate(binaryPath, companionPath);
    this.resolveActive(binaryPath);
    void visible; // visible é resolvido dentro de resolveActive lendo FM novamente — single source of truth

    this.notify(binaryPath);
    if (previousBinary && previousBinary !== binaryPath) {
      this.notify(previousBinary);
    }
  }

  /** Chamado quando companion é deletado ou perdeu o frontmatter binary: */
  handleCompanionRemoved(companionPath: string): void {
    const binaryPath = this.byCompanion.get(companionPath);
    if (!binaryPath) return;
    this.byCompanion.delete(companionPath);
    this.removeCandidate(binaryPath, companionPath);
    this.resolveActive(binaryPath);
    this.notify(binaryPath);
  }

  private addCandidate(binaryPath: string, companionPath: string): void {
    let set = this.candidates.get(binaryPath);
    if (!set) {
      set = new Set();
      this.candidates.set(binaryPath, set);
    }
    set.add(companionPath);
  }

  private removeCandidate(binaryPath: string, companionPath: string): void {
    const set = this.candidates.get(binaryPath);
    if (!set) return;
    set.delete(companionPath);
    if (set.size === 0) this.candidates.delete(binaryPath);
  }

  /** Tie-break: prefere ao lado do binário, depois alfabético. Sempre re-lê visible do FM (sem shortcut hint). */
  private resolveActive(binaryPath: string): void {
    const set = this.candidates.get(binaryPath);
    if (!set || set.size === 0) {
      this.byBinary.delete(binaryPath);
      return;
    }
    const expected = `${binaryPath}.md`;
    let chosen: string;
    if (set.has(expected)) {
      chosen = expected;
    } else {
      chosen = [...set].sort()[0];
    }

    let visible = false;
    const file = this.app.vault.getAbstractFileByPath(chosen);
    if (file instanceof TFile) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      visible = fm[FM_KEY_VISIBLE] === true;
    }

    this.byBinary.set(binaryPath, { companionPath: chosen, visible });
  }

  private notify(binaryPath: string): void {
    const companionPath = this.getCompanionFor(binaryPath);
    for (const fn of this.listeners) fn(binaryPath, companionPath);
  }
}
```

- [ ] **Step 2: Run pra ver pass**

Run: `npm test -- --run tests/registry/companionRegistry.test.ts`
Expected: PASS — todos os cases

Se algum falhar: ler stderr cuidadosamente. Provável causa: helper de mock faltando em `pluginFactory.ts` ou `obsidian.mock.ts` — adicionar e re-rodar.

- [ ] **Step 3: Commit**

```bash
git add tests/registry/companionRegistry.test.ts src/registry/companionRegistry.ts
~/.claude/scripts/commit.sh "feat(registry): CompanionRegistry com tie-break (ao lado > alfabético) e reactive metadataCache"
```

---

## Chunk 3: Lifecycle e view base

### Task 8: VaultLifecycleHandler com TDD

**Files:**
- Create: `tests/lifecycle/vaultLifecycleHandler.test.ts`
- Create: `src/lifecycle/vaultLifecycleHandler.ts`

- [ ] **Step 1: Escrever testes (RED)**

```typescript
// tests/lifecycle/vaultLifecycleHandler.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { VaultLifecycleHandler } from '../../src/lifecycle/vaultLifecycleHandler';

describe('VaultLifecycleHandler', () => {
  let plugin: ReturnType<typeof createPlugin>;
  let registry: CompanionRegistry;
  let handler: VaultLifecycleHandler;

  beforeEach(async () => {
    plugin = createPlugin();
    registry = new CompanionRegistry(plugin.app);
    handler = new VaultLifecycleHandler(plugin.app, registry);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    handler.initialize();
    await plugin.app.workspace.__triggerLayoutReady();
  });

  describe('rename do binário', () => {
    it('atualiza binary: no companion', async () => {
      const fm: Record<string, unknown> = { binary: 'paper.pdf' };
      plugin.app.fileManager.__mockProcessFrontMatter('paper.pdf.md', fm);

      await plugin.app.vault.__triggerRename('paper.pdf', 'renamed.pdf');

      expect(fm.binary).toBe('renamed.pdf');
    });

    it('atualiza índice no registry', async () => {
      const fm: Record<string, unknown> = { binary: 'paper.pdf' };
      plugin.app.fileManager.__mockProcessFrontMatter('paper.pdf.md', fm);

      await plugin.app.vault.__triggerRename('paper.pdf', 'renamed.pdf');
      // Simula metadataCache sync após processFrontMatter
      plugin.app.vault.__setFile('paper.pdf.md', { binary: 'renamed.pdf' });
      plugin.app.metadataCache.__triggerChanged('paper.pdf.md');

      expect(registry.getCompanionFor('renamed.pdf')).toBe('paper.pdf.md');
      expect(registry.getCompanionFor('paper.pdf')).toBeNull();
    });
  });

  describe('delete do binário', () => {
    it('cascata: deleta o companion silenciosamente', async () => {
      const deleteSpy = vi.spyOn(plugin.app.vault, 'delete');
      await plugin.app.vault.__triggerDelete('paper.pdf');
      expect(deleteSpy).toHaveBeenCalledWith(expect.objectContaining({ path: 'paper.pdf.md' }));
    });

    it('não toca o binário quando o companion é deletado (não cascateia reverso)', async () => {
      const deleteSpy = vi.spyOn(plugin.app.vault, 'delete');
      await plugin.app.vault.__triggerDelete('paper.pdf.md');
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('rename do companion', () => {
    it('chama registry.migrateFilePath', async () => {
      const spy = vi.spyOn(registry, 'migrateFilePath');
      await plugin.app.vault.__triggerRename('paper.pdf.md', 'new.pdf.md');
      expect(spy).toHaveBeenCalledWith('paper.pdf.md', 'new.pdf.md');
    });
  });
});
```

- [ ] **Step 2: Run pra ver fail**

Run: `npm test -- --run tests/lifecycle/vaultLifecycleHandler.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar `src/lifecycle/vaultLifecycleHandler.ts`**

```typescript
// src/lifecycle/vaultLifecycleHandler.ts
import { App, EventRef, TFile, TAbstractFile } from 'obsidian';
import { FM_KEY_BINARY } from '../constants';
import { isSupportedBinary, isCompanionPath } from '../utils/pathResolver';
import { CompanionRegistry } from '../registry/companionRegistry';

export class VaultLifecycleHandler {
  private renameRef: EventRef | null = null;
  private deleteRef: EventRef | null = null;

  constructor(
    private app: App,
    private registry: CompanionRegistry,
  ) {}

  initialize(): void {
    this.renameRef = this.app.vault.on('rename', (file, oldPath) => {
      this.handleRename(file, oldPath);
    });
    this.deleteRef = this.app.vault.on('delete', (file) => {
      this.handleDelete(file);
    });
  }

  unload(): void {
    if (this.renameRef) this.app.vault.offref(this.renameRef);
    if (this.deleteRef) this.app.vault.offref(this.deleteRef);
  }

  private async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    if (!(file instanceof TFile)) return;

    // Companion renomeado → atualizar índice
    if (isCompanionPath(oldPath)) {
      this.registry.migrateFilePath(oldPath, file.path);
      return;
    }

    // Binário renomeado → atualizar `binary:` no companion correspondente
    if (isSupportedBinary(oldPath)) {
      const companionPath = this.registry.getCompanionFor(oldPath);
      if (!companionPath) return;
      const companionFile = this.app.vault.getAbstractFileByPath(companionPath);
      if (!(companionFile instanceof TFile)) return;

      this.registry.beginWrite(companionPath);
      try {
        await this.app.fileManager.processFrontMatter(companionFile, (fm) => {
          fm[FM_KEY_BINARY] = file.path;
        });
      } finally {
        this.registry.endWrite(companionPath);
      }
    }
  }

  private async handleDelete(file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile)) return;

    // Companion deletado → registry cleanup acontece via metadataCache
    if (isCompanionPath(file.path)) {
      this.registry.handleCompanionRemoved(file.path);
      return;
    }

    // Binário deletado → cascade no companion
    if (isSupportedBinary(file.path)) {
      const companionPath = this.registry.getCompanionFor(file.path);
      if (!companionPath) return;
      const companionFile = this.app.vault.getAbstractFileByPath(companionPath);
      if (companionFile instanceof TFile) {
        await this.app.vault.delete(companionFile);
      }
    }
  }
}
```

- [ ] **Step 4: Run pra ver pass**

Run: `npm test -- --run tests/lifecycle/vaultLifecycleHandler.test.ts`
Expected: PASS — todos os cases

- [ ] **Step 5: Commit**

```bash
git add tests/lifecycle/vaultLifecycleHandler.test.ts src/lifecycle/vaultLifecycleHandler.ts
~/.claude/scripts/commit.sh "feat(lifecycle): rename propaga binary:, delete cascateia binário→companion"
```

---

### Task 9: BinaryNotesView base

**Files:**
- Create: `tests/view/binaryNotesView.test.ts`
- Create: `src/view/binaryNotesView.ts`

A view é `ItemView` própria, **preview-only** nessa primeira versão. Recebe `companionPath` via state. Renderiza header + embed `![[binaryPath]]` + body do companion via `MarkdownRenderer.render`.

- [ ] **Step 1: Escrever testes mínimos (RED)**

```typescript
// tests/view/binaryNotesView.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { BinaryNotesView } from '../../src/view/binaryNotesView';
import { BINARY_NOTES_VIEW_TYPE } from '../../src/constants';

describe('BinaryNotesView', () => {
  let plugin: ReturnType<typeof createPlugin>;
  let registry: CompanionRegistry;
  let leaf: any;

  beforeEach(async () => {
    plugin = createPlugin();
    registry = new CompanionRegistry(plugin.app);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' }, 'md', 'meu body');
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();
    leaf = plugin.app.workspace.__createLeaf();
  });

  it('expõe view type correto', () => {
    const view = new BinaryNotesView(leaf, registry);
    expect(view.getViewType()).toBe(BINARY_NOTES_VIEW_TYPE);
  });

  it('display name reflete companion carregado', async () => {
    const view = new BinaryNotesView(leaf, registry);
    await view.setState({ companionPath: 'paper.pdf.md' }, { history: false });
    expect(view.getDisplayText()).toContain('paper.pdf');
  });

  it('renderiza embed do binário e body do companion via MarkdownRenderer', async () => {
    const renderSpy = vi.spyOn(plugin.app.MarkdownRenderer, 'render');
    const view = new BinaryNotesView(leaf, registry);
    await view.setState({ companionPath: 'paper.pdf.md' }, { history: false });
    await view.onOpen();

    // Deve ter chamado render com embed `![[paper.pdf]]` + body
    expect(renderSpy).toHaveBeenCalled();
    const markdownArgs = renderSpy.mock.calls.map((c) => c[1]).join('\n');
    expect(markdownArgs).toContain('![[paper.pdf]]');
    expect(markdownArgs).toContain('meu body');
  });

  it('lida graciosamente com companion deletado durante view aberta', async () => {
    const view = new BinaryNotesView(leaf, registry);
    await view.setState({ companionPath: 'paper.pdf.md' }, { history: false });
    await view.onOpen();

    // simula delete
    plugin.app.vault.__deleteFile('paper.pdf.md');
    plugin.app.vault.__triggerDelete('paper.pdf.md');
    await Promise.resolve();
    // Não deve lançar; pode chamar leaf.detach()
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run pra ver fail**

Run: `npm test -- --run tests/view/binaryNotesView.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar `src/view/binaryNotesView.ts`**

```typescript
// src/view/binaryNotesView.ts
import {
  ItemView,
  WorkspaceLeaf,
  MarkdownRenderer,
  TFile,
  ViewStateResult,
  EventRef,
} from 'obsidian';
import { BINARY_NOTES_VIEW_TYPE } from '../constants';
import { CompanionRegistry } from '../registry/companionRegistry';

interface BinaryNotesViewState {
  companionPath: string;
}

export class BinaryNotesView extends ItemView {
  private companionPath: string | null = null;
  private deleteRef: EventRef | null = null;

  constructor(leaf: WorkspaceLeaf, private registry: CompanionRegistry) {
    super(leaf);
  }

  getViewType(): string {
    return BINARY_NOTES_VIEW_TYPE;
  }

  getDisplayText(): string {
    if (!this.companionPath) return 'Binary Notes';
    const binary = this.registry.getBinaryFor(this.companionPath);
    return binary ? `Notes: ${binary}` : this.companionPath;
  }

  getIcon(): string {
    return 'file-symlink';
  }

  async setState(state: BinaryNotesViewState, result: ViewStateResult): Promise<void> {
    this.companionPath = state.companionPath;
    await super.setState(state, result);
    // Sempre renderiza — não condicionar em isShown (frágil em jsdom e em runtime real conforme ordem setState/onOpen)
    await this.render();
  }

  getState(): Record<string, unknown> {
    return { ...super.getState(), companionPath: this.companionPath };
  }

  async onOpen(): Promise<void> {
    this.deleteRef = this.app.vault.on('delete', (file) => {
      if (file.path === this.companionPath) {
        this.leaf.detach();
      }
    });
    await this.render();
  }

  async onClose(): Promise<void> {
    if (this.deleteRef) this.app.vault.offref(this.deleteRef);
    this.contentEl.empty();
  }

  private async render(): Promise<void> {
    this.contentEl.empty();
    if (!this.companionPath) {
      this.contentEl.createDiv({ text: 'No companion loaded.' });
      return;
    }
    const binaryPath = this.registry.getBinaryFor(this.companionPath);
    if (!binaryPath) {
      this.contentEl.createDiv({ text: `Binary not found for ${this.companionPath}` });
      return;
    }

    const wrapper = this.contentEl.createDiv({ cls: 'binary-notes-view' });

    // Embed do binário
    const embedHost = wrapper.createDiv({ cls: 'binary-notes-embed' });
    await MarkdownRenderer.render(
      this.app,
      `![[${binaryPath}]]`,
      embedHost,
      this.companionPath,
      this,
    );

    // Body do companion
    const file = this.app.vault.getAbstractFileByPath(this.companionPath);
    if (file instanceof TFile) {
      const body = await this.readBodyWithoutFrontmatter(file);
      if (body.trim().length > 0) {
        const noteHost = wrapper.createDiv({ cls: 'binary-notes-companion' });
        await MarkdownRenderer.render(this.app, body, noteHost, this.companionPath, this);
      }
    }
  }

  private async readBodyWithoutFrontmatter(file: TFile): Promise<string> {
    const raw = await this.app.vault.cachedRead(file);
    // strip YAML frontmatter (--- ... ---)
    if (raw.startsWith('---')) {
      const end = raw.indexOf('\n---', 3);
      if (end !== -1) return raw.slice(end + 4).replace(/^\n+/, '');
    }
    return raw;
  }
}
```

- [ ] **Step 4: Run pra ver pass**

Run: `npm test -- --run tests/view/binaryNotesView.test.ts`
Expected: PASS — todos os cases. Pode precisar ajustar mocks do `MarkdownRenderer` em `obsidian.mock.ts` (expor `render` mockable como spy).

- [ ] **Step 5: Commit**

```bash
git add tests/view/binaryNotesView.test.ts src/view/binaryNotesView.ts
~/.claude/scripts/commit.sh "feat(view): BinaryNotesView preview-only com embed nativo + body do companion"
```

---

### Task 10: Header action — Toggle source view (com WeakMap detach anti hot-reload)

**Files:**
- Create: `src/view/headerActions.ts`
- Modify: `src/view/binaryNotesView.ts` (chama `mountHeaderActions` no `onOpen` e `detachHeaderActions` no `onClose`; expõe `registry` publicamente)
- Modify: `tests/view/binaryNotesView.test.ts` (adiciona teste de hot-reload)

Gotcha crítico (Qualia §19.5): `view.addAction` retorna um element mas Obsidian **não** limpa no `onunload` da view. Hot-reload duplica buttons. Pattern: WeakMap<View, Set<HTMLElement>> + detach manual no `onClose`.

- [ ] **Step 1: Adicionar teste de hot-reload (RED)**

Adicione em `tests/view/binaryNotesView.test.ts`:

```typescript
it('detach manual previne duplicação em hot-reload', async () => {
  const view = new BinaryNotesView(leaf, registry);
  await view.setState({ companionPath: 'paper.pdf.md' }, { history: false });
  await view.onOpen();
  await view.onClose();
  // Re-mount (simula hot-reload)
  await view.onOpen();
  await view.onClose();
  // Não deve haver actions duplicadas no leaf
  expect(leaf.__getActions().length).toBeLessThanOrEqual(1);
});
```

Run: `npm test -- --run tests/view/binaryNotesView.test.ts`
Expected: FAIL — porque `BinaryNotesView` ainda não chama `mountHeaderActions`.

- [ ] **Step 2: Implementar `src/view/headerActions.ts`**

```typescript
// src/view/headerActions.ts
import { ItemView, TFile } from 'obsidian';
import { BinaryNotesView } from './binaryNotesView';

const headerActionsByView = new WeakMap<ItemView, Set<HTMLElement>>();

export function mountHeaderActions(view: BinaryNotesView): void {
  detachHeaderActions(view); // safety: limpa antes de adicionar
  const set = new Set<HTMLElement>();

  const toggleEl = view.addAction(
    'file-symlink',
    'Toggle source view',
    () => {
      void openSource(view);
    },
  );
  set.add(toggleEl);

  headerActionsByView.set(view, set);
}

export function detachHeaderActions(view: ItemView): void {
  const set = headerActionsByView.get(view);
  if (!set) return;
  for (const el of set) el.detach();
  headerActionsByView.delete(view);
}

async function openSource(view: BinaryNotesView): Promise<void> {
  const companionPath = (view.getState() as { companionPath?: string }).companionPath;
  if (!companionPath) return;
  const binaryPath = view.registry.getBinaryFor(companionPath);
  if (!binaryPath) return;
  const binaryFile = view.app.vault.getAbstractFileByPath(binaryPath);
  if (!(binaryFile instanceof TFile)) return;
  // openFile na mesma leaf delega ao viewer default registrado (PDF++ se instalado, senão nativo).
  // Custo conhecido: usuário não tem botão de "voltar pra Binary Notes" depois — clique no binário no
  // explorer reabre a custom view (via ClickInterceptor).
  await view.leaf.openFile(binaryFile);
}
```

- [ ] **Step 3: Modificar `src/view/binaryNotesView.ts` (diff exato)**

Aplique três mudanças:

1. Promover `registry` a campo público no construtor:

```diff
- constructor(leaf: WorkspaceLeaf, private registry: CompanionRegistry) {
+ constructor(leaf: WorkspaceLeaf, public readonly registry: CompanionRegistry) {
    super(leaf);
  }
```

(`app` já é herdado público de `ItemView`, não precisa mexer.)

2. Importar e chamar `mountHeaderActions` no `onOpen`:

```diff
+ import { mountHeaderActions, detachHeaderActions } from './headerActions';
  ...
  async onOpen(): Promise<void> {
+   mountHeaderActions(this);
    this.deleteRef = this.app.vault.on('delete', (file) => {
      if (file.path === this.companionPath) {
        this.leaf.detach();
      }
    });
    await this.render();
  }
```

3. Chamar `detachHeaderActions` no `onClose` ANTES do cleanup do deleteRef:

```diff
  async onClose(): Promise<void> {
+   detachHeaderActions(this);
    if (this.deleteRef) this.app.vault.offref(this.deleteRef);
    this.contentEl.empty();
  }
```

- [ ] **Step 4: Run testes (GREEN)**

Run: `npm test -- --run tests/view/binaryNotesView.test.ts`
Expected: PASS — todos os cases incluindo o de hot-reload.

- [ ] **Step 5: Commit**

```bash
git add src/view/headerActions.ts src/view/binaryNotesView.ts tests/view/binaryNotesView.test.ts
~/.claude/scripts/commit.sh "feat(view): header action 'Toggle source view' com WeakMap detach anti hot-reload"
```

---

## Chunk 4: Intercept e explorer decorator

### Task 11: ClickInterceptor (caminho primário)

**Files:**
- Create: `tests/intercept/clickInterceptor.test.ts`
- Create: `src/intercept/clickInterceptor.ts`

- [ ] **Step 1: Escrever testes (RED)**

```typescript
// tests/intercept/clickInterceptor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { ClickInterceptor } from '../../src/intercept/clickInterceptor';
import { BINARY_NOTES_VIEW_TYPE } from '../../src/constants';

describe('ClickInterceptor', () => {
  let plugin: ReturnType<typeof createPlugin>;
  let registry: CompanionRegistry;
  let interceptor: ClickInterceptor;

  beforeEach(async () => {
    plugin = createPlugin();
    registry = new CompanionRegistry(plugin.app);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    plugin.app.vault.__setFile('zz.png', null, 'binary'); // sem companion
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();
    interceptor = new ClickInterceptor(plugin.app, registry, plugin);
    interceptor.initialize();
  });

  it('intercepta click em binário com companion', () => {
    const event = createExplorerClickEvent('paper.pdf');
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('não intercepta click em binário sem companion', () => {
    const event = createExplorerClickEvent('zz.png');
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('abre custom view via leaf.setViewState com companionPath', async () => {
    const setSpy = vi.spyOn(plugin.app.workspace, 'getLeaf');
    const event = createExplorerClickEvent('paper.pdf');
    document.dispatchEvent(event);
    await Promise.resolve();
    // Verifica que algum leaf abriu view do tipo BINARY_NOTES_VIEW_TYPE
    const opened = plugin.app.workspace.__getLastSetViewState();
    expect(opened?.type).toBe(BINARY_NOTES_VIEW_TYPE);
    expect(opened?.state).toMatchObject({ companionPath: 'paper.pdf.md' });
  });
});

function createExplorerClickEvent(filePath: string): MouseEvent {
  const item = document.createElement('div');
  item.classList.add('nav-file-title');
  item.setAttribute('data-path', filePath);
  document.body.appendChild(item);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: item, writable: false });
  return event;
}
```

- [ ] **Step 2: Run pra ver fail**

Run: `npm test -- --run tests/intercept/clickInterceptor.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar `src/intercept/clickInterceptor.ts`**

```typescript
// src/intercept/clickInterceptor.ts
import { App, Plugin, TFile } from 'obsidian';
import { isSupportedBinary } from '../utils/pathResolver';
import { CompanionRegistry } from '../registry/companionRegistry';
import { BINARY_NOTES_VIEW_TYPE } from '../constants';

export class ClickInterceptor {
  private listener: ((evt: MouseEvent) => void) | null = null;

  constructor(
    private app: App,
    private registry: CompanionRegistry,
    private plugin: Plugin,
  ) {}

  initialize(): void {
    this.listener = (evt: MouseEvent) => this.handle(evt);
    this.plugin.registerDomEvent(document, 'click', this.listener, true);
  }

  unload(): void {
    // registerDomEvent cleanup é automático no plugin unload
    this.listener = null;
  }

  private handle(evt: MouseEvent): void {
    const target = evt.target;
    if (!(target instanceof HTMLElement)) return;
    const item = target.closest('.nav-file-title');
    if (!item) return;
    const path = item.getAttribute('data-path');
    if (!path || !isSupportedBinary(path)) return;
    const companionPath = this.registry.getCompanionFor(path);
    if (!companionPath) return;

    evt.preventDefault();
    evt.stopImmediatePropagation();
    void this.openCustomView(companionPath);
  }

  private async openCustomView(companionPath: string): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.setViewState({
      type: BINARY_NOTES_VIEW_TYPE,
      state: { companionPath },
      active: true,
    });
  }
}
```

- [ ] **Step 4: Run pra ver pass**

Run: `npm test -- --run tests/intercept/clickInterceptor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/intercept/clickInterceptor.test.ts src/intercept/clickInterceptor.ts
~/.claude/scripts/commit.sh "feat(intercept): ClickInterceptor capture phase para binários com companion"
```

---

### Task 12: ViewSwapper (active-leaf-change fallback)

**Files:**
- Create: `tests/intercept/viewSwapper.test.ts`
- Create: `src/intercept/viewSwapper.ts`

Caminho de fallback pra abertura de binário fora do explorer (drag/drop, comando do Obsidian, click em wikilink em outra nota). Tem flicker breve (Qualia §8.6) — aceito.

- [ ] **Step 1: Escrever testes (RED)**

```typescript
// tests/intercept/viewSwapper.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { ViewSwapper } from '../../src/intercept/viewSwapper';
import { BINARY_NOTES_VIEW_TYPE } from '../../src/constants';

describe('ViewSwapper', () => {
  it('faz setViewState quando active leaf abre binário com companion', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const swapper = new ViewSwapper(plugin.app, registry);
    swapper.initialize();

    const leaf = plugin.app.workspace.__createLeafWithFile('paper.pdf', 'pdf');
    await plugin.app.workspace.__triggerActiveLeafChange(leaf);
    await Promise.resolve();

    const last = plugin.app.workspace.__getLastSetViewState();
    expect(last?.type).toBe(BINARY_NOTES_VIEW_TYPE);
  });

  it('não re-dispara quando já está em BinaryNotesView (evita loop)', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const swapper = new ViewSwapper(plugin.app, registry);
    swapper.initialize();

    const leaf = plugin.app.workspace.__createLeafWithViewType(BINARY_NOTES_VIEW_TYPE);
    plugin.app.workspace.__resetSetViewStateLog();
    await plugin.app.workspace.__triggerActiveLeafChange(leaf);

    expect(plugin.app.workspace.__getLastSetViewState()).toBeNull();
  });
});
```

- [ ] **Step 2: Run pra ver fail**

Run: `npm test -- --run tests/intercept/viewSwapper.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar `src/intercept/viewSwapper.ts`**

```typescript
// src/intercept/viewSwapper.ts
import { App, EventRef, FileView, WorkspaceLeaf } from 'obsidian';
import { isSupportedBinary } from '../utils/pathResolver';
import { CompanionRegistry } from '../registry/companionRegistry';
import { BINARY_NOTES_VIEW_TYPE } from '../constants';

export class ViewSwapper {
  private ref: EventRef | null = null;
  private swapping = new WeakSet<WorkspaceLeaf>();

  constructor(
    private app: App,
    private registry: CompanionRegistry,
  ) {}

  initialize(): void {
    this.ref = this.app.workspace.on('active-leaf-change', (leaf) => {
      if (!leaf) return;
      if (this.swapping.has(leaf)) return;
      void this.maybeSwap(leaf);
    });
  }

  unload(): void {
    if (this.ref) this.app.workspace.offref(this.ref);
  }

  private async maybeSwap(leaf: WorkspaceLeaf): Promise<void> {
    const view = leaf.view;
    if (!(view instanceof FileView)) return;
    const file = view.file;
    if (!file || !isSupportedBinary(file.path)) return;
    if (view.getViewType() === BINARY_NOTES_VIEW_TYPE) return;
    const companionPath = this.registry.getCompanionFor(file.path);
    if (!companionPath) return;

    this.swapping.add(leaf);
    try {
      await leaf.setViewState({
        type: BINARY_NOTES_VIEW_TYPE,
        state: { companionPath },
        active: true,
      });
    } finally {
      // Liberar no próximo tick (após active-leaf-change novo disparar)
      setTimeout(() => this.swapping.delete(leaf), 0);
    }
  }
}
```

- [ ] **Step 4: Run pra ver pass**

Run: `npm test -- --run tests/intercept/viewSwapper.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/intercept/viewSwapper.test.ts src/intercept/viewSwapper.ts
~/.claude/scripts/commit.sh "feat(intercept): ViewSwapper como fallback pra abertura fora do explorer"
```

---

### Task 13: ExplorerDecorator (underline + hide via CSS classes)

**Files:**
- Create: `tests/explorer/explorerDecorator.test.ts`
- Create: `src/explorer/explorerDecorator.ts`
- Modify: `styles.css`

Pattern: classes CSS no `body` (`.hide-binary-companion`) e nos items do explorer (`.is-binary-companion`, `.has-binary-companion`). MutationObserver pra lazy render. Re-aplica em mudanças do registry. Usa `plugin.registerInterval` pro retry de boot (evita leak se o explorer demora a aparecer ou plugin é desabilitado).

- [ ] **Step 1: Escrever testes (RED)**

Crie `tests/explorer/explorerDecorator.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { ExplorerDecorator } from '../../src/explorer/explorerDecorator';
import { CSS_CLASSES } from '../../src/constants';

describe('ExplorerDecorator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('aplica classe has-binary-companion no item do binário', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const item = document.createElement('div');
    item.classList.add('nav-file-title');
    item.setAttribute('data-path', 'paper.pdf');
    document.body.appendChild(item);

    const decorator = new ExplorerDecorator(plugin, registry);
    decorator.initialize(true);
    await plugin.app.workspace.__triggerLayoutReady();
    decorator.refresh();

    expect(item.classList.contains(CSS_CLASSES.itemHasCompanion)).toBe(true);
  });

  it('marca companion com is-binary-companion quando não tem visible:true', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const item = document.createElement('div');
    item.classList.add('nav-file-title');
    item.setAttribute('data-path', 'paper.pdf.md');
    document.body.appendChild(item);

    const decorator = new ExplorerDecorator(plugin, registry);
    decorator.initialize(true);
    decorator.refresh();

    expect(item.classList.contains(CSS_CLASSES.itemIsCompanion)).toBe(true);
  });

  it('não marca companion com visible:true', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf', visible: true });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const item = document.createElement('div');
    item.classList.add('nav-file-title');
    item.setAttribute('data-path', 'paper.pdf.md');
    document.body.appendChild(item);

    const decorator = new ExplorerDecorator(plugin, registry);
    decorator.initialize(true);
    decorator.refresh();

    expect(item.classList.contains(CSS_CLASSES.itemIsCompanion)).toBe(false);
  });

  it('setHide(true) aplica body class, setHide(false) remove', () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app);
    const decorator = new ExplorerDecorator(plugin, registry);
    decorator.initialize(false);
    expect(document.body.classList.contains(CSS_CLASSES.bodyHide)).toBe(false);
    decorator.setHide(true);
    expect(document.body.classList.contains(CSS_CLASSES.bodyHide)).toBe(true);
    decorator.setHide(false);
    expect(document.body.classList.contains(CSS_CLASSES.bodyHide)).toBe(false);
  });
});
```

Run: `npm test -- --run tests/explorer/`
Expected: FAIL — módulo não existe

- [ ] **Step 2: Implementar `src/explorer/explorerDecorator.ts`**

Construtor recebe `Plugin` (não `App`) pra usar `plugin.registerInterval` no retry — evita leak se o decorator é unloaded antes do explorer aparecer.

```typescript
// src/explorer/explorerDecorator.ts
import { App, EventRef, Plugin } from 'obsidian';
import { CSS_CLASSES } from '../constants';
import { CompanionRegistry } from '../registry/companionRegistry';

export class ExplorerDecorator {
  private observer: MutationObserver | null = null;
  private layoutRef: EventRef | null = null;
  private app: App;

  constructor(
    private plugin: Plugin,
    private registry: CompanionRegistry,
  ) {
    this.app = plugin.app;
  }

  initialize(hideCompanions: boolean): void {
    this.applyBodyHideClass(hideCompanions);
    this.registry.addOnMutate(() => this.refresh());

    this.app.workspace.onLayoutReady(() => {
      this.refresh();
      this.startObserver();
    });

    this.layoutRef = this.app.workspace.on('layout-change', () => this.refresh());
  }

  unload(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.layoutRef) this.app.workspace.offref(this.layoutRef);
    this.removeAllClasses();
  }

  setHide(hide: boolean): void {
    this.applyBodyHideClass(hide);
  }

  private applyBodyHideClass(hide: boolean): void {
    document.body.classList.toggle(CSS_CLASSES.bodyHide, hide);
  }

  private startObserver(): void {
    const explorer = this.findExplorerEl();
    if (explorer) {
      this.attachObserver(explorer);
      return;
    }
    // retry: 5x500ms via registerInterval (Plugin gerencia clear no unload)
    let tries = 0;
    const intv = window.setInterval(() => {
      tries++;
      const el = this.findExplorerEl();
      if (el) {
        window.clearInterval(intv);
        this.attachObserver(el);
      } else if (tries >= 5) {
        window.clearInterval(intv);
      }
    }, 500);
    this.plugin.registerInterval(intv);
  }

  private attachObserver(root: HTMLElement): void {
    this.observer = new MutationObserver(() => this.refresh());
    this.observer.observe(root, { childList: true, subtree: true });
  }

  private findExplorerEl(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      '.workspace-leaf-content[data-type="file-explorer"] .nav-files-container',
    );
  }

  refresh(): void {
    // Escopa em .nav-files-container quando disponível pra evitar items fantasma de outras leafs
    const root = this.findExplorerEl() ?? document;
    const items = root.querySelectorAll<HTMLElement>('.nav-file-title[data-path]');
    items.forEach((item) => {
      const path = item.getAttribute('data-path');
      if (!path) return;

      const isCompanion = !!this.registry.getBinaryFor(path);
      const visibleOverride = isCompanion && this.registry.isCompanionVisible(path);
      // Marca como companion só se NÃO tem visible:true override
      item.classList.toggle(CSS_CLASSES.itemIsCompanion, isCompanion && !visibleOverride);

      const hasCompanion = this.registry.hasCompanion(path);
      item.classList.toggle(CSS_CLASSES.itemHasCompanion, hasCompanion);
    });
  }

  private removeAllClasses(): void {
    document.body.classList.remove(CSS_CLASSES.bodyHide);
    document
      .querySelectorAll<HTMLElement>(
        `.${CSS_CLASSES.itemIsCompanion}, .${CSS_CLASSES.itemHasCompanion}`,
      )
      .forEach((el) => {
        el.classList.remove(CSS_CLASSES.itemIsCompanion, CSS_CLASSES.itemHasCompanion);
      });
  }
}
```

- [ ] **Step 3: Modificar `styles.css`**

```css
/* styles.css */

/* Hide companions quando body tem .hide-binary-companion */
body.hide-binary-companion .nav-file-title.is-binary-companion {
  display: none;
}

/* Underline em binários que têm companion */
.nav-file-title.has-binary-companion {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: var(--text-accent);
  text-underline-offset: 2px;
}

/* View styles */
.binary-notes-view {
  display: flex;
  flex-direction: column;
  gap: var(--size-4-3);
  padding: var(--size-4-2);
}

.binary-notes-embed {
  width: 100%;
  min-height: 50vh;
}

.binary-notes-embed iframe,
.binary-notes-embed img,
.binary-notes-embed video,
.binary-notes-embed audio,
.binary-notes-embed .pdf-embed {
  width: 100%;
  max-width: 100%;
}

.binary-notes-companion {
  border-top: 1px solid var(--background-modifier-border);
  padding-top: var(--size-4-2);
}
```

- [ ] **Step 4: Run testes (GREEN)**

Run: `npm test -- --run tests/explorer/`
Expected: PASS — todos os 4 cases

- [ ] **Step 5: Commit**

```bash
git add tests/explorer/ src/explorer/ styles.css
~/.claude/scripts/commit.sh "feat(explorer): underline + hide via CSS classes + MutationObserver lazy render"
```

---

## Chunk 5: Comandos, settings, wiring final, manual tests

### Task 14: Commands — Add Binary Notes + Toggle source view

**Files:**
- Create: `src/commands/commands.ts`

- [ ] **Step 1: Implementar `src/commands/commands.ts`**

```typescript
// src/commands/commands.ts
import { App, Notice, Plugin, TFile, TFolder, Menu } from 'obsidian';
import { isSupportedBinary, defaultCompanionPath } from '../utils/pathResolver';
import { CompanionRegistry } from '../registry/companionRegistry';
import {
  BINARY_NOTES_VIEW_TYPE,
  CMD_ADD_BINARY_NOTES,
  CMD_TOGGLE_SOURCE,
  FM_KEY_BINARY,
} from '../constants';
import type { BinaryNotesSettings } from '../settings/settings';

export function registerCommands(
  plugin: Plugin,
  app: App,
  registry: CompanionRegistry,
  getSettings: () => BinaryNotesSettings,
): void {
  // Comando "Add Binary Notes" — acessível via menu de contexto e palette
  plugin.addCommand({
    id: CMD_ADD_BINARY_NOTES,
    name: 'Add Binary Notes',
    checkCallback: (checking) => {
      const file = app.workspace.getActiveFile();
      const ok = file !== null && isSupportedBinary(file.path);
      if (checking) return ok;
      if (!file) return false;
      void addOrOpen(plugin, app, registry, getSettings, file);
      return true;
    },
  });

  plugin.addCommand({
    id: CMD_TOGGLE_SOURCE,
    name: 'Toggle source view',
    checkCallback: (checking) => {
      const leaf = app.workspace.getActiveLeaf();
      const inOurView = leaf?.view?.getViewType?.() === BINARY_NOTES_VIEW_TYPE;
      if (checking) return inOurView;
      if (!inOurView || !leaf) return false;
      const state = leaf.view?.getState?.() as { companionPath?: string } | undefined;
      const companionPath = state?.companionPath;
      if (!companionPath) return false;
      const binaryPath = registry.getBinaryFor(companionPath);
      if (!binaryPath) return false;
      const binaryFile = app.vault.getAbstractFileByPath(binaryPath);
      if (binaryFile instanceof TFile) void leaf.openFile(binaryFile);
      return true;
    },
  });

  // Menu de contexto no item do file explorer
  plugin.registerEvent(
    app.workspace.on('file-menu', (menu: Menu, file) => {
      if (!(file instanceof TFile)) return;
      if (!isSupportedBinary(file.path)) return;
      menu.addItem((item) => {
        item
          .setTitle(registry.hasCompanion(file.path) ? 'Open Binary Notes' : 'Add Binary Notes')
          .setIcon('file-symlink')
          .onClick(() => void addOrOpen(plugin, app, registry, getSettings, file));
      });
    }),
  );
}

async function addOrOpen(
  plugin: Plugin,
  app: App,
  registry: CompanionRegistry,
  getSettings: () => BinaryNotesSettings,
  binaryFile: TFile,
): Promise<void> {
  let companionPath = registry.getCompanionFor(binaryFile.path);

  if (!companionPath) {
    companionPath = defaultCompanionPath(binaryFile.path);
    const templatePath = getSettings().companionTemplatePath.trim();
    let body = '';
    if (templatePath) {
      const tplFile = app.vault.getAbstractFileByPath(templatePath);
      if (tplFile instanceof TFile) {
        body = await app.vault.cachedRead(tplFile);
        // strip frontmatter do template (se houver) — vamos prepender o nosso
        if (body.startsWith('---')) {
          const end = body.indexOf('\n---', 3);
          if (end !== -1) body = body.slice(end + 4).replace(/^\n+/, '');
        }
      } else {
        new Notice(`Template not found: ${templatePath}`);
      }
    }
    const initial = `---\n${FM_KEY_BINARY}: ${binaryFile.path}\n---\n${body}`;
    await app.vault.create(companionPath, initial);
  }

  const leaf = app.workspace.getLeaf(false);
  await leaf.setViewState({
    type: BINARY_NOTES_VIEW_TYPE,
    state: { companionPath },
    active: true,
  });
}
```

- [ ] **Step 2: Smoke test em `tests/commands/commands.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { registerCommands } from '../../src/commands/commands';
import { DEFAULT_SETTINGS } from '../../src/settings/settings';

describe('commands', () => {
  it('Add Binary Notes cria companion ao lado do binário com frontmatter binary:', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    registerCommands(plugin, plugin.app, registry, () => DEFAULT_SETTINGS);

    plugin.app.workspace.__setActiveFile('paper.pdf');
    await plugin.__runCommand('add-binary-notes');

    const created = plugin.app.vault.__getFile('paper.pdf.md');
    expect(created).toBeDefined();
    expect(created.content).toMatch(/binary: paper\.pdf/);
  });

  it('Add Binary Notes em binário com companion existente abre o existente em vez de criar novo', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    registerCommands(plugin, plugin.app, registry, () => DEFAULT_SETTINGS);
    plugin.app.workspace.__setActiveFile('paper.pdf');
    const createSpy = vi.spyOn(plugin.app.vault, 'create');
    await plugin.__runCommand('add-binary-notes');
    expect(createSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run testes**

Run: `npm test -- --run tests/commands/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/commands/ tests/commands/
~/.claude/scripts/commit.sh "feat(commands): Add Binary Notes (idempotente) e Toggle source view"
```

---

### Task 15: SettingsTab

**Files:**
- Create: `src/settings/settingsTab.ts`

- [ ] **Step 1: Implementar `src/settings/settingsTab.ts`**

```typescript
// src/settings/settingsTab.ts
import { App, PluginSettingTab, Setting } from 'obsidian';
import type BinaryNotesPlugin from '../main';

export class BinaryNotesSettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: BinaryNotesPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Hide companions in file explorer')
      .setDesc(
        'When ON, companion notes are hidden from the explorer. ' +
        'Add `visible: true` in a companion frontmatter to expose it individually.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.hideCompanions).onChange(async (value) => {
          this.plugin.settings.hideCompanions = value;
          await this.plugin.saveSettings();
          this.plugin.explorerDecorator?.setHide(value);
        }),
      );

    new Setting(containerEl)
      .setName('Companion template')
      .setDesc(
        'Optional path to a `.md` file used as initial body when a new companion is created. ' +
        'Frontmatter from the template is stripped — Binary Notes prepends its own `binary:` key.',
      )
      .addText((text) =>
        text
          .setPlaceholder('Templates/binary-companion.md')
          .setValue(this.plugin.settings.companionTemplatePath)
          .onChange(async (value) => {
            this.plugin.settings.companionTemplatePath = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
```

- [ ] **Step 2: Commit (sem teste — UI puramente declarativa)**

```bash
git add src/settings/settingsTab.ts
~/.claude/scripts/commit.sh "feat(settings): SettingsTab com Hide companions + Companion template"
```

---

### Task 16: Wiring final em `main.ts`

**Files:**
- Modify: `src/main.ts` (substituir o stub do scaffold)

- [ ] **Step 1: Reescrever `src/main.ts`**

```typescript
// src/main.ts
import { Plugin, WorkspaceLeaf } from 'obsidian';

import { BINARY_NOTES_VIEW_TYPE } from './constants';
import { DEFAULT_SETTINGS, BinaryNotesSettings } from './settings/settings';
import { BinaryNotesSettingsTab } from './settings/settingsTab';
import { CompanionRegistry } from './registry/companionRegistry';
import { VaultLifecycleHandler } from './lifecycle/vaultLifecycleHandler';
import { ClickInterceptor } from './intercept/clickInterceptor';
import { ViewSwapper } from './intercept/viewSwapper';
import { ExplorerDecorator } from './explorer/explorerDecorator';
import { BinaryNotesView } from './view/binaryNotesView';
import { registerCommands } from './commands/commands';

export default class BinaryNotesPlugin extends Plugin {
  settings!: BinaryNotesSettings;
  registry!: CompanionRegistry;
  lifecycle!: VaultLifecycleHandler;
  clickInterceptor!: ClickInterceptor;
  viewSwapper!: ViewSwapper;
  explorerDecorator!: ExplorerDecorator;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Registry primeiro — todo mundo consulta
    this.registry = new CompanionRegistry(this.app);
    this.registry.initialize();

    // View registrada ANTES dos interceptors que tentam abri-la (evita race)
    this.registerView(BINARY_NOTES_VIEW_TYPE, (leaf: WorkspaceLeaf) =>
      new BinaryNotesView(leaf, this.registry),
    );

    // Lifecycle: rename/delete cascade
    this.lifecycle = new VaultLifecycleHandler(this.app, this.registry);
    this.lifecycle.initialize();

    // Interceptors: click (primário) e active-leaf-change (fallback)
    this.clickInterceptor = new ClickInterceptor(this.app, this.registry, this);
    this.clickInterceptor.initialize();

    this.viewSwapper = new ViewSwapper(this.app, this.registry);
    this.viewSwapper.initialize();

    // Explorer decoration: underline + hide
    this.explorerDecorator = new ExplorerDecorator(this, this.registry);
    this.explorerDecorator.initialize(this.settings.hideCompanions);

    // Comandos e UI
    registerCommands(this, this.app, this.registry, () => this.settings);
    this.addSettingTab(new BinaryNotesSettingsTab(this.app, this));
  }

  onunload(): void {
    this.explorerDecorator?.unload();
    this.viewSwapper?.unload();
    this.clickInterceptor?.unload();
    this.lifecycle?.unload();
    this.registry?.unload();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
```

- [ ] **Step 2: Build e validar**

Run: `npm run build`
Expected: build sem erros, gera `main.js`

Run: `npm test -- --run`
Expected: TODOS os testes PASS

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
~/.claude/scripts/commit.sh "feat(main): wire all components in plugin lifecycle"
```

---

### Task 17: Manual test scenarios — checklist E2E

**Files:**
- Create: `docs/MANUAL-TESTS.md`

Esses cenários precisam ser rodados em um vault real do Obsidian (via `npm run dev` + plugin instalado no demo vault). Não dá pra automatizar com vitest+jsdom — falta o runtime do Obsidian.

- [ ] **Step 1: Criar `docs/MANUAL-TESTS.md`**

```markdown
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
```

- [ ] **Step 2: Rodar os cenários manualmente, marcar checkboxes conforme passa**

(Esse passo acontece em runtime humano, não automatizado.)

- [ ] **Step 3: Commit**

```bash
git add docs/MANUAL-TESTS.md
~/.claude/scripts/commit.sh "docs: manual test scenarios pra E2E em vault real"
```

---

### Task 18: README mínimo

**Files:**
- Create: `README.md`

- [ ] **Step 1: Escrever README curto**

```markdown
# Binary Notes

Promote binary files (PDF, image, audio, video) to first-class citizens in your Obsidian vault.

Right-click any supported binary → **Add Binary Notes**. The plugin creates a sidecar `.md` companion with frontmatter `binary: <path>`. From then on, clicking the binary in the file explorer opens a unified custom view with the binary embedded above and the companion's markdown below. Use the header's "Toggle source view" to drop into the native viewer (or PDF++ etc).

## Supported types

PDF, PNG/JPG/GIF/SVG/WEBP, MP3/M4A/WAV/OGG/FLAC, MP4/WEBM/MOV/MKV.

EPUB is intentionally out of scope (delegated to the ePub Reader plugin).

## How companions work

- A companion is just a `.md` file with `binary: <path>` in the frontmatter.
- Default location: alongside the binary (`paper.pdf` → `paper.pdf.md`).
- Companion can live anywhere in the vault — the frontmatter is the source of truth.
- One companion per binary, enforced on creation.
- Companions are hidden in the file explorer by default (toggle in settings).
  - Add `visible: true` in a companion's frontmatter to expose it individually.

## Installation

Via BRAT (until store release):
1. Install BRAT plugin
2. Add this repo URL
3. Enable "Binary Notes"

## Development

```bash
npm install        # install deps
npm run dev        # esbuild watch + hot-reload
npm test           # run vitest in watch mode
npm test -- --run  # single test pass (CI mode)
npm run build      # production build (generates main.js)
```

## Status

Personal-scale plugin built for the author's own workflow. See `docs/01-discovery-binary-companion.md` for design rationale and `docs/superpowers/specs/2026-04-27-binary-notes-design.md` for the technical spec.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
~/.claude/scripts/commit.sh "docs: add README"
```

---

## Critérios de Done

- [ ] Todos os testes vitest passam (`npm test -- --run`)
- [ ] Build sem warnings (`npm run build`)
- [ ] Manual tests S1-S10 (`docs/MANUAL-TESTS.md`) todos checados
- [ ] CLAUDE.md atualizado com seção "Comandos comuns" (`npm run dev`, `npm test`, `npm run build`)

---

## Patterns reaproveitados — referências

- `caseVariablesRegistry.ts` (Qualia): `writingInProgress` set, `onLayoutReady` deferred scan, `processFrontMatter` write, `migrateFilePath` rename support → adaptado em `companionRegistry.ts`
- `fileInterceptor.ts` (Qualia): `active-leaf-change` swap pattern → adaptado em `viewSwapper.ts`
- `mediaToggleButton.ts` (Qualia): `view.addAction` + WeakMap detach pra evitar duplicação em hot-reload → adaptado em `headerActions.ts`
- Folder Notes: body class hide + CSS cascata, MutationObserver com retry, click intercept capture phase → aplicado em `explorerDecorator.ts` e `clickInterceptor.ts`
- Annotator: pattern de YAML linking (`binary: <path>`) → core do `companionRegistry.ts`

## Gotchas catalogados aplicáveis (Qualia `docs/TECHNICAL-PATTERNS.md`)

- §8.6 — `active-leaf-change` em vez de `registerExtensions` (já aplicado em `viewSwapper`)
- §8.8 — WeakSet pra evitar double-instrumentation (`viewSwapper.swapping`)
- §19.5 — Detach manual de `view.addAction` (já em `headerActions.ts`)
- §1.12 — MutationObserver self-suppression (não aplicável aqui pois `ExplorerDecorator` só lê; se adicionar overlays internos, lembrar)
- §8.3 — `instanceof FileView` antes de operar em leaf (já em `viewSwapper.maybeSwap`)
