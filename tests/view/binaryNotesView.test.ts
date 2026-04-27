import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { BinaryNotesView } from '../../src/view/binaryNotesView';
import { BINARY_NOTES_VIEW_TYPE } from '../../src/constants';
import { MarkdownRenderer } from '../obsidian.mock';

describe('BinaryNotesView', () => {
  let plugin: ReturnType<typeof createPlugin>;
  let registry: CompanionRegistry;
  let leaf: any;

  beforeEach(async () => {
    plugin = createPlugin();
    registry = new CompanionRegistry(plugin.app);
    plugin.app.vault.__setFile('paper.pdf', null, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' }, 'md', 'meu body');
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();
    leaf = plugin.app.workspace.__createLeaf();
  });

  it('expõe view type correto', () => {
    const view = new BinaryNotesView(leaf, registry);
    expect(view.getViewType()).toBe(BINARY_NOTES_VIEW_TYPE);
  });

  it('display name reflete companion carregado', async () => {
    const view = new BinaryNotesView(leaf, registry);
    await view.setState({ companionPath: 'paper.pdf.md' }, { history: false });
    expect(view.getDisplayText()).toContain('paper.pdf');
  });

  it('renderiza embed do binário e body do companion via MarkdownRenderer', async () => {
    const renderSpy = vi.spyOn(MarkdownRenderer, 'render');
    const view = new BinaryNotesView(leaf, registry);
    await view.setState({ companionPath: 'paper.pdf.md' }, { history: false });
    await view.onOpen();

    expect(renderSpy).toHaveBeenCalled();
    const markdownArgs = renderSpy.mock.calls.map((c) => c[1]).join('\n');
    expect(markdownArgs).toContain('![[paper.pdf]]');
    expect(markdownArgs).toContain('meu body');
  });

  it('lida graciosamente com companion deletado durante view aberta', async () => {
    const view = new BinaryNotesView(leaf, registry);
    await view.setState({ companionPath: 'paper.pdf.md' }, { history: false });
    await view.onOpen();

    // simula delete
    plugin.app.vault.__deleteFile('paper.pdf.md');
    plugin.app.vault.__triggerDelete('paper.pdf.md');
    await Promise.resolve();
    // Não deve lançar; pode chamar leaf.detach()
    expect(true).toBe(true);
  });

  it('detach manual previne duplicação em hot-reload', async () => {
    const view = new BinaryNotesView(leaf, registry);
    await view.setState({ companionPath: 'paper.pdf.md' }, { history: false });
    await view.onOpen();
    expect(leaf.__getActions().length).toBe(1); // após primeiro mount, exatamente 1 action
    await view.onClose();
    await view.onOpen();
    await view.onClose();
    // Após cycle hot-reload completo, ainda no máximo 1
    expect(leaf.__getActions().length).toBeLessThanOrEqual(1);
  });
});
