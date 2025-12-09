// Fullscreen handling utilities

import { createClickOverlay } from '@/ui/overlay';
import { focusPlayer, type FocusConfig } from './focus';

export interface FullscreenConfig extends FocusConfig {
  getOverlayContainer?: () => HTMLElement;
}

export interface FullscreenState {
  currentFullscreenElement: Element | null;
  wasInFullscreen: boolean;
}

/**
 * Get the current fullscreen element (handles webkit prefix)
 */
export function getFullscreenElement(): Element | null {
  return (
    document.fullscreenElement ||
    (document as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
    null
  );
}

/**
 * Create fullscreen change handler
 */
export function createFullscreenHandler(
  config: FullscreenConfig,
  state: FullscreenState,
  onKeyDown: (e: KeyboardEvent) => void
): () => void {
  return () => {
    const fullscreenEl = getFullscreenElement();

    // Remove listener from previous fullscreen element
    if (state.currentFullscreenElement) {
      state.currentFullscreenElement.removeEventListener(
        'keydown',
        onKeyDown as EventListener,
        true
      );
      state.currentFullscreenElement = null;
    }

    if (fullscreenEl) {
      // Entering fullscreen
      state.currentFullscreenElement = fullscreenEl;
      state.currentFullscreenElement.addEventListener('keydown', onKeyDown as EventListener, true);
      setTimeout(() => focusPlayer(config), 100);
      state.wasInFullscreen = true;
    } else if (state.wasInFullscreen) {
      // Exiting fullscreen
      state.wasInFullscreen = false;
      setTimeout(() => {
        const container = config.getOverlayContainer?.();
        createClickOverlay(() => focusPlayer(config), container);
        focusPlayer(config);
        console.info('[StreamKeys] Fullscreen exit: Click to focus overlay added');
      }, 100);
    }
  };
}

/**
 * Set up fullscreen change listeners
 */
export function setupFullscreenListeners(handler: () => void): () => void {
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);

  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}
