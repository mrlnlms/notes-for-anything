import { App, EventRef, TFile, TAbstractFile } from 'obsidian';
import { FM_KEY_BINARY } from '../constants';
import { isSupportedBinary, formatBinaryWikilink } from '../utils/pathResolver';
import { CompanionRegistry } from '../registry/companionRegistry';

export class VaultLifecycleHandler {
  private renameRef: EventRef | null = null;
  private deleteRef: EventRef | null = null;

  constructor(
    private app: App,
    private registry: CompanionRegistry,
  ) {}

  initialize(): void {
    this.renameRef = this.app.vault.on('rename', (file, oldPath) => {
      this.handleRename(file, oldPath);
    });
    this.deleteRef = this.app.vault.on('delete', (file) => {
      this.handleDelete(file);
    });
  }

  unload(): void {
    if (this.renameRef) this.app.vault.offref(this.renameRef);
    if (this.deleteRef) this.app.vault.offref(this.deleteRef);
  }

  private async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    if (!(file instanceof TFile)) return;

    // Companion renomeado → atualizar índice (registry é a fonte de verdade)
    if (this.registry.getBinaryFor(oldPath)) {
      this.registry.migrateFilePath(oldPath, file.path);
      return;
    }

    // Binário renomeado → atualizar `binary:` no companion correspondente
    if (isSupportedBinary(oldPath)) {
      const companionPath = this.registry.getCompanionFor(oldPath);
      if (!companionPath) return;
      const companionFile = this.app.vault.getAbstractFileByPath(companionPath);
      if (!(companionFile instanceof TFile)) return;

      this.registry.beginWrite(companionPath);
      try {
        await this.app.fileManager.processFrontMatter(companionFile, (fm) => {
          // Preserva o formato existente: wikilink continua wikilink, literal continua literal.
          // Obsidian normalmente atualiza wikilinks sozinho em renames internos quando
          // "Auto-update internal links" está ON; aqui o re-write fica idempotente.
          const current = fm[FM_KEY_BINARY];
          const isWikilink =
            typeof current === 'string' && /^\s*\[\[.+\]\]\s*$/.test(current);
          fm[FM_KEY_BINARY] = isWikilink ? formatBinaryWikilink(file.path) : file.path;
        });
      } finally {
        this.registry.endWrite(companionPath);
      }
    }
  }

  private async handleDelete(file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile)) return;

    // Companion deletado → registry cleanup (frontmatter é a fonte de verdade)
    if (this.registry.getBinaryFor(file.path)) {
      this.registry.handleCompanionRemoved(file.path);
      return;
    }

    // Binário deletado → cascade no companion
    if (isSupportedBinary(file.path)) {
      const companionPath = this.registry.getCompanionFor(file.path);
      if (!companionPath) return;
      const companionFile = this.app.vault.getAbstractFileByPath(companionPath);
      if (companionFile instanceof TFile) {
        await this.app.vault.delete(companionFile);
      }
    }
  }
}
