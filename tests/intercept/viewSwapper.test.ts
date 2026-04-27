import { describe, it, expect, vi } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { ViewSwapper } from '../../src/intercept/viewSwapper';

describe('ViewSwapper', () => {
  it('abre o companion .md via leaf.openFile quando active leaf é binário com companion', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app as any);
    plugin.app.vault.__setFile('paper.pdf', undefined, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const swapper = new ViewSwapper(plugin.app as any, registry);
    swapper.initialize();

    const leaf = plugin.app.workspace.__createLeafWithFile('paper.pdf', 'pdf');
    const openSpy = vi.spyOn(leaf, 'openFile');
    plugin.app.workspace.__triggerActiveLeafChange(leaf);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(openSpy).toHaveBeenCalled();
    const arg = openSpy.mock.calls[0]?.[0] as { path?: string } | undefined;
    expect(arg?.path).toBe('paper.pdf.md');
  });

  it('não dispara quando o leaf já está mostrando o companion .md (evita loop)', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app as any);
    plugin.app.vault.__setFile('paper.pdf', undefined, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const swapper = new ViewSwapper(plugin.app as any, registry);
    swapper.initialize();

    // Leaf com o companion .md aberto — isCompanionPath retorna true, não swap
    const leaf = plugin.app.workspace.__createLeafWithFile('paper.pdf.md', 'markdown');
    const openSpy = vi.spyOn(leaf, 'openFile');
    plugin.app.workspace.__triggerActiveLeafChange(leaf);
    await Promise.resolve();
    await Promise.resolve();

    expect(openSpy).not.toHaveBeenCalled();
  });
});
