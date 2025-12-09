// Player setup utilities

import type { StreamKeysPlayerElement } from '@/types';

export interface PlayerSetupConfig {
  getPlayer: () => HTMLElement | null;
  onPlayerSetup?: (player: HTMLElement) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onMouseMove: () => void;
}

export interface PlayerState {
  keyListenerAdded: boolean;
}

/**
 * Set up the player element with event listeners
 */
export function setupPlayer(config: PlayerSetupConfig, state: PlayerState): void {
  const player = config.getPlayer() as StreamKeysPlayerElement | null;
  if (!player) return;

  // Call custom setup if provided
  if (config.onPlayerSetup) {
    config.onPlayerSetup(player);
  }

  // Add keydown listener directly to player
  if (!state.keyListenerAdded) {
    player.addEventListener('keydown', config.onKeyDown, true);
    state.keyListenerAdded = true;
  }

  // Add mousemove listener for focus restoration
  if (!player._streamKeysMouseListenerAdded) {
    player.addEventListener('mousemove', config.onMouseMove);
    player._streamKeysMouseListenerAdded = true;
  }
}

/**
 * Create a periodic player setup interval
 */
export function createPlayerSetupInterval(
  config: PlayerSetupConfig,
  state: PlayerState,
  intervalMs = 1000
): () => void {
  const intervalId = setInterval(() => {
    setupPlayer(config, state);
  }, intervalMs);

  return () => clearInterval(intervalId);
}
