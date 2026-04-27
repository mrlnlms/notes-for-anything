// Mock minimal da API do Obsidian pra testes vitest+jsdom.
// Helpers de manipulação (__setFile, __triggerXxx, etc) são adicionados pela Task 2.5.

export class TAbstractFile {
  path = '';
  name = '';
  parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
  extension = '';
  basename = '';
  stat = { ctime: 0, mtime: 0, size: 0 };

  constructor(path = '', name = '') {
    super();
    this.path = path;
    this.name = name || path.split('/').pop() || '';
    const dot = this.name.lastIndexOf('.');
    if (dot !== -1) {
      this.extension = this.name.slice(dot + 1);
      this.basename = this.name.slice(0, dot);
    } else {
      this.basename = this.name;
    }
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

export class Component {
  addChild() {}
  removeChild() {}
  load() {}
  unload() {}
  register() {}
  registerEvent() {}
  registerDomEvent() {}
  registerInterval() {}
}

export class MarkdownRenderChild extends Component {
  containerEl: HTMLElement;
  constructor(el: HTMLElement) {
    super();
    this.containerEl = el;
  }
}

export class MarkdownView extends Component {
  file: TFile | null = null;
  containerEl: HTMLElement = document.createElement('div');
  editor: any = null;
  getViewType() {
    return 'markdown';
  }
}

export class FileView extends Component {
  file: TFile | null = null;
  containerEl: HTMLElement = document.createElement('div');
  contentEl: HTMLElement = document.createElement('div');
  leaf: WorkspaceLeaf;
  constructor(leaf: WorkspaceLeaf) {
    super();
    this.leaf = leaf;
  }
  getViewType(): string {
    return 'file';
  }
}

export class ItemView extends Component {
  containerEl: HTMLElement;
  contentEl: HTMLElement;
  leaf: WorkspaceLeaf;
  app: any;
  constructor(leaf: WorkspaceLeaf) {
    super();
    this.leaf = leaf;
    this.app = leaf?.app ?? null;
    this.containerEl = document.createElement('div');
    this.contentEl = document.createElement('div');
    this.containerEl.appendChild(this.contentEl);
  }
  getViewType(): string {
    return 'item-view';
  }
  getDisplayText(): string {
    return '';
  }
  getIcon(): string {
    return 'document';
  }
  getState(): Record<string, unknown> {
    return {};
  }
  async setState(_state: any, _result: any): Promise<void> {}
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
  addAction(_icon: string, _title: string, _cb: (evt: MouseEvent) => any): HTMLElement {
    const el = document.createElement('div');
    el.classList.add('view-action');
    // Se o leaf tiver tracking (pluginFactory), pendura no host e registra no array
    const leafAny = this.leaf as any;
    if (leafAny?.__actionsHost && Array.isArray(leafAny.__actions)) {
      leafAny.__actionsHost.appendChild(el);
      leafAny.__actions.push(el);
    }
    return el;
  }
}

export const MarkdownRenderer = {
  render: async (
    _app: any,
    content: string,
    el: HTMLElement,
    _sourcePath: string,
    _component: any,
  ) => {
    el.innerHTML = content;
  },
  renderMarkdown: async (
    content: string,
    el: HTMLElement,
    _sourcePath: string,
    _component: any,
  ) => {
    el.innerHTML = content;
  },
};

export class WorkspaceLeaf {
  view: any = null;
  app: any = null;
  async setViewState(_state: any): Promise<void> {}
  async openFile(_file: TFile): Promise<void> {}
  detach(): void {}
  getViewState(): any {
    return { type: this.view?.getViewType?.() ?? '', state: {} };
  }
}

export interface EventRef {}

export class Plugin extends Component {
  app: any;
  manifest: any = { id: 'binary-notes', name: 'Binary Notes', version: '0.1.0' };
  constructor(app: any, manifest: any) {
    super();
    this.app = app;
    if (manifest) this.manifest = manifest;
  }
  addSettingTab(_tab: any): void {}
  addCommand(_cmd: any): void {}
  addRibbonAction(_icon: string, _title: string, _cb: any): HTMLElement {
    return document.createElement('div');
  }
  registerView(_type: string, _factory: (leaf: WorkspaceLeaf) => any): void {}
  registerEvent(_ref: EventRef): void {}
  registerDomEvent(_target: any, _event: string, _handler: any, _capture?: boolean): void {}
  registerEditorExtension(_ext: any): void {}
  registerMarkdownCodeBlockProcessor(_lang: string, _handler: any): void {}
  registerInterval(_id: number): number {
    return 0;
  }
  async loadData(): Promise<any> {
    return {};
  }
  async saveData(_data: any): Promise<void> {}
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: HTMLElement = document.createElement('div');
  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }
  display(): void {}
  hide(): void {}
}

export class Setting {
  settingEl: HTMLElement = document.createElement('div');
  infoEl: HTMLElement = document.createElement('div');
  nameEl: HTMLElement = document.createElement('div');
  descEl: HTMLElement = document.createElement('div');
  controlEl: HTMLElement = document.createElement('div');
  constructor(containerEl: HTMLElement) {
    containerEl.appendChild(this.settingEl);
  }
  setName(_n: string) {
    return this;
  }
  setDesc(_d: string) {
    return this;
  }
  setHeading() {
    return this;
  }
  setTooltip(_t: string) {
    return this;
  }
  addToggle(cb: (toggle: any) => void) {
    cb({
      setValue: (_v: boolean) => ({ onChange: (_: any) => ({}) }),
      onChange: (_: any) => ({}),
    });
    return this;
  }
  addText(cb: (text: any) => void) {
    cb({
      setValue: (_v: string) => ({ onChange: (_: any) => ({}) }),
      setPlaceholder: (_p: string) => ({}),
      onChange: (_: any) => ({}),
    });
    return this;
  }
  addDropdown(cb: (dropdown: any) => void) {
    cb({
      addOption: (_v: string, _l: string) => ({}),
      setValue: (_v: string) => ({ onChange: (_: any) => ({}) }),
    });
    return this;
  }
  addButton(cb: (btn: any) => void) {
    cb({
      setButtonText: (_t: string) => ({ setCta: () => ({ onClick: (_: any) => ({}) }) }),
      onClick: (_: any) => ({}),
    });
    return this;
  }
}

export class Notice {
  constructor(_msg: string, _duration?: number) {}
}

export class Menu {
  items: any[] = [];
  addItem(cb: (item: any) => void) {
    const item = {
      setTitle: (_t: string) => item,
      setIcon: (_i: string) => item,
      onClick: (_cb: any) => item,
    };
    cb(item);
    this.items.push(item);
    return this;
  }
  addSeparator() {
    return this;
  }
  showAtMouseEvent(_evt: MouseEvent) {}
  showAtPosition(_pos: { x: number; y: number }) {}
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export const moment = () => ({
  format: () => '',
  toDate: () => new Date(),
});

// Polyfill da API Obsidian de createEl/empty/detach no HTMLElement
if (typeof HTMLElement !== 'undefined') {
  if (!(HTMLElement.prototype as any).createEl) {
    (HTMLElement.prototype as any).createEl = function (
      tag: string,
      options?: { text?: string; cls?: string; attr?: Record<string, string> },
    ) {
      const el = document.createElement(tag);
      if (options?.text) el.textContent = options.text;
      if (options?.cls) el.className = options.cls;
      if (options?.attr) {
        for (const [k, v] of Object.entries(options.attr)) el.setAttribute(k, v);
      }
      this.appendChild(el);
      return el;
    };
  }
  if (!(HTMLElement.prototype as any).createDiv) {
    (HTMLElement.prototype as any).createDiv = function (options?: any) {
      return (this as any).createEl('div', options);
    };
  }
  if (!(HTMLElement.prototype as any).empty) {
    (HTMLElement.prototype as any).empty = function () {
      while (this.firstChild) this.removeChild(this.firstChild);
    };
  }
  if (!(HTMLElement.prototype as any).detach) {
    (HTMLElement.prototype as any).detach = function () {
      this.parentNode?.removeChild(this);
    };
  }
  if (!(HTMLElement.prototype as any).isShown) {
    (HTMLElement.prototype as any).isShown = function () {
      return true;
    };
  }
}
