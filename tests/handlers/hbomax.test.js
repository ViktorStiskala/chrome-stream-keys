/**
 * HBO Max handler tests
 * Tests selector logic, button detection, and subtitle functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createHBOMaxDOM,
  cleanupHBOMaxDOM,
  createPlayerContainer,
  createOverlayRoot,
  createAppRoot,
  createPlayPauseButton,
  createFullscreenButton,
  createSubtitleButtons
} from '../fixtures/hbomax.js';

describe('HBO Max Handler', () => {
  
  describe('Player Detection', () => {
    afterEach(() => {
      cleanupHBOMaxDOM();
    });

    it('should find player container by data-testid', () => {
      createHBOMaxDOM();
      
      const player = document.querySelector('div[data-testid="playerContainer"]');
      expect(player).not.toBeNull();
      expect(player.className).toContain('PlayerRootContainer');
    });

    it('should return null when player is not present', () => {
      const player = document.querySelector('div[data-testid="playerContainer"]');
      expect(player).toBeNull();
    });
  });

  describe('Button Selectors', () => {
    afterEach(() => {
      cleanupHBOMaxDOM();
    });

    it('should find play/pause button by data-testid', () => {
      createHBOMaxDOM();
      
      const button = document.querySelector('button[data-testid="player-ux-play-pause-button"]');
      expect(button).not.toBeNull();
      expect(button.hasAttribute('aria-label')).toBe(true);
    });

    it('should find fullscreen button by data-testid', () => {
      createHBOMaxDOM();
      
      const button = document.querySelector('button[data-testid="player-ux-fullscreen-button"]');
      expect(button).not.toBeNull();
      expect(button.hasAttribute('aria-label')).toBe(true);
    });

    it('should find buttons using fallback class selectors', () => {
      createHBOMaxDOM();
      
      // Test fallback selector for play/pause
      const middleContainer = document.querySelector('[class^="ControlsFooterBottomMiddle"]');
      expect(middleContainer).not.toBeNull();
      
      // Test fallback selector for fullscreen
      const rightContainer = document.querySelector('[class^="ControlsFooterBottomRight"]');
      expect(rightContainer).not.toBeNull();
    });

    it('should return null for non-existent buttons', () => {
      createHBOMaxDOM();
      
      const button = document.querySelector('button[data-testid="non-existent-button"]');
      expect(button).toBeNull();
    });
  });

  describe('Focus Elements', () => {
    afterEach(() => {
      cleanupHBOMaxDOM();
    });

    it('should find overlay-root element', () => {
      createHBOMaxDOM();
      
      const overlay = document.querySelector('#overlay-root');
      expect(overlay).not.toBeNull();
      expect(overlay.getAttribute('tabindex')).toBe('0');
    });

    it('should find app-root element', () => {
      createHBOMaxDOM();
      
      const appRoot = document.getElementById('app-root');
      expect(appRoot).not.toBeNull();
    });
  });

  describe('Subtitle Functionality', () => {
    afterEach(() => {
      cleanupHBOMaxDOM();
    });

    it('should find all subtitle track buttons', () => {
      createHBOMaxDOM();
      
      const buttons = document.querySelectorAll('button[data-testid="player-ux-text-track-button"]');
      expect(buttons.length).toBe(3); // Off, English, Czech
    });

    it('should identify the Off button as first in list', () => {
      createHBOMaxDOM();
      
      const buttons = document.querySelectorAll('button[data-testid="player-ux-text-track-button"]');
      const offButton = buttons[0];
      
      // Off button should be first and checked by default
      expect(offButton.getAttribute('aria-checked')).toBe('true');
    });

    it('should correctly identify subtitle state as off', () => {
      createHBOMaxDOM();
      
      const offButton = document.querySelector('button[data-testid="player-ux-text-track-button"]');
      const isSubtitlesOn = offButton.getAttribute('aria-checked') !== 'true';
      
      expect(isSubtitlesOn).toBe(false);
    });

    it('should correctly identify subtitle state as on', () => {
      createHBOMaxDOM({
        subtitleTracks: [
          { label: 'Off', checked: false },
          { label: 'English', checked: true },
          { label: 'Czech', checked: false }
        ]
      });
      
      const offButton = document.querySelector('button[data-testid="player-ux-text-track-button"]');
      const isSubtitlesOn = offButton.getAttribute('aria-checked') !== 'true';
      
      expect(isSubtitlesOn).toBe(true);
    });

    it('should extract subtitle labels from aria-label attribute', () => {
      createHBOMaxDOM();
      
      const buttons = document.querySelectorAll('button[data-testid="player-ux-text-track-button"]');
      const labels = Array.from(buttons).map(btn => btn.getAttribute('aria-label'));
      
      expect(labels).toContain('Off');
      expect(labels).toContain('English');
      expect(labels).toContain('Czech');
    });

    it('should extract subtitle labels from p.TrackLabel when aria-label is missing', () => {
      createHBOMaxDOM();
      
      const buttons = document.querySelectorAll('button[data-testid="player-ux-text-track-button"]');
      const button = buttons[1]; // English button
      
      const labelElement = button.querySelector('p');
      expect(labelElement).not.toBeNull();
      expect(labelElement.textContent).toBe('English');
    });

    it('should skip Off option when getting available subtitles', () => {
      createHBOMaxDOM();
      
      const buttons = document.querySelectorAll('button[data-testid="player-ux-text-track-button"]');
      const availableSubtitles = [];
      
      buttons.forEach((button, index) => {
        // Skip the first button (Off option)
        if (index === 0) return;
        const label = button.getAttribute('aria-label') || 
                      button.querySelector('p')?.textContent || '';
        availableSubtitles.push({
          label: label.trim(),
          element: button
        });
      });
      
      expect(availableSubtitles.length).toBe(2);
      expect(availableSubtitles[0].label).toBe('English');
      expect(availableSubtitles[1].label).toBe('Czech');
    });

    it('should be clickable to change subtitle state', () => {
      createHBOMaxDOM();
      
      const buttons = document.querySelectorAll('button[data-testid="player-ux-text-track-button"]');
      const englishButton = buttons[1];
      
      const clickHandler = vi.fn();
      englishButton.addEventListener('click', clickHandler);
      englishButton.click();
      
      expect(clickHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Localization Independence', () => {
    afterEach(() => {
      cleanupHBOMaxDOM();
    });

    it('should work with non-English subtitle labels', () => {
      createHBOMaxDOM({
        subtitleTracks: [
          { label: 'Vypnuto', checked: true }, // Czech for "Off"
          { label: 'Angličtina', checked: false }, // Czech for "English"
          { label: 'Čeština', checked: false } // Czech for "Czech"
        ]
      });
      
      const buttons = document.querySelectorAll('button[data-testid="player-ux-text-track-button"]');
      expect(buttons.length).toBe(3);
      
      // data-testid should still work regardless of language
      expect(buttons[0].getAttribute('data-testid')).toBe('player-ux-text-track-button');
    });

    it('should find elements by data-testid regardless of locale', () => {
      createHBOMaxDOM();
      
      // These selectors should work regardless of the UI language
      const player = document.querySelector('[data-testid="playerContainer"]');
      const playPause = document.querySelector('[data-testid="player-ux-play-pause-button"]');
      const fullscreen = document.querySelector('[data-testid="player-ux-fullscreen-button"]');
      
      expect(player).not.toBeNull();
      expect(playPause).not.toBeNull();
      expect(fullscreen).not.toBeNull();
    });
  });

  describe('getButton Logic', () => {
    afterEach(() => {
      cleanupHBOMaxDOM();
    });

    it('should implement getButton helper with primary and fallback selectors', () => {
      createHBOMaxDOM();
      
      // Simulating the handler's getButton logic
      const getButton = (primarySelector, fallbackSelector) => {
        return document.querySelector(primarySelector) || document.querySelector(fallbackSelector);
      };
      
      const playPause = getButton(
        'button[data-testid="player-ux-play-pause-button"]',
        '[class^="ControlsFooterBottomMiddle"] button:nth-child(1)'
      );
      
      expect(playPause).not.toBeNull();
    });

    it('should use fallback selector when primary fails', () => {
      // Create minimal DOM with only fallback structure
      const appRoot = createAppRoot();
      const controlsMiddle = document.createElement('div');
      controlsMiddle.className = 'ControlsFooterBottomMiddle';
      
      const fallbackButton = document.createElement('button');
      fallbackButton.className = 'fallback-play-pause';
      controlsMiddle.appendChild(fallbackButton);
      
      appRoot.appendChild(controlsMiddle);
      document.body.appendChild(appRoot);
      
      const getButton = (primarySelector, fallbackSelector) => {
        return document.querySelector(primarySelector) || document.querySelector(fallbackSelector);
      };
      
      const button = getButton(
        'button[data-testid="player-ux-play-pause-button"]',
        '[class^="ControlsFooterBottomMiddle"] button:nth-child(1)'
      );
      
      expect(button).not.toBeNull();
      expect(button.className).toBe('fallback-play-pause');
      
      // Cleanup
      appRoot.remove();
    });
  });
});

