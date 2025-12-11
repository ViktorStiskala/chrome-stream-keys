// Handler type definitions

import type { SubtitleConfig, FeatureFlags } from '@/types';

export interface HandlerConfig {
  name: string;
  getPlayer: () => HTMLElement | null;
  getButton?: (keyCode: string) => HTMLElement | null;
  setupPlayerFocus?: (player: HTMLElement) => void;
  onPlayerSetup?: (player: HTMLElement) => void;
  getOverlayContainer?: () => HTMLElement;
  /** Custom video element selector for services with multiple video elements */
  getVideo?: () => HTMLVideoElement | null;
  /** Custom playback time getter for services where video.currentTime is unreliable */
  getPlaybackTime?: () => number | null;
  /** Custom duration getter for services where video.duration is unreliable */
  getDuration?: () => number | null;
  /** Get seek buttons for position history tracking and custom seek override */
  getSeekButtons?: () => { backward: HTMLElement | null; forward: HTMLElement | null };
  /**
   * Whether direct video.currentTime manipulation is supported.
   * Set to false for services using MediaSource Extensions (like Disney+)
   * where currentTime is buffer-relative. Defaults to true.
   */
  supportsDirectSeek?: boolean;
  subtitles?: SubtitleConfig;
  features?: FeatureFlags;
}

export interface HandlerAPI {
  /** Cleanup all resources */
  cleanup: () => void;
}
