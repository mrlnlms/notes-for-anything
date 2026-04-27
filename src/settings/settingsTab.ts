// src/settings/settingsTab.ts
import { App, PluginSettingTab, Setting } from 'obsidian';
import type BinaryNotesPlugin from '../main';

export class BinaryNotesSettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: BinaryNotesPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Hide companions in file explorer')
      .setDesc(
        'When ON, companion notes are hidden from the explorer. ' +
        'Add `visible: true` in a companion frontmatter to expose it individually.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.hideCompanions).onChange(async (value) => {
          this.plugin.settings.hideCompanions = value;
          await this.plugin.saveSettings();
          this.plugin.explorerDecorator?.setHide(value);
        }),
      );

    new Setting(containerEl)
      .setName('Companion template')
      .setDesc(
        'Optional path to a `.md` file used as initial body when a new companion is created. ' +
        'Frontmatter from the template is stripped — Binary Notes prepends its own `binary:` key.',
      )
      .addText((text) =>
        text
          .setPlaceholder('Templates/binary-companion.md')
          .setValue(this.plugin.settings.companionTemplatePath)
          .onChange(async (value) => {
            this.plugin.settings.companionTemplatePath = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
