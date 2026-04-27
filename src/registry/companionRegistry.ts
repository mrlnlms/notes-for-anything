// src/registry/companionRegistry.ts
import { App, EventRef, TFile } from 'obsidian';
import { FM_KEY_BINARY, FM_KEY_VISIBLE } from '../constants';
import type { RegistryMutationListener } from '../types';

interface CompanionMeta {
  companionPath: string;
  visible: boolean;
}

/**
 * Índice reverso companion ↔ binário.
 *
 * Regra: **um companion por binário**. Plugin previne criação de múltiplos via
 * "Add Binary Notes" (commands.ts checa se já existe antes de criar). Caso
 * patológico (user editou manualmente um `.md` qualquer pra apontar pra um binário
 * que já tem companion): last writer wins. Sem tie-break, sem candidates set, sem
 * `resolveActive`. O `.md` "perdedor" continua existindo no vault como nota normal,
 * mas não está registrado como companion ativo.
 */
export class CompanionRegistry {
  // Map<binaryPath, CompanionMeta> — o companion ativo deste binário
  private byBinary = new Map<string, CompanionMeta>();
  // Map<companionPath, binaryPath> — reverse lookup
  private byCompanion = new Map<string, string>();

  private metadataCacheRef: EventRef | null = null;
  private writingInProgress = new Set<string>();
  private listeners = new Set<RegistryMutationListener>();

  constructor(private app: App) {}

  initialize(): void {
    this.metadataCacheRef = this.app.metadataCache.on('changed', (file: TFile) => {
      if (file.extension === 'md' && !this.writingInProgress.has(file.path)) {
        this.syncFromFrontmatter(file.path);
      }
    });

    // Initial scan deferido pra evitar deadlock no onload
    this.app.workspace.onLayoutReady(() => {
      for (const file of this.app.vault.getMarkdownFiles()) {
        this.syncFromFrontmatter(file.path);
      }
    });
  }

  unload(): void {
    if (this.metadataCacheRef) {
      this.app.metadataCache.offref(this.metadataCacheRef);
      this.metadataCacheRef = null;
    }
    this.listeners.clear();
  }

  getCompanionFor(binaryPath: string): string | null {
    return this.byBinary.get(binaryPath)?.companionPath ?? null;
  }

  getBinaryFor(companionPath: string): string | null {
    return this.byCompanion.get(companionPath) ?? null;
  }

  isCompanionVisible(companionPath: string): boolean {
    const binaryPath = this.byCompanion.get(companionPath);
    if (!binaryPath) return false;
    const meta = this.byBinary.get(binaryPath);
    return meta?.visible ?? false;
  }

  hasCompanion(binaryPath: string): boolean {
    return this.byBinary.has(binaryPath);
  }

  addOnMutate(fn: RegistryMutationListener): void {
    this.listeners.add(fn);
  }

  removeOnMutate(fn: RegistryMutationListener): void {
    this.listeners.delete(fn);
  }

  /** Marca writingInProgress antes de processFrontMatter; libera no próximo tick */
  beginWrite(companionPath: string): void {
    this.writingInProgress.add(companionPath);
  }

  endWrite(companionPath: string): void {
    setTimeout(() => this.writingInProgress.delete(companionPath), 0);
  }

  /** Re-vincula o índice quando um companion é renomeado */
  migrateFilePath(oldPath: string, newPath: string): void {
    const binaryPath = this.byCompanion.get(oldPath);
    if (!binaryPath) return;

    this.byCompanion.delete(oldPath);
    this.byCompanion.set(newPath, binaryPath);

    const meta = this.byBinary.get(binaryPath);
    if (meta && meta.companionPath === oldPath) {
      this.byBinary.set(binaryPath, { ...meta, companionPath: newPath });
    }
    this.notify(binaryPath);
  }

  /** Lê o frontmatter do file e atualiza índice. Last writer wins. */
  private syncFromFrontmatter(companionPath: string): void {
    const file = this.app.vault.getAbstractFileByPath(companionPath);
    if (!(file instanceof TFile)) {
      this.handleCompanionRemoved(companionPath);
      return;
    }
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const binaryPath = fm[FM_KEY_BINARY];

    if (typeof binaryPath !== 'string') {
      this.handleCompanionRemoved(companionPath);
      return;
    }

    const visible = fm[FM_KEY_VISIBLE] === true;

    // Re-vincular: se este companion estava apontando pra outro binário antes,
    // remove a relação antiga (e desativa o byBinary se este era o ativo do antigo).
    const previousBinary = this.byCompanion.get(companionPath);
    if (previousBinary && previousBinary !== binaryPath) {
      const oldMeta = this.byBinary.get(previousBinary);
      if (oldMeta && oldMeta.companionPath === companionPath) {
        this.byBinary.delete(previousBinary);
      }
      this.notify(previousBinary);
    }

    this.byCompanion.set(companionPath, binaryPath);
    this.byBinary.set(binaryPath, { companionPath, visible }); // last writer wins
    this.notify(binaryPath);
  }

  /** Chamado quando companion é deletado ou perdeu o frontmatter binary: */
  handleCompanionRemoved(companionPath: string): void {
    const binaryPath = this.byCompanion.get(companionPath);
    if (!binaryPath) return;
    this.byCompanion.delete(companionPath);
    const meta = this.byBinary.get(binaryPath);
    if (meta && meta.companionPath === companionPath) {
      this.byBinary.delete(binaryPath);
    }
    this.notify(binaryPath);
  }

  private notify(binaryPath: string): void {
    const companionPath = this.getCompanionFor(binaryPath);
    for (const fn of this.listeners) fn(binaryPath, companionPath);
  }
}
