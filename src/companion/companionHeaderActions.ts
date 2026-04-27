import { App, Plugin, TFile, View, WorkspaceLeaf } from 'obsidian';
import { CompanionRegistry } from '../registry/companionRegistry';
import { swapBypass } from '../intercept/viewSwapper';
import { isCompanionPath, isSupportedBinary } from '../utils/pathResolver';

/**
 * Adiciona header actions de navegação binário↔companion:
 *
 * - Quando uma view abre um companion `.md`: botão "Open binary in viewer"
 *   (abre o binário na mesma leaf).
 * - Quando uma view abre um binário que tem companion: botão "Open companion notes"
 *   (abre o `.md` companion na mesma leaf).
 *
 * Detecta o tipo pelo PATH do arquivo aberto (não por instanceof View) — isso evita
 * problemas com FileView subclasses específicas (PDF, image, etc) que não compartilham
 * a hierarquia esperada em runtime.
 *
 * Pattern WeakMap pra detach manual + tracking do `targetPath` pra invalidar quando
 * a leaf troca de companion/binário (Obsidian não limpa view.addAction, e mudar de file
 * dentro da mesma leaf não dispara onClose).
 */
interface ButtonState {
  el: HTMLElement;
  targetPath: string;
  view: ViewWithAction;
}

interface ViewWithAction extends View {
  addAction(icon: string, title: string, callback: () => void): HTMLElement;
  file?: TFile | null;
}

const buttonsByLeaf = new WeakMap<WorkspaceLeaf, ButtonState>();

export function registerCompanionHeaderActions(
  plugin: Plugin,
  app: App,
  registry: CompanionRegistry,
): void {
  const refresh = () => syncAllLeaves(app, registry);

  plugin.registerEvent(app.workspace.on('file-open', () => refresh()));
  plugin.registerEvent(app.workspace.on('layout-change', () => refresh()));
  plugin.registerEvent(app.workspace.on('active-leaf-change', () => refresh()));

  app.workspace.onLayoutReady(() => refresh());
}

function syncAllLeaves(app: App, registry: CompanionRegistry): void {
  app.workspace.iterateAllLeaves((leaf) => {
    syncLeaf(app, registry, leaf);
  });
}

function syncLeaf(app: App, registry: CompanionRegistry, leaf: WorkspaceLeaf): void {
  const view = leaf.view as ViewWithAction;
  const file = view?.file;
  if (!file || typeof view.addAction !== 'function') {
    detachButton(leaf);
    return;
  }

  // Companion .md aberto → botão "Open binary in viewer"
  if (isCompanionPath(file.path)) {
    const binaryPath = registry.getBinaryFor(file.path);
    if (!binaryPath) {
      detachButton(leaf);
      return;
    }
    ensureButton(leaf, view, binaryPath, 'image-file', 'Open binary in viewer', (path) => {
      void openInSameLeaf(app, path, leaf);
    });
    return;
  }

  // Binário com companion → botão "Open companion notes"
  if (isSupportedBinary(file.path)) {
    const companionPath = registry.getCompanionFor(file.path);
    if (!companionPath) {
      detachButton(leaf);
      return;
    }
    ensureButton(leaf, view, companionPath, 'file-text', 'Open companion notes', (path) => {
      void openInSameLeaf(app, path, leaf);
    });
    return;
  }

  detachButton(leaf);
}

function ensureButton(
  leaf: WorkspaceLeaf,
  view: ViewWithAction,
  targetPath: string,
  icon: string,
  title: string,
  onClick: (target: string) => void,
): void {
  const existing = buttonsByLeaf.get(leaf);
  if (existing && existing.targetPath === targetPath && existing.view === view) {
    return; // botão já correto pra este alvo
  }
  if (existing) existing.el.detach();
  const el = view.addAction(icon, title, () => onClick(targetPath));
  buttonsByLeaf.set(leaf, { el, targetPath, view });
}

function detachButton(leaf: WorkspaceLeaf): void {
  const state = buttonsByLeaf.get(leaf);
  if (!state) return;
  state.el.detach();
  buttonsByLeaf.delete(leaf);
}

async function openInSameLeaf(app: App, path: string, leaf: WorkspaceLeaf): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return;
  // Bypass do ViewSwapper pra evitar redirect automático / race com PDF.js
  swapBypass.add(leaf);
  try {
    await leaf.openFile(file);
  } finally {
    setTimeout(() => swapBypass.delete(leaf), 100);
  }
}
