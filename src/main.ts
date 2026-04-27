import { Plugin, Notice } from 'obsidian';

export default class BinaryNotesPlugin extends Plugin {
  async onload() {
    console.log(`${this.manifest.name} v${this.manifest.version} loaded`);
    new Notice(`${this.manifest.name} loaded!`);
  }

  onunload() {
    console.log(`${this.manifest.name} unloaded`);
  }
}
