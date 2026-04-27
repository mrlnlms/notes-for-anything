// src/constants.ts

/** View type ID pra a custom view */
export const BINARY_NOTES_VIEW_TYPE = 'binary-notes-view';

/** ID do comando "Add Binary Notes" */
export const CMD_ADD_BINARY_NOTES = 'add-binary-notes';

/** ID do comando "Toggle source view" */
export const CMD_TOGGLE_SOURCE = 'toggle-source-view';

/** Frontmatter key que define a relação companion → binário */
export const FM_KEY_BINARY = 'binary';

/** Frontmatter key opcional pra override de visibilidade per-companion */
export const FM_KEY_VISIBLE = 'visible';

/** CSS classes aplicadas no DOM */
export const CSS_CLASSES = {
  /** Body class aplicada quando "Hide companions" está ON */
  bodyHide: 'hide-binary-companion',
  /** Aplicada no item do explorer que é companion (pra hide cascade) */
  itemIsCompanion: 'is-binary-companion',
  /** Aplicada no item do binário que tem companion (pra underline) */
  itemHasCompanion: 'has-binary-companion',
} as const;

/** Extensões de binário cobertas pelo plugin */
export const SUPPORTED_EXTENSIONS = new Set([
  'pdf',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',
  'mp3', 'm4a', 'wav', 'ogg', 'flac',
  'mp4', 'webm', 'mov', 'mkv',
]);
