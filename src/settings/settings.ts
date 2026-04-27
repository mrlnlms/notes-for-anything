// src/settings/settings.ts

export interface BinaryNotesSettings {
  /** Esconder companions no file explorer (body class toggle) */
  hideCompanions: boolean;
  /** Path opcional pra `.md` template usado como conteúdo inicial do companion */
  companionTemplatePath: string;
}

export const DEFAULT_SETTINGS: BinaryNotesSettings = {
  hideCompanions: true,
  companionTemplatePath: '',
};
