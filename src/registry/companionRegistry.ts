// src/registry/companionRegistry.ts
import { App, EventRef, TFile } from 'obsidian';
import { FM_KEY_BINARY, FM_KEY_VISIBLE } from '../constants';
import type { RegistryMutationListener } from '../types';

interface CompanionMeta {
  companionPath: string;
  visible: boolean;
}

export class CompanionRegistry {
  // Map<binaryPath, CompanionMeta> — escolha já resolvida quando há múltiplos
  private byBinary = new Map<string, CompanionMeta>();
  // Map<companionPath, binaryPath> — reverse lookup
  private byCompanion = new Map<string, string>();
  // Pra resolver tie-break: Map<binaryPath, Set<companionPath>>
  private candidates = new Map<string, Set<string>>();

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

    const set = this.candidates.get(binaryPath);
    if (set) {
      set.delete(oldPath);
      set.add(newPath);
    }

    const meta = this.byBinary.get(binaryPath);
    if (meta && meta.companionPath === oldPath) {
      this.byBinary.set(binaryPath, { ...meta, companionPath: newPath });
    }
    this.notify(binaryPath);
  }

  /** Lê o frontmatter do file e atualiza índice */
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

    // Re-vincular: se companionPath já estava ligado a outro binário, limpar
    const previousBinary = this.byCompanion.get(companionPath);
    if (previousBinary && previousBinary !== binaryPath) {
      this.removeCandidate(previousBinary, companionPath);
    }

    this.byCompanion.set(companionPath, binaryPath);
    this.addCandidate(binaryPath, companionPath);
    this.resolveActive(binaryPath);
    if (previousBinary && previousBinary !== binaryPath) {
      this.resolveActive(previousBinary);
    }

    this.notify(binaryPath);
    if (previousBinary && previousBinary !== binaryPath) {
      this.notify(previousBinary);
    }
  }

  /** Chamado quando companion é deletado ou perdeu o frontmatter binary: */
  handleCompanionRemoved(companionPath: string): void {
    const binaryPath = this.byCompanion.get(companionPath);
    if (!binaryPath) return;
    this.byCompanion.delete(companionPath);
    this.removeCandidate(binaryPath, companionPath);
    this.resolveActive(binaryPath);
    this.notify(binaryPath);
  }

  private addCandidate(binaryPath: string, companionPath: string): void {
    let set = this.candidates.get(binaryPath);
    if (!set) {
      set = new Set();
      this.candidates.set(binaryPath, set);
    }
    set.add(companionPath);
  }

  private removeCandidate(binaryPath: string, companionPath: string): void {
    const set = this.candidates.get(binaryPath);
    if (!set) return;
    set.delete(companionPath);
    if (set.size === 0) this.candidates.delete(binaryPath);
  }

  /** Tie-break: prefere ao lado do binário, depois alfabético. Sempre re-lê visible do FM (sem shortcut hint). */
  private resolveActive(binaryPath: string): void {
    const set = this.candidates.get(binaryPath);
    if (!set || set.size === 0) {
      this.byBinary.delete(binaryPath);
      return;
    }
    const expected = `${binaryPath}.md`;
    let chosen: string;
    if (set.has(expected)) {
      chosen = expected;
    } else {
      chosen = [...set].sort()[0];
    }

    let visible = false;
    const file = this.app.vault.getAbstractFileByPath(chosen);
    if (file instanceof TFile) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      visible = fm[FM_KEY_VISIBLE] === true;
    }

    this.byBinary.set(binaryPath, { companionPath: chosen, visible });
  }

  private notify(binaryPath: string): void {
    const companionPath = this.getCompanionFor(binaryPath);
    for (const fn of this.listeners) fn(binaryPath, companionPath);
  }
}
