// Handler type definitions

import type { SubtitleConfig, FeatureFlags } from '@/types';

export interface HandlerConfig {
  name: string;
  getPlayer: () => HTMLElement | null;
  getButton?: (keyCode: string) => HTMLElement | null;
  setupPlayerFocus?: (player: HTMLElement) => void;
  onPlayerSetup?: (player: HTMLElement) => void;
  getOverlayContainer?: () => HTMLElement;
  subtitles?: SubtitleConfig;
  features?: FeatureFlags;
}

export interface HandlerAPI {
  /** Cleanup all resources */
  cleanup: () => void;
}
