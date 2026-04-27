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
