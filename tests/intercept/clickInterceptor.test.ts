import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPlugin } from '../pluginFactory';
import { CompanionRegistry } from '../../src/registry/companionRegistry';
import { ClickInterceptor } from '../../src/intercept/clickInterceptor';
import { BINARY_NOTES_VIEW_TYPE } from '../../src/constants';

describe('ClickInterceptor', () => {
  let plugin: ReturnType<typeof createPlugin>;
  let registry: CompanionRegistry;
  let interceptor: ClickInterceptor;

  afterEach(() => {
    plugin?.__unloadDomEvents();
  });

  beforeEach(async () => {
    document.body.innerHTML = '';
    plugin = createPlugin();
    registry = new CompanionRegistry(plugin.app as any);
    plugin.app.vault.__setFile('paper.pdf', undefined, 'binary');
    plugin.app.vault.__setFile('paper.pdf.md', { binary: 'paper.pdf' });
    plugin.app.vault.__setFile('zz.png', undefined, 'binary');
    registry.initialize();
    await plugin.app.workspace.__triggerLayoutReady();
    interceptor = new ClickInterceptor(plugin.app as any, registry, plugin as any);
    interceptor.initialize();
  });

  it('intercepta click em binário com companion', () => {
    const event = createExplorerClickEvent('paper.pdf');
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('não intercepta click em binário sem companion', () => {
    const event = createExplorerClickEvent('zz.png');
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('abre custom view via leaf.setViewState com companionPath', async () => {
    const event = createExplorerClickEvent('paper.pdf');
    document.dispatchEvent(event);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const opened = plugin.app.workspace.__getLastSetViewState();
    expect(opened?.type).toBe(BINARY_NOTES_VIEW_TYPE);
    expect(opened?.state).toMatchObject({ companionPath: 'paper.pdf.md' });
  });
});

function createExplorerClickEvent(filePath: string): MouseEvent {
  const item = document.createElement('div');
  item.classList.add('nav-file-title');
  item.setAttribute('data-path', filePath);
  document.body.appendChild(item);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: item, writable: false });
  return event;
}
