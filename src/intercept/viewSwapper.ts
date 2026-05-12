import { App, EventRef, FileView, TFile, WorkspaceLeaf } from 'obsidian';
import { isSupportedBinary } from '../utils/pathResolver';
import { CompanionRegistry } from '../registry/companionRegistry';

/**
 * Set compartilhado pra outros módulos sinalizarem que NÃO querem que o ViewSwapper
 * intercepte o próximo `active-leaf-change` daquele leaf. Usado, por exemplo, pelo botão
 * "Open binary in viewer" no header do companion: ele quer abrir o binário cru sem o
 * swapper redirecionar de volta pro companion (race causa "Transport destroyed" no PDF.js).
 */
export const swapBypass = new WeakSet<WorkspaceLeaf>();

/**
 * Fallback pra abertura de binário fora do explorer (drag/drop, comando do Obsidian,
 * click em wikilink em outra nota). Quando uma leaf abre um binário com companion,
 * substitui a abertura pelo companion .md (MarkdownView nativa).
 */
interface SettingsGetter {
  (): { hideCompanions: boolean };
}

export class ViewSwapper {
  private ref: EventRef | null = null;
  private swapping = new WeakSet<WorkspaceLeaf>();

  constructor(
    private app: App,
    private registry: CompanionRegistry,
    private getSettings: SettingsGetter,
  ) {}

  initialize(): void {
    this.ref = this.app.workspace.on('active-leaf-change', (leaf) => {
      if (!leaf) return;
      if (this.swapping.has(leaf)) return;
      if (swapBypass.has(leaf)) return;
      void this.maybeSwap(leaf);
    });
  }

  unload(): void {
    if (this.ref) this.app.workspace.offref(this.ref);
  }

  private async maybeSwap(leaf: WorkspaceLeaf): Promise<void> {
    // hide=OFF: navegação normal, sem swap. Wikilink/quick switcher/bookmark abrem
    // o binário cru direto. User chega no companion via botão do header.
    if (!this.getSettings().hideCompanions) return;

    const view = leaf.view;
    if (!(view instanceof FileView)) return;
    const file = view.file;
    if (!file || !isSupportedBinary(file.path)) return;
    const companionPath = this.registry.getCompanionFor(file.path);
    if (!companionPath) return;
    const companionFile = this.app.vault.getAbstractFileByPath(companionPath);
    if (!(companionFile instanceof TFile)) return;

    this.swapping.add(leaf);
    try {
      await leaf.openFile(companionFile);
    } finally {
      // Liberar no próximo tick (após active-leaf-change novo disparar)
      setTimeout(() => this.swapping.delete(leaf), 0);
    }
  }
}
