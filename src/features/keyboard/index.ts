// Keyboard feature - global key event handling

import type { CleanupFn, StreamKeysVideoElement } from '@/types';
import { Settings } from '@/core/settings';
import type { RestorePositionAPI } from '@/features/restore-position';
import type { SubtitlesAPI } from '@/features/subtitles';

export interface KeyboardConfig {
  /** Get the augmented video element (with _streamKeysGetPlaybackTime method) */
  getVideoElement: () => StreamKeysVideoElement | null;
  getButton?: (keyCode: string) => HTMLElement | null;
  restorePosition?: RestorePositionAPI;
  subtitles?: SubtitlesAPI;
  /**
   * Whether direct video.currentTime manipulation is supported.
   * When false, custom seek will click native buttons instead.
   */
  supportsDirectSeek?: boolean;
}

export interface KeyboardAPI {
  /** Handle a key event */
  handleKey: (e: KeyboardEvent) => void;
  /** Cleanup resources */
  cleanup: CleanupFn;
}

/**
 * Initialize the Keyboard feature
 */
function initKeyboard(config: KeyboardConfig): KeyboardAPI {
  const {
    getVideoElement,
    getButton,
    restorePosition,
    subtitles,
    supportsDirectSeek = true,
  } = config;

  const handleGlobalKeys = (e: KeyboardEvent) => {
    // Handle restore dialog keys first - must capture ESC before it exits fullscreen
    if (restorePosition?.handleDialogKeys(e)) {
      return;
    }

    // Don't intercept events with modifier keys
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    // Skip if user is typing in an input/textarea
    const activeEl = document.activeElement;
    if (
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement).isContentEditable)
    ) {
      return;
    }

    // Handle subtitle toggle
    if (e.code === 'KeyC' && subtitles) {
      e.preventDefault();
      e.stopPropagation();
      subtitles.toggle();
      return;
    }

    // Handle position restore dialog
    if (e.code === 'KeyR' && restorePosition && Settings.isPositionHistoryEnabled()) {
      e.preventDefault();
      e.stopPropagation();
      restorePosition.openDialog();
      return;
    }

    // Handle arrow keys for seeking
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const video = getVideoElement();

      // Record position before seek (always, for debouncing)
      if (restorePosition) {
        restorePosition.setKeyboardSeek(true);
        const currentTime = video?._streamKeysGetStableTime?.();
        if (currentTime !== undefined) {
          restorePosition.recordBeforeSeek(currentTime);
        }
        // Reset flag when seek completes (seeked event) or after timeout as fallback
        if (video) {
          const resetFlag = () => {
            restorePosition.setKeyboardSeek(false);
            video.removeEventListener('seeked', resetFlag);
          };
          video.addEventListener('seeked', resetFlag, { once: true });
          // Fallback timeout in case seeked never fires
          setTimeout(() => {
            video.removeEventListener('seeked', resetFlag);
            restorePosition.setKeyboardSeek(false);
          }, 2000);
        } else {
          setTimeout(() => restorePosition.setKeyboardSeek(false), 500);
        }
      }

      // Custom seek: use video.currentTime directly (only if service supports it)
      if (Settings.isCustomSeekEnabled() && supportsDirectSeek && video) {
        e.preventDefault();
        e.stopPropagation();
        const seekTime = Settings.getSeekTime();
        const delta = e.code === 'ArrowLeft' ? -seekTime : seekTime;
        video.currentTime = Math.max(
          0,
          Math.min(video.duration || Infinity, video.currentTime + delta)
        );
        return;
      }

      // Default: click native button (existing behavior)
      if (getButton) {
        const button = getButton(e.code);
        if (button) {
          e.preventDefault();
          e.stopPropagation();
          button.click();
        }
      }
      return;
    }

    // Handle other keys via config
    if (!getButton) return;

    const button = getButton(e.code);
    if (!button) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    button.click();
  };

  // Use capture phase to intercept before any other handlers
  window.addEventListener('keydown', handleGlobalKeys, true);

  return {
    handleKey: handleGlobalKeys,
    cleanup: () => {
      window.removeEventListener('keydown', handleGlobalKeys, true);
    },
  };
}

// Public API
export const Keyboard = {
  init: initKeyboard,
};
