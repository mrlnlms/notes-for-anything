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
import { registerCompanionHeaderActions } from './companion/companionHeaderActions';

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

    // Header action: botão "Open binary" no header da MarkdownView quando file é companion
    registerCompanionHeaderActions(this, this.app, this.registry);

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
