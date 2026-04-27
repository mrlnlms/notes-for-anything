// src/commands/commands.ts
import { App, Notice, Plugin, TFile, Menu } from 'obsidian';
import { isSupportedBinary, defaultCompanionPath } from '../utils/pathResolver';
import { CompanionRegistry } from '../registry/companionRegistry';
import {
  BINARY_NOTES_VIEW_TYPE,
  CMD_ADD_BINARY_NOTES,
  CMD_TOGGLE_SOURCE,
  FM_KEY_BINARY,
} from '../constants';
import type { BinaryNotesSettings } from '../settings/settings';

export function registerCommands(
  plugin: Plugin,
  app: App,
  registry: CompanionRegistry,
  getSettings: () => BinaryNotesSettings,
): void {
  // Comando "Add Binary Notes" — acessível via menu de contexto e palette
  plugin.addCommand({
    id: CMD_ADD_BINARY_NOTES,
    name: 'Add Binary Notes',
    checkCallback: (checking) => {
      const file = app.workspace.getActiveFile();
      const ok = file !== null && isSupportedBinary(file.path);
      if (checking) return ok;
      if (!file) return false;
      void addOrOpen(app, registry, getSettings, file);
      return true;
    },
  });

  plugin.addCommand({
    id: CMD_TOGGLE_SOURCE,
    name: 'Toggle source view',
    checkCallback: (checking) => {
      const leaf = (app.workspace as unknown as { getActiveLeaf(): import('obsidian').WorkspaceLeaf | null }).getActiveLeaf();
      const inOurView = (leaf?.view as { getViewType?: () => string } | undefined)?.getViewType?.() === BINARY_NOTES_VIEW_TYPE;
      if (checking) return inOurView;
      if (!inOurView || !leaf) return false;
      const state = leaf.view?.getState?.() as { companionPath?: string } | undefined;
      const companionPath = state?.companionPath;
      if (!companionPath) return false;
      const binaryPath = registry.getBinaryFor(companionPath);
      if (!binaryPath) return false;
      const binaryFile = app.vault.getAbstractFileByPath(binaryPath);
      if (binaryFile instanceof TFile) void leaf.openFile(binaryFile);
      return true;
    },
  });

  // Menu de contexto no item do file explorer
  plugin.registerEvent(
    app.workspace.on('file-menu', (menu: Menu, file) => {
      if (!(file instanceof TFile)) return;
      if (!isSupportedBinary(file.path)) return;
      menu.addItem((item) => {
        item
          .setTitle(registry.hasCompanion(file.path) ? 'Open Binary Notes' : 'Add Binary Notes')
          .setIcon('file-symlink')
          .onClick(() => void addOrOpen(app, registry, getSettings, file));
      });
    }),
  );
}

async function addOrOpen(
  app: App,
  registry: CompanionRegistry,
  getSettings: () => BinaryNotesSettings,
  binaryFile: TFile,
): Promise<void> {
  let companionPath = registry.getCompanionFor(binaryFile.path);

  if (!companionPath) {
    companionPath = defaultCompanionPath(binaryFile.path);
    const templatePath = getSettings().companionTemplatePath.trim();
    let body = '';
    if (templatePath) {
      const tplFile = app.vault.getAbstractFileByPath(templatePath);
      if (tplFile instanceof TFile) {
        body = await app.vault.cachedRead(tplFile);
        // strip frontmatter do template (se houver) — vamos prepender o nosso
        if (body.startsWith('---')) {
          const end = body.indexOf('\n---', 3);
          if (end !== -1) body = body.slice(end + 4).replace(/^\n+/, '');
        }
      } else {
        new Notice(`Template not found: ${templatePath}`);
      }
    }
    const initial = `---\n${FM_KEY_BINARY}: ${binaryFile.path}\n---\n${body}`;
    await app.vault.create(companionPath, initial);
  }

  const leaf = app.workspace.getLeaf(false);
  await leaf.setViewState({
    type: BINARY_NOTES_VIEW_TYPE,
    state: { companionPath },
    active: true,
  });
}
