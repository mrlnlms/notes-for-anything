import { describe, it, expect } from 'vitest';
import {
  isSupportedBinary,
  defaultCompanionPath,
} from '../../src/utils/pathResolver';

describe('pathResolver', () => {
  describe('isSupportedBinary', () => {
    it('reconhece extensões cobertas', () => {
      expect(isSupportedBinary('paper.pdf')).toBe(true);
      expect(isSupportedBinary('img.png')).toBe(true);
      expect(isSupportedBinary('song.mp3')).toBe(true);
      expect(isSupportedBinary('clip.MP4')).toBe(true); // case insensitive
      expect(isSupportedBinary('sub/path/file.webm')).toBe(true);
    });
    it('rejeita extensões fora do escopo', () => {
      expect(isSupportedBinary('doc.epub')).toBe(false);
      expect(isSupportedBinary('archive.zip')).toBe(false);
      expect(isSupportedBinary('note.md')).toBe(false);
      expect(isSupportedBinary('no-extension')).toBe(false);
    });
  });

  describe('defaultCompanionPath', () => {
    it('appenda .md preservando extensão original', () => {
      expect(defaultCompanionPath('paper.pdf')).toBe('paper.pdf.md');
      expect(defaultCompanionPath('sub/img.png')).toBe('sub/img.png.md');
    });
  });
});
