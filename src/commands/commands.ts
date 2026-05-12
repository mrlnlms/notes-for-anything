// src/commands/commands.ts
import { App, Notice, Plugin, TFile, Menu } from 'obsidian';
import {
  isSupportedBinary,
  defaultCompanionPath,
  formatBinaryWikilink,
} from '../utils/pathResolver';
import { CompanionRegistry } from '../registry/companionRegistry';
import {
  CMD_ADD_COMPANION_NOTE,
  CMD_TOGGLE_SOURCE,
  FM_KEY_BINARY,
} from '../constants';
import type { NotesForAnythingSettings } from '../settings/settings';

export function registerCommands(
  plugin: Plugin,
  app: App,
  registry: CompanionRegistry,
  getSettings: () => NotesForAnythingSettings,
): void {
  // Comando "Add companion note" — acessível via menu de contexto e palette
  plugin.addCommand({
    id: CMD_ADD_COMPANION_NOTE,
    name: 'Add companion note',
    checkCallback: (checking) => {
      const file = app.workspace.getActiveFile();
      const ok = file !== null && isSupportedBinary(file.path);
      if (checking) return ok;
      if (!file) return false;
      void addOrOpen(app, registry, getSettings, file);
      return true;
    },
  });

  // "Open binary in viewer" — quando o companion .md está ativo, abre o binário associado
  // em um split novo (PDF++, viewer nativo, ou qualquer plugin especialista assume).
  plugin.addCommand({
    id: CMD_TOGGLE_SOURCE,
    name: 'Open binary in viewer',
    checkCallback: (checking) => {
      const activeFile = app.workspace.getActiveFile();
      if (!activeFile) return false;
      const binaryPath = registry.getBinaryFor(activeFile.path);
      if (!binaryPath) return false;
      if (checking) return true;
      const binaryFile = app.vault.getAbstractFileByPath(binaryPath);
      if (!(binaryFile instanceof TFile)) return false;
      const newLeaf = app.workspace.getLeaf('split');
      void newLeaf.openFile(binaryFile);
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
          .setTitle(registry.hasCompanion(file.path) ? 'Open companion note' : 'Add companion note')
          .setIcon('file-symlink')
          .onClick(() => void addOrOpen(app, registry, getSettings, file));
      });
    }),
  );
}

async function addOrOpen(
  app: App,
  registry: CompanionRegistry,
  getSettings: () => NotesForAnythingSettings,
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
    // Template inicial: frontmatter com binary: como wikilink (graph-aware).
    // Aspas duplas no value são obrigatórias — sem aspas o YAML interpreta `[[...]]`
    // como flow array aninhado. Wikilink permite ao Obsidian indexar a bridge
    // companion→binário no graph e atualizar paths automaticamente em renames.
    const wikilink = formatBinaryWikilink(binaryFile.path);
    const initial = `---\n${FM_KEY_BINARY}: "${wikilink}"\n---\n\n${body}`;
    await app.vault.create(companionPath, initial);
  }

  // Abre o companion como MarkdownView nativa (Properties + body editáveis)
  const companionFile = app.vault.getAbstractFileByPath(companionPath);
  if (!(companionFile instanceof TFile)) return;
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(companionFile);
}
