import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Production Build', () => {
  const buildPath = resolve(__dirname, '../build/chrome/extension/src/services/disney.js');

  describe('debug code exclusion', () => {
    it('build file exists', () => {
      const exists = existsSync(buildPath);
      expect(exists).toBe(true);
    });

    it('does NOT contain DEV_SERVER_URL constant', () => {
      const content = readFileSync(buildPath, 'utf-8');
      expect(content).not.toContain('DEV_SERVER_URL');
    });

    it('does NOT contain debug server endpoint', () => {
      const content = readFileSync(buildPath, 'utf-8');
      expect(content).not.toContain('localhost:5173/__debug_log');
    });

    it('does NOT contain sendToServer function', () => {
      const content = readFileSync(buildPath, 'utf-8');
      expect(content).not.toContain('sendToServer');
    });

    it('does NOT contain initConsoleForward function', () => {
      const content = readFileSync(buildPath, 'utf-8');
      expect(content).not.toContain('initConsoleForward');
    });

    it('does NOT contain Debug.log calls', () => {
      const content = readFileSync(buildPath, 'utf-8');
      expect(content).not.toContain('Debug.log');
    });

    it('does NOT contain connectionErrorLogged variable', () => {
      const content = readFileSync(buildPath, 'utf-8');
      expect(content).not.toContain('connectionErrorLogged');
    });
  });
});
