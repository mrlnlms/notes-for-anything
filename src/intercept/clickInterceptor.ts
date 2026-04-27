import { App, Plugin } from 'obsidian';
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
