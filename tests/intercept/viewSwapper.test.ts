import { describe, it, expect } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { ViewSwapper } from '../../src/intercept/viewSwapper';
import { BINARY_NOTES_VIEW_TYPE } from '../../src/constants';

describe('ViewSwapper', () => {
  it('faz setViewState quando active leaf abre binário com companion', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app as any);
    plugin.app.vault.__setFile('paper.pdf', undefined, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const swapper = new ViewSwapper(plugin.app as any, registry);
    swapper.initialize();

    const leaf = plugin.app.workspace.__createLeafWithFile('paper.pdf', 'pdf');
    plugin.app.workspace.__triggerActiveLeafChange(leaf);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const last = plugin.app.workspace.__getLastSetViewState();
    expect(last?.type).toBe(BINARY_NOTES_VIEW_TYPE);
  });

  it('não re-dispara quando já está em BinaryNotesView (evita loop)', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app as any);
    plugin.app.vault.__setFile('paper.pdf', undefined, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const swapper = new ViewSwapper(plugin.app as any, registry);
    swapper.initialize();

    const leaf = plugin.app.workspace.__createLeafWithViewType(BINARY_NOTES_VIEW_TYPE);
    plugin.app.workspace.__resetSetViewStateLog();
    plugin.app.workspace.__triggerActiveLeafChange(leaf);
    await Promise.resolve();
    await Promise.resolve();

    expect(plugin.app.workspace.__getLastSetViewState()).toBeNull();
  });
});
