import {
  ItemView,
  WorkspaceLeaf,
  MarkdownRenderer,
  TFile,
  ViewStateResult,
  EventRef,
} from 'obsidian';
import { BINARY_NOTES_VIEW_TYPE, FM_KEY_BINARY } from '../constants';
import { CompanionRegistry } from '../registry/companionRegistry';
import { mountHeaderActions, detachHeaderActions } from './headerActions';

interface BinaryNotesViewState {
  companionPath: string;
}

export class BinaryNotesView extends ItemView {
  private companionPath: string | null = null;
  private deleteRef: EventRef | null = null;

  constructor(leaf: WorkspaceLeaf, public readonly registry: CompanionRegistry) {
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
    mountHeaderActions(this);
    this.deleteRef = this.app.vault.on('delete', (file: TFile) => {
      if (file.path === this.companionPath) {
        this.leaf.detach();
      }
    });
    await this.render();
  }

  async onClose(): Promise<void> {
    detachHeaderActions(this);
    if (this.deleteRef) this.app.vault.offref(this.deleteRef);
    this.contentEl.empty();
  }

  private async render(): Promise<void> {
    this.contentEl.empty();
    if (!this.companionPath) {
      this.contentEl.createDiv({ text: 'No companion loaded.' });
      return;
    }
    // Tenta resolver via registry. Se vazio (race entre criação do .md e o sync do
    // metadataCache no registry), fallback: lê o frontmatter `binary:` direto do arquivo.
    let binaryPath = this.registry.getBinaryFor(this.companionPath);
    if (!binaryPath) {
      binaryPath = await this.readBinaryFromFrontmatter(this.companionPath);
    }
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

    // Conteúdo do companion: frontmatter como codeblock YAML visível + body markdown.
    // MarkdownRenderer normalmente strippa frontmatter, então convertemos pra ```yaml block
    // pra deixar as Properties visíveis na view.
    const file = this.app.vault.getAbstractFileByPath(this.companionPath);
    if (file instanceof TFile) {
      const raw = await this.app.vault.cachedRead(file);
      const displayContent = this.frontmatterAsCodeblock(raw);
      const noteHost = wrapper.createDiv({ cls: 'binary-notes-companion' });
      await MarkdownRenderer.render(this.app, displayContent, noteHost, this.companionPath, this);
    }
  }

  /** Converte o frontmatter YAML do início do arquivo em ```yaml block visível, mantém o body. */
  private frontmatterAsCodeblock(raw: string): string {
    if (!raw.startsWith('---')) return raw;
    const end = raw.indexOf('\n---', 3);
    if (end === -1) return raw;
    const fmBlock = raw.slice(3, end).replace(/^\n+/, '').replace(/\n+$/, '');
    const body = raw.slice(end + 4).replace(/^\n+/, '');
    return '```yaml\n' + fmBlock + '\n```\n\n' + body;
  }

  /**
   * Fallback pra resolver `binary:` quando o registry ainda não foi sincronizado
   * (acontece logo após criar o companion via "Add Binary Notes" — metadataCache
   * ainda não disparou o evento que popula o registry). Lê o arquivo textual e
   * parseia o frontmatter manualmente, sem depender do metadataCache.
   */
  private async readBinaryFromFrontmatter(companionPath: string): Promise<string | null> {
    const file = this.app.vault.getAbstractFileByPath(companionPath);
    if (!(file instanceof TFile)) return null;
    // Tenta metadataCache primeiro (rápido se já populado)
    const cached = this.app.metadataCache.getFileCache(file)?.frontmatter?.[FM_KEY_BINARY];
    if (typeof cached === 'string') return cached;
    // Fallback: lê o arquivo direto e parseia FM linha-a-linha
    const raw = await this.app.vault.cachedRead(file);
    if (!raw.startsWith('---')) return null;
    const end = raw.indexOf('\n---', 3);
    if (end === -1) return null;
    const fmBlock = raw.slice(3, end);
    const match = fmBlock.match(/^binary:\s*(.+)$/m);
    if (!match) return null;
    let value = match[1].trim();
    // Remove aspas se houver (suporta paths com whitespace múltiplo / chars especiais)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
}
