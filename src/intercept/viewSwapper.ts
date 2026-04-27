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
