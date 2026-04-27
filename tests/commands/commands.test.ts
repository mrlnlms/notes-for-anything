import { describe, it, expect, vi } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { registerCommands } from '../../src/commands/commands';
import { DEFAULT_SETTINGS } from '../../src/settings/settings';

describe('commands', () => {
  it('Add Binary Notes cria companion ao lado do binário com frontmatter binary:', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app as any);
    plugin.app.vault.__setFile('paper.pdf', undefined, 'binary');
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    registerCommands(plugin as any, plugin.app as any, registry, () => DEFAULT_SETTINGS);

    plugin.app.workspace.__setActiveFile('paper.pdf');
    await plugin.__runCommand('add-binary-notes');

    const created = plugin.app.vault.__getFile('paper.pdf.md');
    expect(created).toBeDefined();
    expect(created!.content).toMatch(/binary: paper\.pdf/);
  });

  it('Add Binary Notes em binário com companion existente abre o existente em vez de criar novo', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app as any);
    plugin.app.vault.__setFile('paper.pdf', undefined, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    registerCommands(plugin as any, plugin.app as any, registry, () => DEFAULT_SETTINGS);
    plugin.app.workspace.__setActiveFile('paper.pdf');
    const createSpy = vi.spyOn(plugin.app.vault, 'create');
    await plugin.__runCommand('add-binary-notes');
    expect(createSpy).not.toHaveBeenCalled();
  });
});
