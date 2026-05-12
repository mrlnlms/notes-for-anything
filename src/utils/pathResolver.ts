// src/utils/pathResolver.ts
import type { App } from 'obsidian';
import { SUPPORTED_EXTENSIONS } from '../constants';

function getExtension(path: string): string | null {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return null;
  return path.slice(dot + 1).toLowerCase();
}

export function isSupportedBinary(path: string): boolean {
  const ext = getExtension(path);
  return ext !== null && SUPPORTED_EXTENSIONS.has(ext);
}

export function defaultCompanionPath(binaryPath: string): string {
  return `${binaryPath}.md`;
}

/**
 * Formata um path como wikilink pra escrita em frontmatter:
 *   formatBinaryWikilink('papers/foo.pdf') → '[[papers/foo.pdf]]'
 *
 * O caller envelopa em aspas duplas ao escrever YAML pra preservar
 * whitespace múltiplo / chars especiais.
 */
export function formatBinaryWikilink(binaryPath: string): string {
  return `[[${binaryPath}]]`;
}

/**
 * Resolve o `binary:` do frontmatter em path absoluto desde o vault root.
 *
 * Aceita dois formatos:
 *  - Wikilink: `"[[notes-for-anything/smoke/paper.pdf]]"` (novo padrão, indexado pelo graph)
 *  - Path literal: `"notes-for-anything/smoke/paper.pdf"` (formato antigo, ainda suportado)
 *
 * Pra wikilinks, usa `getFirstLinkpathDest` pra resolver shortname (`[[paper.pdf]]`)
 * ou aliases (`[[path|alias]]`) quando possível, com fallback pro texto cru.
 */
export function resolveBinaryReference(
  app: App,
  sourcePath: string,
  rawValue: unknown,
): string | null {
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const wikilinkMatch = trimmed.match(/^\[\[(.+?)\]\]$/);
  if (!wikilinkMatch) return trimmed; // path literal

  let inner = wikilinkMatch[1];
  const pipe = inner.indexOf('|');
  if (pipe !== -1) inner = inner.slice(0, pipe);
  inner = inner.trim();
  if (!inner) return null;

  const resolved = app.metadataCache.getFirstLinkpathDest(inner, sourcePath);
  return resolved ? resolved.path : inner;
}
