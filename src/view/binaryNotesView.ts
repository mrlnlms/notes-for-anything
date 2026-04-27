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
    this.deleteRef = this.app.vault.on('delete', (file: TFile) => {
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
