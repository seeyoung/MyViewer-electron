import { describe, it, expect } from 'vitest';
import { PLACEHOLDER_LOADING, PLACEHOLDER_ERROR, PLACEHOLDER_BLANK } from './placeholders';

describe('Placeholder Constants', () => {
  describe('PLACEHOLDER_LOADING', () => {
    it('should be a valid data URL', () => {
      expect(PLACEHOLDER_LOADING).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('should be decodable base64', () => {
      const base64Part = PLACEHOLDER_LOADING.replace('data:image/svg+xml;base64,', '');
      expect(() => atob(base64Part)).not.toThrow();
    });

    it('should contain SVG content', () => {
      const base64Part = PLACEHOLDER_LOADING.replace('data:image/svg+xml;base64,', '');
      const decoded = atob(base64Part);
      expect(decoded).toContain('<svg');
      expect(decoded).toContain('</svg>');
    });

    it('should be small in size (< 2KB)', () => {
      expect(PLACEHOLDER_LOADING.length).toBeLessThan(2048);
    });
  });

  describe('PLACEHOLDER_ERROR', () => {
    it('should be a valid data URL', () => {
      expect(PLACEHOLDER_ERROR).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('should be decodable base64', () => {
      const base64Part = PLACEHOLDER_ERROR.replace('data:image/svg+xml;base64,', '');
      expect(() => atob(base64Part)).not.toThrow();
    });

    it('should contain SVG content', () => {
      const base64Part = PLACEHOLDER_ERROR.replace('data:image/svg+xml;base64,', '');
      const decoded = atob(base64Part);
      expect(decoded).toContain('<svg');
      expect(decoded).toContain('</svg>');
    });

    it('should be small in size (< 2KB)', () => {
      expect(PLACEHOLDER_ERROR.length).toBeLessThan(2048);
    });

    it('should be different from PLACEHOLDER_LOADING', () => {
      expect(PLACEHOLDER_ERROR).not.toBe(PLACEHOLDER_LOADING);
    });
  });

  describe('PLACEHOLDER_BLANK', () => {
    it('should be a valid data URL', () => {
      expect(PLACEHOLDER_BLANK).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('should be decodable base64', () => {
      const base64Part = PLACEHOLDER_BLANK.replace('data:image/svg+xml;base64,', '');
      expect(() => atob(base64Part)).not.toThrow();
    });

    it('should contain SVG content', () => {
      const base64Part = PLACEHOLDER_BLANK.replace('data:image/svg+xml;base64,', '');
      const decoded = atob(base64Part);
      expect(decoded).toContain('<svg');
      expect(decoded).toContain('</svg>');
    });

    it('should be small in size (< 2KB)', () => {
      expect(PLACEHOLDER_BLANK.length).toBeLessThan(2048);
    });

    it('should be different from other placeholders', () => {
      expect(PLACEHOLDER_BLANK).not.toBe(PLACEHOLDER_LOADING);
      expect(PLACEHOLDER_BLANK).not.toBe(PLACEHOLDER_ERROR);
    });
  });

  describe('Size Comparison', () => {
    it('all placeholders should be under 2KB (vs 12MB for full image)', () => {
      const totalSize =
        PLACEHOLDER_LOADING.length +
        PLACEHOLDER_ERROR.length +
        PLACEHOLDER_BLANK.length;

      // All three combined should be less than 6KB
      expect(totalSize).toBeLessThan(6144);

      // Compare to typical base64 image size (12MB = ~16MB in base64)
      const typicalBase64ImageSize = 16 * 1024 * 1024;
      const savingsRatio = typicalBase64ImageSize / totalSize;

      // Should save at least 1000x in size
      expect(savingsRatio).toBeGreaterThan(1000);
    });
  });
});
