// src/types.ts

/** Entrada do índice reverso binário → companion */
export interface CompanionEntry {
  binaryPath: string;
  companionPath: string;
  visible: boolean; // do frontmatter `visible:`
}

/** Callback de mutação no registry */
export type RegistryMutationListener = (
  binaryPath: string,
  companionPath: string | null,
) => void;
