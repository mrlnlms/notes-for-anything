// src/main.ts
import { Plugin, WorkspaceLeaf } from 'obsidian';

import { NFA_VIEW_TYPE } from './constants';
import { DEFAULT_SETTINGS, NotesForAnythingSettings } from './settings/settings';
import { NotesForAnythingSettingsTab } from './settings/settingsTab';
import { CompanionRegistry } from './registry/companionRegistry';
import { VaultLifecycleHandler } from './lifecycle/vaultLifecycleHandler';
import { ClickInterceptor } from './intercept/clickInterceptor';
import { ViewSwapper } from './intercept/viewSwapper';
import { ExplorerDecorator } from './explorer/explorerDecorator';
import { NotesForAnythingView } from './view/binaryNotesView';
import { registerCommands } from './commands/commands';
import { registerCompanionHeaderActions } from './companion/companionHeaderActions';

export default class NotesForAnythingPlugin extends Plugin {
  settings!: NotesForAnythingSettings;
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
    this.registerView(NFA_VIEW_TYPE, (leaf: WorkspaceLeaf) =>
      new NotesForAnythingView(leaf, this.registry),
    );

    // Lifecycle: rename/delete cascade
    this.lifecycle = new VaultLifecycleHandler(this.app, this.registry);
    this.lifecycle.initialize();

    // Interceptors: click (primário) e active-leaf-change (fallback).
    // Ambos respeitam `hideCompanions`: OFF significa "navegar normal" (sem intercept).
    const getSettings = () => this.settings;
    this.clickInterceptor = new ClickInterceptor(this.app, this.registry, this, getSettings);
    this.clickInterceptor.initialize();

    this.viewSwapper = new ViewSwapper(this.app, this.registry, getSettings);
    this.viewSwapper.initialize();

    // Explorer decoration: underline + hide
    this.explorerDecorator = new ExplorerDecorator(this, this.registry);
    this.explorerDecorator.initialize(this.settings.hideCompanions);

    // Header action: botão "Open binary" no header da MarkdownView quando file é companion
    registerCompanionHeaderActions(this, this.app, this.registry);

    // Comandos e UI
    registerCommands(this, this.app, this.registry, () => this.settings);
    this.addSettingTab(new NotesForAnythingSettingsTab(this.app, this));
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
