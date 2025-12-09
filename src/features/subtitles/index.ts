// Subtitles feature - toggle subtitles on/off with language preference

import type { SubtitleConfig, SubtitleItem, CleanupFn } from '@/types';
import { getSubtitlePreferences } from '@/core/settings';
import { showBanner } from '@/ui/banner';

export interface SubtitlesConfig {
  subtitles: SubtitleConfig;
}

export interface SubtitlesAPI {
  /** Toggle subtitles on/off */
  toggle: () => void;
  /** Get current subtitle state */
  isOn: () => boolean;
  /** Get available subtitle languages */
  getAvailable: () => SubtitleItem[];
  /** Cleanup resources */
  cleanup: CleanupFn;
}

/**
 * Find matching language from preferences
 */
function findMatchingLanguage(
  preferences: string[],
  available: SubtitleItem[]
): SubtitleItem | null {
  for (const pref of preferences) {
    const prefNormalized = pref.trim().toLowerCase();
    const match = available.find((item) => item.label.trim().toLowerCase() === prefNormalized);
    if (match) return match;
  }
  return null;
}

/**
 * Initialize the Subtitles feature
 */
export function initSubtitles(config: SubtitlesConfig): SubtitlesAPI {
  const { subtitles } = config;

  const toggle = () => {
    const preferences = getSubtitlePreferences();

    // If no preferences configured, do nothing
    if (preferences.length === 0) {
      return;
    }

    const isOn = subtitles.getCurrentState();

    if (isOn) {
      // Turn off subtitles
      subtitles.turnOff();
      showBanner('Captions: Off');
    } else {
      // Find matching language from preferences
      const available = subtitles.getAvailable();
      const match = findMatchingLanguage(preferences, available);

      if (match) {
        subtitles.selectLanguage(match);
        showBanner(match.label);
      } else {
        showBanner('Captions: Language not found, check extension settings');
      }
    }
  };

  return {
    toggle,
    isOn: () => subtitles.getCurrentState(),
    getAvailable: () => subtitles.getAvailable(),
    cleanup: () => {
      // No cleanup needed for subtitles
    },
  };
}
