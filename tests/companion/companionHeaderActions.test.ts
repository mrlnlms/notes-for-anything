// tests/companion/companionHeaderActions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { registerCompanionHeaderActions } from '../../src/companion/companionHeaderActions';

describe('companionHeaderActions', () => {
  let plugin: ReturnType<typeof createPlugin>;
  let registry: CompanionRegistry;

  beforeEach(async () => {
    plugin = createPlugin();
    registry = new CompanionRegistry(plugin.app as any);
    plugin.app.vault.__setFile('paper.pdf', undefined, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();
  });

  it('adiciona botão no header de uma leaf com o companion `.md`', async () => {
    const leaf = plugin.app.workspace.__createLeafWithFile('paper.pdf.md', 'markdown');
    registerCompanionHeaderActions(plugin as any, plugin.app as any, registry);
    await plugin.app.workspace.__triggerLayoutReady();

    expect(leaf.__getActions()).toHaveLength(1);
  });

  it('adiciona botão no header de uma leaf com o binário (que tem companion)', async () => {
    const leaf = plugin.app.workspace.__createLeafWithFile('paper.pdf', 'pdf');
    registerCompanionHeaderActions(plugin as any, plugin.app as any, registry);
    await plugin.app.workspace.__triggerLayoutReady();

    expect(leaf.__getActions()).toHaveLength(1);
  });

  it('não adiciona botão em arquivo sem relação com companion', async () => {
    plugin.app.vault.__setFile('outro.md', { tags: ['nota'] });
    const leaf = plugin.app.workspace.__createLeafWithFile('outro.md', 'markdown');
    registerCompanionHeaderActions(plugin as any, plugin.app as any, registry);
    await plugin.app.workspace.__triggerLayoutReady();

    expect(leaf.__getActions()).toHaveLength(0);
  });

  it('não duplica quando o mesmo refresh é disparado várias vezes na mesma leaf', async () => {
    const leaf = plugin.app.workspace.__createLeafWithFile('paper.pdf.md', 'markdown');
    registerCompanionHeaderActions(plugin as any, plugin.app as any, registry);
    await plugin.app.workspace.__triggerLayoutReady();

    plugin.app.workspace.__triggerLayoutChange();
    plugin.app.workspace.__triggerFileOpen(plugin.app.vault.__getFile('paper.pdf.md')!.file);
    plugin.app.workspace.__triggerActiveLeafChange(leaf);

    expect(leaf.__getActions()).toHaveLength(1);
  });

  // S10 — bug que motivou esse teste
  it('remove os botões DOM no unload (cleanup pra evitar duplicação no hot-reload)', async () => {
    const leaf = plugin.app.workspace.__createLeafWithFile('paper.pdf.md', 'markdown');
    registerCompanionHeaderActions(plugin as any, plugin.app as any, registry);
    await plugin.app.workspace.__triggerLayoutReady();
    expect(leaf.__getActions()).toHaveLength(1);

    plugin.__triggerUnload();

    expect(leaf.__getActions()).toHaveLength(0);
  });

  it('re-registrar após unload não duplica botão (simula ciclo do hot-reload)', async () => {
    const leaf = plugin.app.workspace.__createLeafWithFile('paper.pdf.md', 'markdown');

    // Ciclo 1: registra → cleanup → re-registra
    registerCompanionHeaderActions(plugin as any, plugin.app as any, registry);
    await plugin.app.workspace.__triggerLayoutReady();
    expect(leaf.__getActions()).toHaveLength(1);

    plugin.__triggerUnload();
    expect(leaf.__getActions()).toHaveLength(0);

    // Ciclo 2: nova vida do plugin (mesmo module-level WeakMap permanece — simula a parte
    // que não muda no hot-reload). Sem cleanup, o segundo registro adicionaria botão por cima.
    registerCompanionHeaderActions(plugin as any, plugin.app as any, registry);
    await plugin.app.workspace.__triggerLayoutReady();

    expect(leaf.__getActions()).toHaveLength(1);
  });
});
