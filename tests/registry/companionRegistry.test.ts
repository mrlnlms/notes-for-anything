// tests/registry/companionRegistry.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';

describe('CompanionRegistry', () => {
  let registry: CompanionRegistry;
  let plugin: ReturnType<typeof createPlugin>;

  beforeEach(() => {
    plugin = createPlugin();
    registry = new CompanionRegistry(plugin.app);
  });

  describe('inicialização', () => {
    it('começa com índice vazio', () => {
      expect(registry.getCompanionFor('paper.pdf')).toBeNull();
      expect(registry.getBinaryFor('paper.pdf.md')).toBeNull();
    });

    it('initialize() varre vault e popula índice na onLayoutReady', async () => {
      plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();
      expect(registry.getCompanionFor('paper.pdf')).toBe('paper.pdf.md');
      expect(registry.getBinaryFor('paper.pdf.md')).toBe('paper.pdf');
    });
  });

  describe('lookup', () => {
    beforeEach(async () => {
      plugin.app.vault.__setFile('a.pdf.md', { binary: 'a.pdf' });
      plugin.app.vault.__setFile('b.png.md', { binary: 'b.png', visible: true });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();
    });

    it('getCompanionFor retorna path do companion', () => {
      expect(registry.getCompanionFor('a.pdf')).toBe('a.pdf.md');
      expect(registry.getCompanionFor('b.png')).toBe('b.png.md');
      expect(registry.getCompanionFor('z.pdf')).toBeNull();
    });

    it('getBinaryFor retorna path do binário', () => {
      expect(registry.getBinaryFor('a.pdf.md')).toBe('a.pdf');
    });

    it('isCompanionVisible respeita frontmatter `visible: true`', () => {
      expect(registry.isCompanionVisible('a.pdf.md')).toBe(false);
      expect(registry.isCompanionVisible('b.png.md')).toBe(true);
    });
  });

  describe('reativo a metadataCache changes', () => {
    it('detecta novo companion criado', async () => {
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();

      plugin.app.vault.__setFile('new.pdf.md', { binary: 'new.pdf' });
      plugin.app.metadataCache.__triggerChanged('new.pdf.md');

      expect(registry.getCompanionFor('new.pdf')).toBe('new.pdf.md');
    });

    it('remove entrada quando frontmatter binary: é deletado', async () => {
      plugin.app.vault.__setFile('a.pdf.md', { binary: 'a.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();

      plugin.app.vault.__setFile('a.pdf.md', {}); // frontmatter sem binary
      plugin.app.metadataCache.__triggerChanged('a.pdf.md');

      expect(registry.getCompanionFor('a.pdf')).toBeNull();
    });

    it('re-vincula companion quando binary: aponta para novo binário (limpa o antigo)', async () => {
      plugin.app.vault.__setFile('c.md', { binary: 'old.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();
      expect(registry.getCompanionFor('old.pdf')).toBe('c.md');

      plugin.app.vault.__setFile('c.md', { binary: 'new.pdf' });
      plugin.app.metadataCache.__triggerChanged('c.md');

      expect(registry.getCompanionFor('old.pdf')).toBeNull();
      expect(registry.getCompanionFor('new.pdf')).toBe('c.md');
      expect(registry.getBinaryFor('c.md')).toBe('new.pdf');
    });
  });

  describe('múltiplos companions pro mesmo binário (defensive)', () => {
    it('prefere o companion ao lado do binário', async () => {
      plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
      plugin.app.vault.__setFile('outro/paper.pdf.md', { binary: 'paper.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();
      expect(registry.getCompanionFor('paper.pdf')).toBe('paper.pdf.md');
    });

    it('fallback alfabético quando nenhum está ao lado', async () => {
      plugin.app.vault.__setFile('zz/paper.pdf.md', { binary: 'paper.pdf' });
      plugin.app.vault.__setFile('aa/paper.pdf.md', { binary: 'paper.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();
      expect(registry.getCompanionFor('paper.pdf')).toBe('aa/paper.pdf.md');
    });
  });

  describe('migrateFilePath', () => {
    it('atualiza índice quando companion é renomeado', async () => {
      plugin.app.vault.__setFile('old.pdf.md', { binary: 'paper.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();

      registry.migrateFilePath('old.pdf.md', 'new.pdf.md');

      expect(registry.getCompanionFor('paper.pdf')).toBe('new.pdf.md');
      expect(registry.getBinaryFor('old.pdf.md')).toBeNull();
      expect(registry.getBinaryFor('new.pdf.md')).toBe('paper.pdf');
    });
  });

  describe('listener notifications', () => {
    it('notifica listeners com (binaryPath, companionPath) ao adicionar', async () => {
      const spy = vi.fn();
      registry.addOnMutate(spy);
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();

      plugin.app.vault.__setFile('x.pdf.md', { binary: 'x.pdf' });
      plugin.app.metadataCache.__triggerChanged('x.pdf.md');

      expect(spy).toHaveBeenCalledWith('x.pdf', 'x.pdf.md');
    });

    it('notifica com companionPath=null quando companion perde binary:', async () => {
      plugin.app.vault.__setFile('a.pdf.md', { binary: 'a.pdf' });
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();

      const spy = vi.fn();
      registry.addOnMutate(spy);
      plugin.app.vault.__setFile('a.pdf.md', {});
      plugin.app.metadataCache.__triggerChanged('a.pdf.md');

      expect(spy).toHaveBeenCalledWith('a.pdf', null);
    });

    it('removeOnMutate desinscreve o listener', async () => {
      const spy = vi.fn();
      registry.addOnMutate(spy);
      registry.removeOnMutate(spy);
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();

      plugin.app.vault.__setFile('x.pdf.md', { binary: 'x.pdf' });
      plugin.app.metadataCache.__triggerChanged('x.pdf.md');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('writingInProgress (beginWrite/endWrite)', () => {
    it('beginWrite suprime sync; endWrite libera após próximo tick', async () => {
      registry.initialize();
      await plugin.app.workspace.__triggerLayoutReady();

      plugin.app.vault.__setFile('a.pdf.md', { binary: 'a.pdf' });
      registry.beginWrite('a.pdf.md');
      plugin.app.metadataCache.__triggerChanged('a.pdf.md');
      expect(registry.getCompanionFor('a.pdf')).toBeNull(); // sync foi suprimido

      registry.endWrite('a.pdf.md');
      await new Promise((r) => setTimeout(r, 0));
      plugin.app.metadataCache.__triggerChanged('a.pdf.md');
      expect(registry.getCompanionFor('a.pdf')).toBe('a.pdf.md');
    });
  });
});
