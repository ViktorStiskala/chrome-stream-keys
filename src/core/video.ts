// Video element utilities

import type { StreamKeysVideoElement } from '@/types';

/**
 * Get the video element from the player or page
 */
export function getVideoElement(
  getPlayer: () => HTMLElement | null
): StreamKeysVideoElement | null {
  // Try to find video element within the player
  const player = getPlayer();
  if (player) {
    const video = player.querySelector('video');
    if (video) return video as StreamKeysVideoElement;
  }
  // Fallback: find any video on the page
  return document.querySelector('video') as StreamKeysVideoElement | null;
}

/**
 * Format seconds to human-readable time string (e.g., "1:23:45" or "23:45")
 */
export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp to relative time string (e.g., "2m 30s ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const totalSeconds = Math.floor((Date.now() - timestamp) / 1000);

  if (totalSeconds < 1) return 'just now';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m ago`;
    }
    return `${hours}h ago`;
  }

  if (minutes > 0) {
    if (seconds > 0) {
      return `${minutes}m ${seconds}s ago`;
    }
    return `${minutes}m ago`;
  }

  return `${seconds}s ago`;
}
