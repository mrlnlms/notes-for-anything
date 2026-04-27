// Plugin factory pra testes. Retorna um plugin mock com app, vault, workspace, metadataCache, fileManager.
// Helpers de manipulação (__setFile, __triggerXxx, etc) adicionados pela Task 2.5.

import { vi } from 'vitest';
import type { Mock } from 'vitest';
import {
  TFile,
  TAbstractFile,
  WorkspaceLeaf,
  FileView,
  EventRef,
} from './obsidian.mock';

type Listener = (...args: any[]) => any;

interface EventBus {
  on(event: string, handler: Listener): EventRef;
  off(event: string, handler: Listener): void;
  offref(ref: EventRef): void;
  trigger(event: string, ...args: any[]): void;
}

function createEventBus(): EventBus {
  const handlers = new Map<string, Set<Listener>>();
  return {
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return { event, handler } as unknown as EventRef;
    },
    off(event, handler) {
      handlers.get(event)?.delete(handler);
    },
    offref(ref) {
      const r = ref as unknown as { event: string; handler: Listener };
      handlers.get(r.event)?.delete(r.handler);
    },
    trigger(event, ...args) {
      const set = handlers.get(event);
      if (!set) return;
      for (const h of [...set]) h(...args);
    },
  };
}

export interface VirtualFileEntry {
  file: TFile;
  frontmatter: Record<string, unknown>;
  content: string;
  kind: 'md' | 'binary';
}

export interface FakeVault {
  // standard vault surface (whatever the factory provides)
  getAbstractFileByPath: Mock;
  getMarkdownFiles: Mock;
  getFiles: Mock;
  cachedRead: Mock;
  read: Mock;
  create: Mock;
  delete: Mock;
  rename: Mock;
  process: Mock;
  on: (event: string, handler: (...args: any[]) => any) => any;
  off: (event: string, handler: (...args: any[]) => any) => void;
  offref: (ref: any) => void;
  trigger: (event: string, ...args: any[]) => void;
  // helpers
  __setFile(path: string, fm?: Record<string, unknown>, kind?: 'md' | 'binary', body?: string): TFile;
  __deleteFile(path: string): void;
  __getFile(path: string): VirtualFileEntry | undefined;
  __triggerRename(oldPath: string, newPath: string): void;
  __triggerDelete(path: string): void;
}

export interface FakeMetadataCache {
  getFileCache: Mock;
  getCache: Mock;
  on: (event: string, handler: (...args: any[]) => any) => any;
  off: (event: string, handler: (...args: any[]) => any) => void;
  offref: (ref: any) => void;
  trigger: (event: string, ...args: any[]) => void;
  __triggerChanged(path: string): void;
}

export interface FakeWorkspace {
  getActiveFile: Mock;
  getActiveLeaf: Mock;
  getLeaf: Mock;
  getLeavesOfType: Mock;
  getActiveViewOfType: Mock;
  onLayoutReady: Mock;
  on: (event: string, handler: (...args: any[]) => any) => any;
  off: (event: string, handler: (...args: any[]) => any) => void;
  offref: (ref: any) => void;
  trigger: (event: string, ...args: any[]) => void;
  __triggerLayoutReady(): Promise<void> | void;
  __createLeaf(): any;
  __createLeafWithFile(path: string, viewType: string): any;
  __createLeafWithViewType(viewType: string): any;
  __triggerActiveLeafChange(leaf: any): void;
  __getLastSetViewState(): { type: string; state: any } | null;
  __resetSetViewStateLog(): void;
  __setActiveFile(path: string): void;
}

export interface FakeFileManager {
  processFrontMatter: Mock;
  renameFile: Mock;
  __mockProcessFrontMatter(path: string, fmRef: Record<string, unknown>): void;
}

export interface FakeApp {
  vault: FakeVault;
  workspace: FakeWorkspace;
  metadataCache: FakeMetadataCache;
  fileManager: FakeFileManager;
  MarkdownRenderer: { render: Mock };
}

export interface FakePlugin {
  app: FakeApp;
  manifest: any;
  __commands: Map<string, any>;
  __layoutReadyCallbacks: Array<() => void>;
  addCommand: ReturnType<typeof vi.fn>;
  registerEvent: ReturnType<typeof vi.fn>;
  registerDomEvent: ReturnType<typeof vi.fn>;
  registerInterval: ReturnType<typeof vi.fn>;
  registerView: ReturnType<typeof vi.fn>;
  addSettingTab: ReturnType<typeof vi.fn>;
  loadData: ReturnType<typeof vi.fn>;
  saveData: ReturnType<typeof vi.fn>;
  __runCommand: (commandId: string) => any;
  __unloadDomEvents: () => void;
}

function makeAddAction(actions: HTMLElement[], host: HTMLElement) {
  return (_icon: string, _title: string, _cb: any): HTMLElement => {
    const el = document.createElement('div');
    el.classList.add('view-action');
    host.appendChild(el);
    actions.push(el);
    return el;
  };
}

export function createPlugin(): FakePlugin {
  const layoutReadyCallbacks: Array<() => void> = [];

  const vaultBus = createEventBus();
  const workspaceBus = createEventBus();
  const metadataCacheBus = createEventBus();

  // Vault virtual: armazena entries por path
  const vaultFiles = new Map<string, VirtualFileEntry>();

  // Log centralizado de setViewState
  const setViewStateLog: Array<{ type: string; state: any }> = [];

  // Active file (manipulado por __setActiveFile)
  let activeFilePath: string | null = null;

  // FrontMatter refs registrados por path para __mockProcessFrontMatter
  const fmRefs = new Map<string, Record<string, unknown>>();

  function getFileEntry(path: string): VirtualFileEntry | undefined {
    return vaultFiles.get(path);
  }

  function setVirtualFile(
    path: string,
    frontmatter: Record<string, unknown>,
    kind: 'md' | 'binary' = 'md',
    body = '',
  ): TFile {
    const existing = vaultFiles.get(path);
    if (existing) {
      existing.frontmatter = frontmatter;
      existing.kind = kind;
      existing.content = body;
      return existing.file;
    }
    const file = new TFile(path);
    // Se kind === 'binary' e o path não tem extensão obvia, mantemos extension original
    vaultFiles.set(path, { file, frontmatter, kind, content: body });
    return file;
  }

  const vault: FakeVault = {
    ...vaultBus,
    getAbstractFileByPath: vi.fn((path: string): TAbstractFile | null => {
      const entry = vaultFiles.get(path);
      return entry ? entry.file : null;
    }),
    getMarkdownFiles: vi.fn((): TFile[] => {
      const out: TFile[] = [];
      for (const entry of vaultFiles.values()) {
        if (entry.kind === 'md') out.push(entry.file);
      }
      return out;
    }),
    getFiles: vi.fn((): TFile[] => {
      const out: TFile[] = [];
      for (const entry of vaultFiles.values()) out.push(entry.file);
      return out;
    }),
    cachedRead: vi.fn(async (file: TFile): Promise<string> => {
      const entry = vaultFiles.get(file.path);
      return entry?.content ?? '';
    }),
    read: vi.fn(async (file: TFile): Promise<string> => {
      const entry = vaultFiles.get(file.path);
      return entry?.content ?? '';
    }),
    create: vi.fn(async (path: string, content: string): Promise<TFile> => {
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      const kind: 'md' | 'binary' = ext === 'md' ? 'md' : 'binary';
      return setVirtualFile(path, {}, kind, content);
    }),
    delete: vi.fn(async (file: TAbstractFile): Promise<void> => {
      vaultFiles.delete(file.path);
    }),
    rename: vi.fn(async (file: TAbstractFile, newPath: string): Promise<void> => {
      const entry = vaultFiles.get(file.path);
      if (!entry) return;
      vaultFiles.delete(file.path);
      const newFile = new TFile(newPath);
      entry.file = newFile;
      vaultFiles.set(newPath, entry);
    }),
    process: vi.fn(async (_file: TFile, _fn: any): Promise<string> => ''),

    // ===== Helpers de teste =====
    __setFile(
      path: string,
      frontmatter: Record<string, unknown> = {},
      kind: 'md' | 'binary' = 'md',
      body = '',
    ): TFile {
      return setVirtualFile(path, frontmatter, kind, body);
    },
    __deleteFile(path: string): void {
      vaultFiles.delete(path);
    },
    __getFile(path: string): VirtualFileEntry | undefined {
      return getFileEntry(path);
    },
    __triggerRename(oldPath: string, newPath: string): void {
      const entry = vaultFiles.get(oldPath);
      if (!entry) return;
      vaultFiles.delete(oldPath);
      const newFile = new TFile(newPath);
      entry.file = newFile;
      vaultFiles.set(newPath, entry);
      vaultBus.trigger('rename', newFile, oldPath);
    },
    __triggerDelete(path: string): void {
      const entry = vaultFiles.get(path);
      const file = entry ? entry.file : new TFile(path);
      vaultBus.trigger('delete', file);
      // NÃO remove do Map automaticamente — quem chama decide.
    },
  };

  const metadataCache: FakeMetadataCache = {
    ...metadataCacheBus,
    getFileCache: vi.fn((file: TFile) => {
      const entry = vaultFiles.get(file.path);
      if (!entry) return null;
      return { frontmatter: entry.frontmatter };
    }),
    getCache: vi.fn((path: string) => {
      const entry = vaultFiles.get(path);
      if (!entry) return null;
      return { frontmatter: entry.frontmatter };
    }),

    // ===== Helpers de teste =====
    __triggerChanged(path: string): void {
      const entry = vaultFiles.get(path);
      if (!entry) return;
      metadataCacheBus.trigger('changed', entry.file);
    },
  };

  // ===== Workspace e leafs =====
  // Cria leaf virtual mínima — `view` começa null, `setViewState` registra no log e
  // mantém um stub de view com `addAction` que pendura elements no array `__actions`.
  function createLeaf(): any {
    const actions: HTMLElement[] = [];
    const actionsHost = document.createElement('div');
    const leaf: any = {
      view: null as any,
      app,
      async setViewState(state: any) {
        setViewStateLog.push({ type: state?.type, state: state?.state });
        // mantém um view-stub mínimo com getViewType
        const type = state?.type ?? '';
        leaf.view = leaf.view ?? {
          getViewType: () => type,
          addAction: makeAddAction(actions, actionsHost),
        };
      },
      getViewState() {
        const t = leaf.view?.getViewType?.() ?? '';
        return { type: t, state: {} };
      },
      async openFile(_file: TFile) {},
      detach() {},
      __getActions(): HTMLElement[] {
        // Apenas elements ainda attachados (simula DOM real: detach() remove do parent)
        return actions.filter((el) => el.parentNode !== null);
      },
      __actions: actions,
      __actionsHost: actionsHost,
    };
    return leaf;
  }

  function createLeafWithFile(path: string, viewType: string): any {
    const leaf = createLeaf();
    const entry = vaultFiles.get(path);
    const file = entry ? entry.file : new TFile(path);
    const view: any = new FileView(leaf as unknown as WorkspaceLeaf);
    view.file = file;
    view.getViewType = () => viewType;
    view.addAction = makeAddAction(leaf.__actions, leaf.__actionsHost);
    leaf.view = view;
    return leaf;
  }

  function createLeafWithViewType(viewType: string): any {
    const leaf = createLeaf();
    const view: any = {
      getViewType: () => viewType,
      file: null,
      addAction: makeAddAction(leaf.__actions, leaf.__actionsHost),
    };
    leaf.view = view;
    return leaf;
  }

  const workspace: FakeWorkspace = {
    ...workspaceBus,
    getActiveFile: vi.fn((): TFile | null => {
      if (!activeFilePath) return null;
      const entry = vaultFiles.get(activeFilePath);
      return entry ? entry.file : null;
    }),
    getActiveLeaf: vi.fn((): WorkspaceLeaf | null => null),
    getLeaf: vi.fn((_newLeaf?: boolean): WorkspaceLeaf => createLeaf()),
    getLeavesOfType: vi.fn((_type: string): WorkspaceLeaf[] => []),
    getActiveViewOfType: vi.fn(<T,>(_cls: any): T | null => null),
    onLayoutReady: vi.fn((cb: () => void) => {
      layoutReadyCallbacks.push(cb);
    }),

    // ===== Helpers de teste =====
    async __triggerLayoutReady(): Promise<void> {
      for (const cb of [...layoutReadyCallbacks]) {
        await cb();
      }
    },
    __createLeaf(): any {
      return createLeaf();
    },
    __createLeafWithFile(path: string, viewType: string): any {
      return createLeafWithFile(path, viewType);
    },
    __createLeafWithViewType(viewType: string): any {
      return createLeafWithViewType(viewType);
    },
    __triggerActiveLeafChange(leaf: any): void {
      workspaceBus.trigger('active-leaf-change', leaf);
    },
    __getLastSetViewState(): { type: string; state: any } | null {
      if (setViewStateLog.length === 0) return null;
      return setViewStateLog[setViewStateLog.length - 1];
    },
    __resetSetViewStateLog(): void {
      setViewStateLog.length = 0;
    },
    __setActiveFile(path: string): void {
      activeFilePath = path;
    },
  };

  const fileManager: FakeFileManager = {
    processFrontMatter: vi.fn(async (file: TFile, fn: (fm: Record<string, unknown>) => void): Promise<void> => {
      // Se tiver fmRef registrado pra esse path, usa ele; senão, usa o frontmatter do vault virtual
      const ref = fmRefs.get(file.path);
      if (ref) {
        fn(ref);
        return;
      }
      const entry = vaultFiles.get(file.path);
      if (entry) {
        fn(entry.frontmatter);
      } else {
        const fm: Record<string, unknown> = {};
        fn(fm);
      }
    }),
    renameFile: vi.fn(async (file: TFile, newPath: string): Promise<void> => {
      const entry = vaultFiles.get(file.path);
      if (!entry) return;
      vaultFiles.delete(file.path);
      const newFile = new TFile(newPath);
      entry.file = newFile;
      vaultFiles.set(newPath, entry);
    }),

    // ===== Helpers de teste =====
    __mockProcessFrontMatter(path: string, fmRef: Record<string, unknown>): void {
      fmRefs.set(path, fmRef);
    },
  };

  const app: FakeApp = {
    vault,
    workspace,
    metadataCache,
    fileManager,
    MarkdownRenderer: {
      render: vi.fn(async (_app: any, content: string, el: HTMLElement, _src: string, _comp: any) => {
        el.innerHTML = content;
      }),
    },
  };

  const commands = new Map<string, any>();
  const domEventCleanups: Array<() => void> = [];

  const plugin: FakePlugin = {
    app,
    manifest: { id: 'binary-notes', name: 'Binary Notes', version: '0.1.0' },
    __commands: commands,
    __layoutReadyCallbacks: layoutReadyCallbacks,
    addCommand: vi.fn((cmd: any) => {
      commands.set(cmd.id, cmd);
    }),
    registerEvent: vi.fn((_ref: EventRef) => {}),
    registerDomEvent: vi.fn((target: any, event: string, handler: any, _capture?: boolean) => {
      target.addEventListener(event, handler, _capture);
      domEventCleanups.push(() => target.removeEventListener(event, handler, _capture));
    }),
    registerInterval: vi.fn((id: number) => id),
    registerView: vi.fn((_type: string, _factory: any) => {}),
    addSettingTab: vi.fn((_tab: any) => {}),
    loadData: vi.fn(async () => ({})),
    saveData: vi.fn(async (_data: any) => {}),
    __unloadDomEvents(): void {
      while (domEventCleanups.length > 0) {
        const fn = domEventCleanups.pop();
        try {
          fn?.();
        } catch {
          // noop
        }
      }
    },
    __runCommand(commandId: string): any {
      const cmd = commands.get(commandId);
      if (!cmd) {
        throw new Error(`Command not registered: ${commandId}`);
      }
      if (typeof cmd.checkCallback === 'function') {
        return cmd.checkCallback(false);
      }
      if (typeof cmd.callback === 'function') {
        return cmd.callback();
      }
      if (typeof cmd.editorCallback === 'function') {
        return cmd.editorCallback(null, null);
      }
      throw new Error(`Command ${commandId} has no callback/checkCallback/editorCallback`);
    },
  };

  return plugin;
}
