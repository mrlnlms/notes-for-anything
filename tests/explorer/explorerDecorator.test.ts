import { describe, it, expect, beforeEach } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { ExplorerDecorator } from '../../src/explorer/explorerDecorator';
import { CSS_CLASSES } from '../../src/constants';

describe('ExplorerDecorator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
  });

  it('aplica classe has-binary-companion no item do binário', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app as any);
    plugin.app.vault.__setFile('paper.pdf', undefined, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const item = document.createElement('div');
    item.classList.add('nav-file-title');
    item.setAttribute('data-path', 'paper.pdf');
    document.body.appendChild(item);

    const decorator = new ExplorerDecorator(plugin as any, registry);
    decorator.initialize(true);
    await plugin.app.workspace.__triggerLayoutReady();
    decorator.refresh();

    expect(item.classList.contains(CSS_CLASSES.itemHasCompanion)).toBe(true);
  });

  it('marca companion com is-binary-companion quando não tem visible:true', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app as any);
    plugin.app.vault.__setFile('paper.pdf', undefined, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const item = document.createElement('div');
    item.classList.add('nav-file-title');
    item.setAttribute('data-path', 'paper.pdf.md');
    document.body.appendChild(item);

    const decorator = new ExplorerDecorator(plugin as any, registry);
    decorator.initialize(true);
    decorator.refresh();

    expect(item.classList.contains(CSS_CLASSES.itemIsCompanion)).toBe(true);
  });

  it('não marca companion com visible:true', async () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app as any);
    plugin.app.vault.__setFile('paper.pdf', undefined, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf', visible: true });
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();

    const item = document.createElement('div');
    item.classList.add('nav-file-title');
    item.setAttribute('data-path', 'paper.pdf.md');
    document.body.appendChild(item);

    const decorator = new ExplorerDecorator(plugin as any, registry);
    decorator.initialize(true);
    decorator.refresh();

    expect(item.classList.contains(CSS_CLASSES.itemIsCompanion)).toBe(false);
  });

  it('setHide(true) aplica body class, setHide(false) remove', () => {
    const plugin = createPlugin();
    const registry = new CompanionRegistry(plugin.app as any);
    const decorator = new ExplorerDecorator(plugin as any, registry);
    decorator.initialize(false);
    expect(document.body.classList.contains(CSS_CLASSES.bodyHide)).toBe(false);
    decorator.setHide(true);
    expect(document.body.classList.contains(CSS_CLASSES.bodyHide)).toBe(true);
    decorator.setHide(false);
    expect(document.body.classList.contains(CSS_CLASSES.bodyHide)).toBe(false);
  });
});
