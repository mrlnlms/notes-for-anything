// src/utils/pathResolver.ts
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

export function isCompanionPath(path: string): boolean {
  if (!path.endsWith('.md')) return false;
  const withoutMd = path.slice(0, -3);
  return isSupportedBinary(withoutMd);
}
