// Handler factory - creates handlers with composable features

import type { CleanupFn } from '@/types';
import {
  Focus,
  Fullscreen,
  Player,
  Settings,
  Video,
  type FullscreenState,
  type PlayerState,
} from '@/core';

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;
import {
  RestorePosition,
  Subtitles,
  Keyboard,
  type RestorePositionAPI,
  type SubtitlesAPI,
} from '@/features';
import type { HandlerConfig, HandlerAPI } from './types';

/** Interval for Media Session handler setup (ms) */
const MEDIA_SESSION_SETUP_INTERVAL = 5000;

/** Interval for UI button interception setup (ms) */
const BUTTON_INTERCEPTION_INTERVAL = 2000;

/**
 * Create a handler with composable features
 */
function createHandler(config: HandlerConfig): HandlerAPI {
  console.info(`[StreamKeys] ${config.name} extension loaded at ${new Date().toISOString()}`);

  if (__DEV__) {
    const settings = Settings.get();
    // eslint-disable-next-line no-console
    console.log('[StreamKeys] Settings:', {
      captureMediaKeys: settings.captureMediaKeys,
      customSeekEnabled: settings.customSeekEnabled,
      seekTime: settings.seekTime,
      positionHistoryEnabled: settings.positionHistoryEnabled,
      subtitleLanguages: settings.subtitleLanguages,
    });
  }

  const cleanupFns: CleanupFn[] = [];

  // Determine which features are enabled (all enabled by default)
  const features = {
    subtitles: config.features?.subtitles !== false && !!config.subtitles,
    restorePosition: config.features?.restorePosition !== false,
    keyboard: config.features?.keyboard !== false,
    fullscreenOverlay: config.features?.fullscreenOverlay !== false,
  };

  // Create video getter once - all features share this
  const getVideoElement = Video.createGetter({
    getPlayer: config.getPlayer,
    getVideo: config.getVideo,
    getPlaybackTime: config.getPlaybackTime,
    getDuration: config.getDuration,
  });

  // Initialize features
  let restorePositionAPI: RestorePositionAPI | undefined;
  let subtitlesAPI: SubtitlesAPI | undefined;

  if (features.restorePosition) {
    restorePositionAPI = RestorePosition.init({ getVideoElement });
    cleanupFns.push(restorePositionAPI.cleanup);
  }

  if (features.subtitles && config.subtitles) {
    subtitlesAPI = Subtitles.init({
      subtitles: config.subtitles,
    });
    cleanupFns.push(subtitlesAPI.cleanup);
  }

  // Initialize keyboard handling
  let keyboardHandler: ((e: KeyboardEvent) => void) | undefined;

  // Whether direct video.currentTime manipulation works
  const supportsDirectSeek = config.supportsDirectSeek !== false;

  if (features.keyboard) {
    const keyboardAPI = Keyboard.init({
      getVideoElement,
      getButton: config.getButton,
      restorePosition: restorePositionAPI,
      subtitles: subtitlesAPI,
      supportsDirectSeek,
    });
    keyboardHandler = keyboardAPI.handleKey;
    cleanupFns.push(keyboardAPI.cleanup);
  }

  // Create focus config
  const focusConfig = {
    getPlayer: config.getPlayer,
    setupPlayerFocus: config.setupPlayerFocus,
  };

  // Create mouse move handler
  const mouseMoveHandler = Focus.createMouseMoveHandler(focusConfig);

  // Fullscreen handling
  if (features.fullscreenOverlay) {
    const fullscreenState: FullscreenState = {
      currentFullscreenElement: null,
      wasInFullscreen: false,
    };

    const fullscreenHandler = Fullscreen.createHandler(
      {
        ...focusConfig,
        getOverlayContainer: config.getOverlayContainer,
      },
      fullscreenState,
      keyboardHandler || (() => {})
    );

    const cleanupFullscreen = Fullscreen.setupListeners(fullscreenHandler);
    cleanupFns.push(cleanupFullscreen);
  }

  // Player setup
  const playerState: PlayerState = {
    attachedPlayer: null,
  };

  const playerSetupConfig = {
    getPlayer: config.getPlayer,
    onPlayerSetup: config.onPlayerSetup,
    onKeyDown: keyboardHandler || (() => {}),
    onMouseMove: mouseMoveHandler,
  };

  // Initial setup
  Player.setup(playerSetupConfig, playerState);

  // Periodic setup
  const cleanupPlayerInterval = Player.createSetupInterval(playerSetupConfig, playerState);
  cleanupFns.push(cleanupPlayerInterval);

  // Media Session handlers (when capture enabled)
  if (Settings.isMediaKeysCaptureEnabled() && navigator.mediaSession) {
    console.info(`[StreamKeys] Media keys captured for ${config.name} player`);

    const setupMediaSession = (logEnabled: boolean) => {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          getVideoElement()?.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          getVideoElement()?.pause();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          const video = getVideoElement();
          if (!video) return;
          const delta = Settings.isCustomSeekEnabled() ? Settings.getSeekTime() : 10;
          video.currentTime = Math.max(0, video.currentTime - delta);
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          const video = getVideoElement();
          if (!video) return;
          const delta = Settings.isCustomSeekEnabled() ? Settings.getSeekTime() : 10;
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + delta);
        });
        if (__DEV__ && logEnabled) {
          // eslint-disable-next-line no-console
          console.log('[StreamKeys] Media Session handlers set up');
        }
      } catch {
        /* ignore unsupported actions */
      }
    };

    // Setup immediately and then periodically (to override streaming service)
    setupMediaSession(true);
    const mediaSessionIntervalId = setInterval(
      () => setupMediaSession(false),
      MEDIA_SESSION_SETUP_INTERVAL
    );
    cleanupFns.push(() => clearInterval(mediaSessionIntervalId));
  }

  // UI Button interception (for position history + custom seek)
  if (config.getSeekButtons) {
    const interceptedButtons = new WeakSet<HTMLElement>();

    const setupButtonInterception = () => {
      const buttons = config.getSeekButtons!();

      const interceptButton = (button: HTMLElement | null, direction: 'backward' | 'forward') => {
        if (!button || interceptedButtons.has(button)) return;
        interceptedButtons.add(button);

        button.addEventListener(
          'click',
          (e) => {
            // Always track for position history
            if (restorePositionAPI) {
              restorePositionAPI.setKeyboardSeek(true);
              const video = getVideoElement();
              const currentTime = video?._streamKeysGetStableTime?.();
              if (currentTime !== undefined) {
                restorePositionAPI.recordBeforeSeek(currentTime);
              }
              setTimeout(() => restorePositionAPI!.setKeyboardSeek(false), 500);
            }

            // Only override seek if custom seek enabled AND service supports direct seek
            if (Settings.isCustomSeekEnabled() && supportsDirectSeek) {
              // Stop ALL handlers (including the native button handler)
              e.stopImmediatePropagation();
              e.preventDefault();
              const video = getVideoElement();
              if (video) {
                const delta =
                  direction === 'backward' ? -Settings.getSeekTime() : Settings.getSeekTime();
                video.currentTime = Math.max(
                  0,
                  Math.min(video.duration || Infinity, video.currentTime + delta)
                );
              }
            }
          },
          true
        );
      };

      interceptButton(buttons.backward, 'backward');
      interceptButton(buttons.forward, 'forward');
    };

    setupButtonInterception();
    const buttonInterceptionIntervalId = setInterval(
      setupButtonInterception,
      BUTTON_INTERCEPTION_INTERVAL
    );
    cleanupFns.push(() => clearInterval(buttonInterceptionIntervalId));
  }

  return {
    cleanup: () => {
      cleanupFns.forEach((fn) => fn());
    },
  };
}

// Public API
export const Handler = {
  create: createHandler,
};
