// Plugin factory pra testes. Retorna um plugin mock com app, vault, workspace, metadataCache, fileManager.
// Helpers de manipulação (__setFile, __triggerXxx, etc) são adicionados pela Task 2.5.

import { vi } from 'vitest';
import {
  TFile,
  TAbstractFile,
  WorkspaceLeaf,
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

export interface FakePlugin {
  app: any;
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
}

export function createPlugin(): FakePlugin {
  const layoutReadyCallbacks: Array<() => void> = [];

  const vaultBus = createEventBus();
  const workspaceBus = createEventBus();
  const metadataCacheBus = createEventBus();

  const vault = {
    ...vaultBus,
    getAbstractFileByPath: vi.fn((_path: string): TAbstractFile | null => null),
    getMarkdownFiles: vi.fn((): TFile[] => []),
    getFiles: vi.fn((): TFile[] => []),
    cachedRead: vi.fn(async (_file: TFile): Promise<string> => ''),
    read: vi.fn(async (_file: TFile): Promise<string> => ''),
    create: vi.fn(async (_path: string, _content: string): Promise<TFile> => new TFile(_path)),
    delete: vi.fn(async (_file: TAbstractFile): Promise<void> => {}),
    rename: vi.fn(async (_file: TAbstractFile, _newPath: string): Promise<void> => {}),
    process: vi.fn(async (_file: TFile, _fn: any): Promise<string> => ''),
  };

  const workspace = {
    ...workspaceBus,
    getActiveFile: vi.fn((): TFile | null => null),
    getActiveLeaf: vi.fn((): WorkspaceLeaf | null => null),
    getLeaf: vi.fn((_newLeaf?: boolean): WorkspaceLeaf => new WorkspaceLeaf()),
    getLeavesOfType: vi.fn((_type: string): WorkspaceLeaf[] => []),
    getActiveViewOfType: vi.fn(<T,>(_cls: any): T | null => null),
    onLayoutReady: vi.fn((cb: () => void) => {
      layoutReadyCallbacks.push(cb);
    }),
  };

  const metadataCache = {
    ...metadataCacheBus,
    getFileCache: vi.fn((_file: TFile) => null as any),
    getCache: vi.fn((_path: string) => null as any),
  };

  const fileManager = {
    processFrontMatter: vi.fn(async (_file: TFile, _fn: (fm: Record<string, unknown>) => void): Promise<void> => {}),
    renameFile: vi.fn(async (_file: TFile, _newPath: string): Promise<void> => {}),
  };

  const app = {
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

  return {
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
    }),
    registerInterval: vi.fn((id: number) => id),
    registerView: vi.fn((_type: string, _factory: any) => {}),
    addSettingTab: vi.fn((_tab: any) => {}),
    loadData: vi.fn(async () => ({})),
    saveData: vi.fn(async (_data: any) => {}),
  };
}
