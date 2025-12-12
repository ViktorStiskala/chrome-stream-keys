/**
 * Shared test utilities for Restore Position feature tests.
 * Provides common setup, helpers, and mock configuration.
 */

import { vi } from 'vitest';
import { resetFixture, createMockVideo, simulateVideoLoad, type MockVideoElement } from '@test';
import { RestorePosition, type RestorePositionAPI } from './index';
import {
  LOAD_TIME_CAPTURE_DELAY_MS,
  READY_FOR_TRACKING_DELAY_MS,
  SEEK_MIN_DIFF_SECONDS,
} from './history';
import { RestoreDialog } from './dialog';
import { Video } from '@/core/video';
import type { StreamKeysVideoElement } from '@/types';

// Re-export commonly used imports for convenience
export {
  resetFixture,
  createMockVideo,
  simulateSeek,
  simulateVideoLoad,
  loadFixture,
  type MockVideoElement,
} from '@test';
export { RestorePosition, type RestorePositionAPI } from './index';
export {
  PositionHistory,
  SEEK_MIN_DIFF_SECONDS,
  SEEK_DEBOUNCE_MS,
  LOAD_TIME_CAPTURE_DELAY_MS,
  READY_FOR_TRACKING_DELAY_MS,
} from './history';
export { DIALOG_ID, CURRENT_TIME_ID, RELATIVE_TIME_CLASS, RestoreDialog } from './dialog';
export { Video } from '@/core/video';
export type { StreamKeysVideoElement } from '@/types';

/**
 * Shared test context for restore position tests.
 * Contains video element, API instance, and video getter.
 */
export interface TestContext {
  video: MockVideoElement;
  restorePositionAPI: RestorePositionAPI | null;
  getVideoElement: () => StreamKeysVideoElement | null;
}

/**
 * Create the mock Settings module configuration.
 * Must be called with vi.mock() at the module level.
 */
export function createSettingsMock() {
  return {
    Settings: {
      isPositionHistoryEnabled: vi.fn(() => true),
      getSubtitlePreferences: vi.fn(() => ['English']),
    },
  };
}

/**
 * Set up common test context with video element and getter.
 * Call this in beforeEach to initialize test state.
 */
export function setupTestContext(): TestContext {
  resetFixture();
  vi.useFakeTimers();

  // Create mock video with HBO Max-like setup
  const video = createMockVideo({
    currentTime: 0,
    duration: 7200, // 2 hours
    readyState: 4,
    src: 'blob:https://play.hbomax.com/test',
  });

  // Add video to document body
  document.body.appendChild(video);

  // Create video getter once and reuse
  const getVideoElement = Video.createGetter({
    getPlayer: () => document.body,
    getVideo: () => video,
  });

  return {
    video,
    restorePositionAPI: null,
    getVideoElement,
  };
}

/**
 * Clean up test context after each test.
 * Call this in afterEach.
 */
export function cleanupTestContext(ctx: TestContext): void {
  ctx.restorePositionAPI?.cleanup();
  RestoreDialog.close();
  vi.useRealTimers();
  resetFixture();
}

/**
 * Initialize RestorePosition and wait for ready state.
 *
 * WHAT'S TESTED VS MOCKED:
 * - _streamKeysReadyForTracking: Set by REAL setTimeout code in captureLoadTimeOnce()
 * - _streamKeysStableTime: MANUALLY set - jsdom doesn't support RAF loop
 * - _streamKeysLastKnownTime: MANUALLY set - jsdom doesn't support RAF loop
 *
 * The nested setTimeout in captureLoadTimeOnce() works correctly with vitest's fake timers.
 * vitest handles nested setTimeout with a single advanceTimersByTime() call.
 *
 * The RAF loop that normally updates stable/lastKnown times doesn't run in jsdom,
 * so we must set these values manually. This is acceptable because the tests are
 * focused on the debouncing and save logic, not the RAF behavior.
 */
export async function initAndWaitForReady(ctx: TestContext): Promise<void> {
  ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

  // Simulate realistic video load: starts at 0, then player seeks to resume position
  const resumePosition = SEEK_MIN_DIFF_SECONDS + 100; // e.g., 115 seconds (1:55)
  simulateVideoLoad(ctx.video, resumePosition);

  // Wait for load time capture + readyForTracking delays
  // The real code uses nested setTimeout:
  //   captureLoadTimeOnce -> setTimeout(LOAD_TIME_CAPTURE_DELAY_MS)
  //                       -> setTimeout(READY_FOR_TRACKING_DELAY_MS)
  // vitest handles nested setTimeout correctly - a single advance past both is sufficient
  vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

  // MANUAL SETUP: jsdom doesn't properly support requestAnimationFrame
  // In production, the RAF loop in setupVideoTracking() updates these values every frame.
  // We must set them manually to simulate the RAF loop's behavior.
  const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
  if (augmentedVideo) {
    augmentedVideo._streamKeysStableTime = augmentedVideo.currentTime;
    augmentedVideo._streamKeysLastKnownTime = augmentedVideo.currentTime;
  }
}
