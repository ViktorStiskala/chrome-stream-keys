// Settings access utilities

import type { StreamKeysSettings } from '@/types';

const DEFAULT_SETTINGS: StreamKeysSettings = {
  subtitleLanguages: ['English', 'English [CC]', 'English CC'],
  positionHistoryEnabled: true,
};

/**
 * Get the current settings from the injected global
 */
export function getSettings(): StreamKeysSettings {
  return window.__streamKeysSettings || DEFAULT_SETTINGS;
}

/**
 * Get subtitle language preferences
 */
export function getSubtitlePreferences(): string[] {
  return getSettings().subtitleLanguages || [];
}

/**
 * Check if position history feature is enabled
 */
export function isPositionHistoryEnabled(): boolean {
  return getSettings().positionHistoryEnabled !== false;
}
