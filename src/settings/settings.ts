// src/settings/settings.ts

export interface NotesForAnythingSettings {
  /** Esconder companions no file explorer (body class toggle) */
  hideCompanions: boolean;
  /** Path opcional pra `.md` template usado como conteúdo inicial do companion */
  companionTemplatePath: string;
}

export const DEFAULT_SETTINGS: NotesForAnythingSettings = {
  hideCompanions: true,
  companionTemplatePath: '',
};
