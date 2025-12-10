import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HboMaxHandler } from './hbomax';
import { loadFixture, resetFixture } from '@test';

describe('HboMaxHandler', () => {
  beforeEach(() => {
    resetFixture();
  });

  afterEach(() => {
    resetFixture();
  });

  describe('with HBO Max DOM fixture', () => {
    beforeEach(() => {
      loadFixture('hbomax');
    });

    describe('getPlayer', () => {
      it('returns playerContainer element', () => {
        const player = HboMaxHandler._test.getPlayer();

        expect(player).not.toBeNull();
        expect(player?.getAttribute('data-testid')).toBe('playerContainer');
      });
    });

    describe('getButton', () => {
      it('returns play/pause button for Space key', () => {
        const button = HboMaxHandler._test.getButton('Space');

        expect(button).not.toBeNull();
        expect(button?.getAttribute('data-testid')).toBe('player-ux-play-pause-button');
      });

      it('returns fullscreen button for KeyF', () => {
        const button = HboMaxHandler._test.getButton('KeyF');

        expect(button).not.toBeNull();
        expect(button?.getAttribute('data-testid')).toBe('player-ux-fullscreen-button');
      });

      it('returns null for unknown key code', () => {
        const button = HboMaxHandler._test.getButton('KeyX');
        expect(button).toBeNull();
      });

      it('returns null for ArrowLeft (not mapped in HBO Max)', () => {
        const button = HboMaxHandler._test.getButton('ArrowLeft');
        expect(button).toBeNull();
      });
    });

    describe('subtitles.getAvailable', () => {
      it('returns available subtitle languages from fixture', () => {
        const available = HboMaxHandler._test.subtitles.getAvailable();

        // Should include English CC and Czech from fixture, but NOT "Off"
        const labels = available.map((item) => item.label);
        expect(labels).toContain('English CC');
        expect(labels).toContain('Czech');
        expect(labels).not.toContain('Off');
      });

      it('excludes the Off option (first button)', () => {
        const available = HboMaxHandler._test.subtitles.getAvailable();

        // Off option should be excluded
        const hasOff = available.some((item) => item.label === 'Off');
        expect(hasOff).toBe(false);
      });

      it('each item has label and element', () => {
        const available = HboMaxHandler._test.subtitles.getAvailable();

        available.forEach((item) => {
          expect(item.label).toBeTruthy();
          expect(item.element).toBeInstanceOf(HTMLElement);
        });
      });
    });

    describe('subtitles.getCurrentState', () => {
      it('returns false when Off option is selected (aria-checked="true")', () => {
        // In fixture, first button (Off) has aria-checked="true"
        const state = HboMaxHandler._test.subtitles.getCurrentState();
        expect(state).toBe(false);
      });

      it('returns true when another option is selected', () => {
        // Modify the fixture to simulate subtitles being on
        const buttons = document.querySelectorAll<HTMLButtonElement>(
          '[data-testid="player-ux-text-track-button"]'
        );

        if (buttons.length >= 2) {
          // Uncheck Off button, check English CC
          buttons[0].setAttribute('aria-checked', 'false');
          buttons[1].setAttribute('aria-checked', 'true');
        }

        const state = HboMaxHandler._test.subtitles.getCurrentState();
        expect(state).toBe(true);
      });
    });

    describe('focus target', () => {
      it('overlay-root element exists and is focusable', () => {
        const overlay = document.querySelector('#overlay-root');

        expect(overlay).not.toBeNull();
        expect(overlay?.getAttribute('tabindex')).toBe('0');
      });
    });

    describe('overlay container', () => {
      it('app-root element exists for overlay placement', () => {
        const appRoot = document.getElementById('app-root');
        expect(appRoot).not.toBeNull();
      });
    });
  });

  describe('without fixture', () => {
    it('getPlayer returns null when playerContainer does not exist', () => {
      const player = HboMaxHandler._test.getPlayer();
      expect(player).toBeNull();
    });

    it('getButton returns null when buttons do not exist', () => {
      const button = HboMaxHandler._test.getButton('Space');
      expect(button).toBeNull();
    });
  });
});
