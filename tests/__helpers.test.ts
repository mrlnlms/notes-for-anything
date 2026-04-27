import { describe, it, expect } from 'vitest';
import { createPlugin } from './pluginFactory';

describe('mock helpers smoke', () => {
  it('vault.__setFile + getAbstractFileByPath devolve TFile', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', { foo: 'bar' });
    const f = plugin.app.vault.getAbstractFileByPath('a.md');
    expect(f).toBeTruthy();
    expect(f?.path).toBe('a.md');
  });

  it('vault.__setFile atualiza arquivo existente', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', { foo: 'bar' });
    plugin.app.vault.__setFile('a.md', { foo: 'baz' });
    const entry = plugin.app.vault.__getFile('a.md');
    expect(entry?.frontmatter).toEqual({ foo: 'baz' });
  });

  it('vault.__deleteFile remove sem disparar evento', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', {});
    let fired = false;
    plugin.app.vault.on('delete', () => { fired = true; });
    plugin.app.vault.__deleteFile('a.md');
    expect(plugin.app.vault.getAbstractFileByPath('a.md')).toBeNull();
    expect(fired).toBe(false);
  });

  it('vault.getMarkdownFiles devolve só arquivos .md', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', {});
    plugin.app.vault.__setFile('b.pdf', {}, 'binary');
    const md = plugin.app.vault.getMarkdownFiles();
    expect(md.map((f: any) => f.path)).toEqual(['a.md']);
  });

  it('metadataCache.getFileCache devolve frontmatter do arquivo virtual', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', { foo: 'bar' });
    const file = plugin.app.vault.getAbstractFileByPath('a.md');
    expect(plugin.app.metadataCache.getFileCache(file)).toEqual({ frontmatter: { foo: 'bar' } });
  });

  it('metadataCache.__triggerChanged dispara handler com FM do arquivo', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', { foo: 'bar' });
    let firedFM: any = null;
    plugin.app.metadataCache.on('changed', (file: any) => {
      firedFM = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
    });
    plugin.app.metadataCache.__triggerChanged('a.md');
    expect(firedFM).toEqual({ foo: 'bar' });
  });

  it('workspace.__triggerLayoutReady executa callbacks pendentes', async () => {
    const plugin = createPlugin();
    let ran = false;
    plugin.app.workspace.onLayoutReady(() => { ran = true; });
    await plugin.app.workspace.__triggerLayoutReady();
    expect(ran).toBe(true);
  });

  it('vault.__triggerRename dispara handler com (file, oldPath)', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('old.md', {});
    let received: any = null;
    plugin.app.vault.on('rename', (f: any, oldPath: string) => {
      received = { newPath: f.path, oldPath };
    });
    plugin.app.vault.__triggerRename('old.md', 'new.md');
    expect(received).toEqual({ newPath: 'new.md', oldPath: 'old.md' });
    // entry foi movida no Map
    expect(plugin.app.vault.getAbstractFileByPath('old.md')).toBeNull();
    expect(plugin.app.vault.getAbstractFileByPath('new.md')).toBeTruthy();
  });

  it('vault.__triggerDelete dispara handler com TFile mas NÃO remove do Map', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', {});
    let firedFile: any = null;
    plugin.app.vault.on('delete', (f: any) => { firedFile = f; });
    plugin.app.vault.__triggerDelete('a.md');
    expect(firedFile?.path).toBe('a.md');
    // ainda existe no map
    expect(plugin.app.vault.getAbstractFileByPath('a.md')).toBeTruthy();
  });

  it('plugin.__runCommand executa callback do comando registrado', () => {
    const plugin = createPlugin();
    let ran = false;
    plugin.addCommand({ id: 'test-cmd', name: 'Test', callback: () => { ran = true; } });
    plugin.__runCommand('test-cmd');
    expect(ran).toBe(true);
  });

  it('plugin.__runCommand chama checkCallback(false) quando comando usa checkCallback', () => {
    const plugin = createPlugin();
    let calledWith: any = 'sentinel';
    plugin.addCommand({
      id: 'check-cmd',
      name: 'Check',
      checkCallback: (checking: boolean) => { calledWith = checking; return true; },
    });
    plugin.__runCommand('check-cmd');
    expect(calledWith).toBe(false);
  });

  it('workspace.__getLastSetViewState retorna o último setViewState', async () => {
    const plugin = createPlugin();
    const leaf = plugin.app.workspace.__createLeaf();
    await leaf.setViewState({ type: 'foo-view', state: { x: 1 } });
    expect(plugin.app.workspace.__getLastSetViewState()).toEqual({ type: 'foo-view', state: { x: 1 } });
    plugin.app.workspace.__resetSetViewStateLog();
    expect(plugin.app.workspace.__getLastSetViewState()).toBeNull();
  });

  it('workspace.__createLeafWithFile cria leaf com view contendo file e viewType', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', {});
    const leaf = plugin.app.workspace.__createLeafWithFile('a.md', 'binary-view');
    expect(leaf.view.file?.path).toBe('a.md');
    expect(leaf.view.getViewType()).toBe('binary-view');
  });

  it('workspace.__createLeafWithViewType cria leaf com view de tipo dado e sem file', () => {
    const plugin = createPlugin();
    const leaf = plugin.app.workspace.__createLeafWithViewType('outline');
    expect(leaf.view.getViewType()).toBe('outline');
    expect(leaf.view.file).toBeNull();
  });

  it('workspace.__triggerActiveLeafChange dispara handler com leaf', () => {
    const plugin = createPlugin();
    const leaf = plugin.app.workspace.__createLeaf();
    let receivedLeaf: any = null;
    plugin.app.workspace.on('active-leaf-change', (l: any) => { receivedLeaf = l; });
    plugin.app.workspace.__triggerActiveLeafChange(leaf);
    expect(receivedLeaf).toBe(leaf);
  });

  it('workspace.__setActiveFile faz getActiveFile retornar o TFile', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', {});
    plugin.app.workspace.__setActiveFile('a.md');
    expect(plugin.app.workspace.getActiveFile()?.path).toBe('a.md');
  });

  it('leaf.__getActions retorna actions adicionadas via view.addAction', () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', {});
    const leaf = plugin.app.workspace.__createLeafWithFile('a.md', 'binary-view');
    leaf.view.addAction('icon', 'title', () => {});
    leaf.view.addAction('icon2', 'title2', () => {});
    expect(leaf.__getActions().length).toBe(2);
  });

  it('fileManager.__mockProcessFrontMatter executa callback com fmRef registrado', async () => {
    const plugin = createPlugin();
    plugin.app.vault.__setFile('a.md', {});
    const fmRef: Record<string, unknown> = { binary: 'old.pdf' };
    plugin.app.fileManager.__mockProcessFrontMatter('a.md', fmRef);
    const file = plugin.app.vault.getAbstractFileByPath('a.md');
    await plugin.app.fileManager.processFrontMatter(file, (fm: any) => {
      fm.binary = 'new.pdf';
    });
    expect(fmRef.binary).toBe('new.pdf');
  });

  it('setViewState atualiza leaf.view.getViewType', async () => {
    const plugin = createPlugin();
    const leaf = plugin.app.workspace.__createLeaf();
    await leaf.setViewState({ type: 'foo-view', state: {} });
    expect(leaf.view.getViewType()).toBe('foo-view');
  });

  it('MarkdownRenderer.render é mockable como spy', async () => {
    const plugin = createPlugin();
    const el = document.createElement('div');
    await plugin.app.MarkdownRenderer.render(plugin.app, 'hi', el, 'a.md', null);
    expect(plugin.app.MarkdownRenderer.render).toHaveBeenCalledTimes(1);
    expect(el.innerHTML).toBe('hi');
  });
});
