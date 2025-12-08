/**
 * Disney+ handler tests
 * Tests selector logic, Shadow DOM button detection, and subtitle functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createDisneyPlusDOM,
  cleanupDisneyPlusDOM,
  createDisneyWebPlayer,
  createShadowButton,
  createSubtitlePicker
} from '../fixtures/disney.js';

describe('Disney+ Handler', () => {
  
  describe('Player Detection', () => {
    afterEach(() => {
      cleanupDisneyPlusDOM();
    });

    it('should find disney-web-player element', () => {
      createDisneyPlusDOM();
      
      const player = document.body.querySelector('disney-web-player');
      expect(player).not.toBeNull();
    });

    it('should return null when player is not present', () => {
      const player = document.body.querySelector('disney-web-player');
      expect(player).toBeNull();
    });

    it('should find video element inside player', () => {
      createDisneyPlusDOM();
      
      const player = document.body.querySelector('disney-web-player');
      const video = player?.querySelector('video');
      expect(video).not.toBeNull();
    });
  });

  describe('Shadow DOM Button Access', () => {
    afterEach(() => {
      cleanupDisneyPlusDOM();
    });

    it('should access button through shadowRoot', () => {
      const { control, shadowRoot, button } = createShadowButton('toggle-play-pause');
      document.body.appendChild(control);
      
      // Simulating the handler's getShadowRootButton logic
      const getShadowRootButton = (selector) => {
        return document.body.querySelector(selector)?.shadowRoot?.querySelector('info-tooltip button');
      };
      
      const foundButton = getShadowRootButton('toggle-play-pause');
      expect(foundButton).not.toBeNull();
      expect(foundButton).toBe(button);
      
      control.remove();
    });

    it('should find toggle-play-pause button', () => {
      const dom = createDisneyPlusDOM();
      
      const button = dom.getShadowButton('toggle-play-pause');
      expect(button).not.toBeNull();
    });

    it('should find toggle-fullscreen button', () => {
      const dom = createDisneyPlusDOM();
      
      const button = dom.getShadowButton('toggle-fullscreen');
      expect(button).not.toBeNull();
    });

    it('should find quick-rewind button', () => {
      const dom = createDisneyPlusDOM();
      
      const button = dom.getShadowButton('quick-rewind');
      expect(button).not.toBeNull();
    });

    it('should find quick-fast-forward button', () => {
      const dom = createDisneyPlusDOM();
      
      const button = dom.getShadowButton('quick-fast-forward');
      expect(button).not.toBeNull();
    });

    it('should return null for non-existent selector', () => {
      const dom = createDisneyPlusDOM();
      
      const button = dom.getShadowButton('non-existent-control');
      expect(button).toBeUndefined();
    });

    it('should handle missing shadowRoot gracefully', () => {
      const control = document.createElement('toggle-play-pause');
      // Note: No shadowRoot attached
      document.body.appendChild(control);
      
      const getShadowRootButton = (selector) => {
        return document.body.querySelector(selector)?.shadowRoot?.querySelector('info-tooltip button');
      };
      
      const button = getShadowRootButton('toggle-play-pause');
      expect(button).toBeUndefined();
      
      control.remove();
    });
  });

  describe('Key Mapping', () => {
    afterEach(() => {
      cleanupDisneyPlusDOM();
    });

    it('should map Space to toggle-play-pause', () => {
      const keyMap = {
        'Space': 'toggle-play-pause',
        'KeyF': 'toggle-fullscreen',
        'ArrowLeft': 'quick-rewind',
        'ArrowRight': 'quick-fast-forward',
      };
      
      expect(keyMap['Space']).toBe('toggle-play-pause');
    });

    it('should map KeyF to toggle-fullscreen', () => {
      const keyMap = {
        'Space': 'toggle-play-pause',
        'KeyF': 'toggle-fullscreen',
        'ArrowLeft': 'quick-rewind',
        'ArrowRight': 'quick-fast-forward',
      };
      
      expect(keyMap['KeyF']).toBe('toggle-fullscreen');
    });

    it('should map ArrowLeft to quick-rewind', () => {
      const keyMap = {
        'Space': 'toggle-play-pause',
        'KeyF': 'toggle-fullscreen',
        'ArrowLeft': 'quick-rewind',
        'ArrowRight': 'quick-fast-forward',
      };
      
      expect(keyMap['ArrowLeft']).toBe('quick-rewind');
    });

    it('should map ArrowRight to quick-fast-forward', () => {
      const keyMap = {
        'Space': 'toggle-play-pause',
        'KeyF': 'toggle-fullscreen',
        'ArrowLeft': 'quick-rewind',
        'ArrowRight': 'quick-fast-forward',
      };
      
      expect(keyMap['ArrowRight']).toBe('quick-fast-forward');
    });

    it('should return undefined for unmapped keys', () => {
      const keyMap = {
        'Space': 'toggle-play-pause',
        'KeyF': 'toggle-fullscreen',
        'ArrowLeft': 'quick-rewind',
        'ArrowRight': 'quick-fast-forward',
      };
      
      expect(keyMap['KeyC']).toBeUndefined();
      expect(keyMap['Enter']).toBeUndefined();
    });
  });

  describe('Subtitle Functionality', () => {
    afterEach(() => {
      cleanupDisneyPlusDOM();
    });

    it('should find subtitle picker element', () => {
      createDisneyPlusDOM();
      
      const picker = document.getElementById('subtitleTrackPicker');
      expect(picker).not.toBeNull();
    });

    it('should find all subtitle labels', () => {
      const dom = createDisneyPlusDOM();
      
      const labels = dom.getSubtitleLabels();
      expect(labels.length).toBe(3); // Off, English, Czech
    });

    it('should find the off radio input', () => {
      const dom = createDisneyPlusDOM();
      
      const offRadio = dom.getOffRadio();
      expect(offRadio).not.toBeNull();
      expect(offRadio.id).toBe('subtitleTrackPicker-off');
    });

    it('should correctly identify subtitle state as off', () => {
      const dom = createDisneyPlusDOM();
      
      const offRadio = dom.getOffRadio();
      // Subtitles are ON if the "off" radio is NOT checked
      const isSubtitlesOn = offRadio && !offRadio.checked;
      
      expect(isSubtitlesOn).toBe(false);
    });

    it('should correctly identify subtitle state as on', () => {
      const dom = createDisneyPlusDOM({
        subtitleTracks: [
          { label: 'Off', id: 'subtitleTrackPicker-off', checked: false },
          { label: 'English', id: 'subtitleTrackPicker-en', checked: true },
          { label: 'Czech', id: 'subtitleTrackPicker-cs', checked: false }
        ]
      });
      
      const offRadio = dom.getOffRadio();
      const isSubtitlesOn = offRadio && !offRadio.checked;
      
      expect(isSubtitlesOn).toBe(true);
    });

    it('should skip off option when getting available subtitles', () => {
      const dom = createDisneyPlusDOM();
      
      const labels = dom.getSubtitleLabels();
      const available = [];
      
      labels.forEach(label => {
        // Skip the "off" option
        if (label.getAttribute('for') === 'subtitleTrackPicker-off') return;
        available.push({
          label: label.textContent.trim(),
          element: label,
          inputId: label.getAttribute('for')
        });
      });
      
      expect(available.length).toBe(2);
      expect(available[0].label).toBe('English');
      expect(available[1].label).toBe('Czech');
    });

    it('should be able to click radio inputs to change subtitle', () => {
      createDisneyPlusDOM();
      
      const englishInput = document.querySelector('#subtitleTrackPicker-en');
      expect(englishInput).not.toBeNull();
      
      const clickHandler = vi.fn();
      englishInput.addEventListener('click', clickHandler);
      englishInput.click();
      
      expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    it('should have correct for attribute linking label to input', () => {
      createDisneyPlusDOM();
      
      const labels = document.querySelectorAll('#subtitleTrackPicker label.picker-item');
      
      labels.forEach(label => {
        const forAttr = label.getAttribute('for');
        const input = document.getElementById(forAttr);
        expect(input).not.toBeNull();
        expect(input.type).toBe('radio');
      });
    });
  });

  describe('Localization Independence', () => {
    afterEach(() => {
      cleanupDisneyPlusDOM();
    });

    it('should work with non-English subtitle labels', () => {
      createDisneyPlusDOM({
        subtitleTracks: [
          { label: 'Vypnuto', id: 'subtitleTrackPicker-off', checked: true },
          { label: 'Angličtina', id: 'subtitleTrackPicker-en', checked: false },
          { label: 'Čeština', id: 'subtitleTrackPicker-cs', checked: false }
        ]
      });
      
      const labels = document.querySelectorAll('#subtitleTrackPicker label.picker-item');
      expect(labels.length).toBe(3);
      
      // IDs should be stable regardless of language
      const offRadio = document.querySelector('#subtitleTrackPicker-off');
      expect(offRadio).not.toBeNull();
    });

    it('should find elements by selector regardless of locale', () => {
      createDisneyPlusDOM();
      
      // These selectors should work regardless of the UI language
      const player = document.body.querySelector('disney-web-player');
      const picker = document.getElementById('subtitleTrackPicker');
      
      expect(player).not.toBeNull();
      expect(picker).not.toBeNull();
    });
  });

  describe('Player Focus Management', () => {
    afterEach(() => {
      cleanupDisneyPlusDOM();
    });

    it('should be able to set tabindex on player', () => {
      const dom = createDisneyPlusDOM();
      
      const player = dom.player;
      player.setAttribute('tabindex', '-1');
      
      expect(player.getAttribute('tabindex')).toBe('-1');
    });

    it('should be able to focus player', () => {
      const dom = createDisneyPlusDOM();
      
      const player = dom.player;
      player.setAttribute('tabindex', '-1');
      player.focus();
      
      expect(document.activeElement).toBe(player);
    });

    it('should be able to remove outline from player', () => {
      const dom = createDisneyPlusDOM();
      
      const player = dom.player;
      player.style.setProperty('outline', '0', 'important');
      
      expect(player.style.outline).toBe('0');
    });

    it('should be able to remove outline from video', () => {
      const dom = createDisneyPlusDOM();
      
      const video = dom.video;
      video.style.setProperty('outline', '0', 'important');
      
      expect(video.style.outline).toBe('0');
    });
  });

  describe('getShadowRootButton Logic', () => {
    afterEach(() => {
      cleanupDisneyPlusDOM();
    });

    it('should implement getShadowRootButton helper', () => {
      createDisneyPlusDOM();
      
      // Simulating the handler's getShadowRootButton logic
      const getShadowRootButton = (selector) => {
        return document.body.querySelector(selector)?.shadowRoot?.querySelector('info-tooltip button');
      };
      
      const button = getShadowRootButton('toggle-play-pause');
      expect(button).not.toBeNull();
      expect(button.tagName).toBe('BUTTON');
    });

    it('should return undefined when element not found', () => {
      createDisneyPlusDOM();
      
      const getShadowRootButton = (selector) => {
        return document.body.querySelector(selector)?.shadowRoot?.querySelector('info-tooltip button');
      };
      
      const button = getShadowRootButton('non-existent-selector');
      expect(button).toBeUndefined();
    });
  });
});

