import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { VaultLifecycleHandler } from '../../src/lifecycle/vaultLifecycleHandler';

describe('VaultLifecycleHandler', () => {
  let plugin: ReturnType<typeof createPlugin>;
  let registry: CompanionRegistry;
  let handler: VaultLifecycleHandler;

  beforeEach(async () => {
    plugin = createPlugin();
    registry = new CompanionRegistry(plugin.app);
    handler = new VaultLifecycleHandler(plugin.app, registry);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    handler.initialize();
    await plugin.app.workspace.__triggerLayoutReady();
  });

  describe('rename do binário', () => {
    it('atualiza binary: no companion', async () => {
      const fm: Record<string, unknown> = { binary: 'paper.pdf' };
      plugin.app.fileManager.__mockProcessFrontMatter('paper.pdf.md', fm);

      await plugin.app.vault.__triggerRename('paper.pdf', 'renamed.pdf');

      expect(fm.binary).toBe('renamed.pdf');
    });

    it('atualiza índice no registry', async () => {
      const fm: Record<string, unknown> = { binary: 'paper.pdf' };
      plugin.app.fileManager.__mockProcessFrontMatter('paper.pdf.md', fm);

      await plugin.app.vault.__triggerRename('paper.pdf', 'renamed.pdf');
      // Aguarda endWrite (setTimeout 0) liberar o writingInProgress
      await new Promise((r) => setTimeout(r, 0));
      // Simula metadataCache sync após processFrontMatter
      plugin.app.vault.__setFile('paper.pdf.md', { binary: 'renamed.pdf' });
      plugin.app.metadataCache.__triggerChanged('paper.pdf.md');

      expect(registry.getCompanionFor('renamed.pdf')).toBe('paper.pdf.md');
      expect(registry.getCompanionFor('paper.pdf')).toBeNull();
    });
  });

  describe('delete do binário', () => {
    it('cascata: deleta o companion silenciosamente', async () => {
      const deleteSpy = vi.spyOn(plugin.app.vault, 'delete');
      await plugin.app.vault.__triggerDelete('paper.pdf');
      expect(deleteSpy).toHaveBeenCalledWith(expect.objectContaining({ path: 'paper.pdf.md' }));
    });

    it('não toca o binário quando o companion é deletado (não cascateia reverso)', async () => {
      const deleteSpy = vi.spyOn(plugin.app.vault, 'delete');
      await plugin.app.vault.__triggerDelete('paper.pdf.md');
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('rename do companion', () => {
    it('chama registry.migrateFilePath', async () => {
      const spy = vi.spyOn(registry, 'migrateFilePath');
      await plugin.app.vault.__triggerRename('paper.pdf.md', 'new.pdf.md');
      expect(spy).toHaveBeenCalledWith('paper.pdf.md', 'new.pdf.md');
    });
  });
});
