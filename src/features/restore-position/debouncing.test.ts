/**
 * Debouncing behavior tests with real DOM fixtures.
 *
 * Tests that verify the different debouncing behavior between:
 * - Timeline clicks: NEVER debounced (each click saves)
 * - UI button clicks: Debounced (5-second window)
 *
 * Uses real Disney+ and HBO Max DOM fixtures to ensure the behavior
 * works correctly with actual service DOM structures.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadFixture,
  resetFixture,
  createMockVideo,
  createMockProgressBar,
  simulateSeek,
  simulateVideoLoad,
  type MockVideoElement,
} from '@test';
import { RestorePosition, type RestorePositionAPI } from './index';
import {
  SEEK_MIN_DIFF_SECONDS,
  SEEK_DEBOUNCE_MS,
  LOAD_TIME_CAPTURE_DELAY_MS,
  READY_FOR_TRACKING_DELAY_MS,
  STABLE_TIME_DELAY_MS,
} from './history';
import { RestoreDialog } from './dialog';
import { Video } from '@/core/video';
import { Keyboard, type KeyboardAPI } from '@/features/keyboard';
import type { StreamKeysVideoElement } from '@/types';

// Mock Settings module
vi.mock('@/core/settings', () => ({
  Settings: {
    isPositionHistoryEnabled: vi.fn(() => true),
    getSubtitlePreferences: vi.fn(() => ['English']),
    isCustomSeekEnabled: vi.fn(() => true), // Enable custom seek for testing
    getSeekTime: vi.fn(() => 10), // 10 second seek time
  },
}));

describe('Position History Debouncing with Real DOM', () => {
  let video: MockVideoElement;
  let restorePositionAPI: RestorePositionAPI;
  let getVideoElement: () => StreamKeysVideoElement | null;

  afterEach(() => {
    restorePositionAPI?.cleanup();
    RestoreDialog.close();
    vi.useRealTimers();
    resetFixture();
  });

  /**
   * Helper to set up the test environment with a video and RestorePosition API.
   *
   * WHAT'S TESTED VS MOCKED:
   * - _streamKeysReadyForTracking: Set by REAL setTimeout code - we verify it works
   * - _streamKeysStableTime: MANUALLY set - jsdom doesn't support RAF loop
   * - _streamKeysLastKnownTime: MANUALLY set - jsdom doesn't support RAF loop
   *
   * The RAF loop that normally updates stable/lastKnown times doesn't run in jsdom,
   * so we must set these values manually. This is acceptable because:
   * 1. We're testing debouncing logic, not RAF behavior
   * 2. The setTimeout callbacks for _streamKeysReadyForTracking DO run and are verified
   *
   * @param videoElement - The mock video element
   * @param container - Optional container for the video (defaults to document.body)
   */
  function setupWithVideo(videoElement: MockVideoElement, container?: HTMLElement) {
    video = videoElement;

    // Only append if not already in DOM
    if (!video.parentElement) {
      (container || document.body).appendChild(video);
    }

    getVideoElement = Video.createGetter({
      getPlayer: () => container || document.body,
      getVideo: () => video,
    });

    restorePositionAPI = RestorePosition.init({ getVideoElement });

    // Simulate video load and wait for tracking to be ready
    // The real code uses nested setTimeout:
    //   captureLoadTimeOnce -> setTimeout(LOAD_TIME_CAPTURE_DELAY_MS)
    //                       -> setTimeout(READY_FOR_TRACKING_DELAY_MS)
    // vitest handles nested setTimeout correctly with a single advance
    const resumePosition = SEEK_MIN_DIFF_SECONDS + 100;
    simulateVideoLoad(video, resumePosition);
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    // MANUAL SETUP: jsdom doesn't properly support requestAnimationFrame
    // In production, the RAF loop in setupVideoTracking() updates these values every frame.
    // We must set them manually to simulate the RAF loop's behavior.
    // This is NOT a mock of the debouncing logic we're testing - it's infrastructure.
    const augmentedVideo = getVideoElement() as StreamKeysVideoElement;
    if (augmentedVideo) {
      augmentedVideo._streamKeysStableTime = augmentedVideo.currentTime;
      augmentedVideo._streamKeysLastKnownTime = augmentedVideo.currentTime;
    }
  }

  describe('HBO Max DOM', () => {
    beforeEach(() => {
      resetFixture();
      vi.useFakeTimers();
      loadFixture('hbomax');

      const mockVideo = createMockVideo({
        currentTime: 0,
        duration: 7200,
        readyState: 4,
        src: 'blob:https://play.hbomax.com/test',
      });

      // Add video to the player container
      const playerContainer = document.querySelector('[data-testid="playerContainer"]');
      if (playerContainer) {
        playerContainer.appendChild(mockVideo);
      }

      setupWithVideo(mockVideo);
    });

    describe('timeline clicks (never debounced)', () => {
      it('saves every timeline click even within debounce window', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        // Set up initial position
        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
        video._setCurrentTime(position1);
        augmentedVideo._streamKeysStableTime = position1;
        augmentedVideo._streamKeysLastKnownTime = position1;

        // First timeline click
        const dest1 = position1 + SEEK_MIN_DIFF_SECONDS + 200;
        simulateSeek(video, dest1);
        expect(state.positionHistory.length).toBe(1);
        expect(state.positionHistory[0].time).toBe(position1);

        // Update stable time for next seek
        augmentedVideo._streamKeysStableTime = dest1;
        augmentedVideo._streamKeysLastKnownTime = dest1;

        // Second timeline click only 1 second later (within debounce window)
        vi.advanceTimersByTime(1000);
        const dest2 = dest1 + SEEK_MIN_DIFF_SECONDS + 200;
        simulateSeek(video, dest2);

        // Both should be saved (timeline clicks are NOT debounced)
        expect(state.positionHistory.length).toBe(2);
        expect(state.positionHistory[1].time).toBe(dest1);
      });

      it('saves rapid timeline clicks in succession', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        let currentPos = loadTime + SEEK_MIN_DIFF_SECONDS + 100;

        // Simulate 5 rapid timeline clicks, 500ms apart
        for (let i = 0; i < 5; i++) {
          video._setCurrentTime(currentPos);
          augmentedVideo._streamKeysStableTime = currentPos;
          augmentedVideo._streamKeysLastKnownTime = currentPos;

          const nextPos = currentPos + SEEK_MIN_DIFF_SECONDS + 100;
          simulateSeek(video, nextPos);
          currentPos = nextPos;

          vi.advanceTimersByTime(500);
        }

        // All 5 positions should be saved (up to max history of 3)
        // Note: SEEK_MAX_HISTORY = 3, so oldest ones are removed
        expect(state.positionHistory.length).toBe(3);
      });
    });

    describe('keyboard/button seeks (debounced)', () => {
      it('debounces rapid keyboard seeks', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position1;

        // First keyboard seek - should save
        restorePositionAPI.setKeyboardSeek(true);
        restorePositionAPI.recordBeforeSeek(position1);
        restorePositionAPI.setKeyboardSeek(false);
        expect(state.positionHistory.length).toBe(1);

        // Second keyboard seek 1s later - should be debounced
        vi.advanceTimersByTime(1000);
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position2;

        restorePositionAPI.setKeyboardSeek(true);
        restorePositionAPI.recordBeforeSeek(position2);
        restorePositionAPI.setKeyboardSeek(false);

        // Still only 1 (debounced)
        expect(state.positionHistory.length).toBe(1);
      });

      it('saves keyboard seek after debounce window expires', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position1;

        // First keyboard seek
        restorePositionAPI.setKeyboardSeek(true);
        restorePositionAPI.recordBeforeSeek(position1);
        restorePositionAPI.setKeyboardSeek(false);
        expect(state.positionHistory.length).toBe(1);

        // Wait for debounce to expire
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);

        // Second keyboard seek - should save now
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position2;

        restorePositionAPI.setKeyboardSeek(true);
        restorePositionAPI.recordBeforeSeek(position2);
        restorePositionAPI.setKeyboardSeek(false);

        expect(state.positionHistory.length).toBe(2);
      });
    });

    describe('mixed timeline and keyboard seeks', () => {
      it('timeline seek followed by keyboard seek: both save independently', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
        video._setCurrentTime(position1);
        augmentedVideo._streamKeysStableTime = position1;
        augmentedVideo._streamKeysLastKnownTime = position1;

        // Timeline click
        const dest1 = position1 + SEEK_MIN_DIFF_SECONDS + 200;
        simulateSeek(video, dest1);
        expect(state.positionHistory.length).toBe(1);
        expect(state.positionHistory[0].time).toBe(position1);

        // 1 second later, keyboard seek from the new position
        vi.advanceTimersByTime(1000);
        augmentedVideo._streamKeysStableTime = dest1;
        augmentedVideo._streamKeysLastKnownTime = dest1;

        // Keyboard seek should save (separate debounce from timeline)
        restorePositionAPI.setKeyboardSeek(true);
        restorePositionAPI.recordBeforeSeek(dest1);
        restorePositionAPI.setKeyboardSeek(false);

        // Both should be saved
        expect(state.positionHistory.length).toBe(2);
        expect(state.positionHistory[1].time).toBe(dest1);
      });

      it('keyboard seek followed by timeline click: both save independently', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position1;

        // Keyboard seek
        restorePositionAPI.setKeyboardSeek(true);
        restorePositionAPI.recordBeforeSeek(position1);
        restorePositionAPI.setKeyboardSeek(false);
        expect(state.positionHistory.length).toBe(1);

        // 1 second later, timeline click
        vi.advanceTimersByTime(1000);
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + 100;
        video._setCurrentTime(position2);
        augmentedVideo._streamKeysStableTime = position2;
        augmentedVideo._streamKeysLastKnownTime = position2;

        const dest = position2 + SEEK_MIN_DIFF_SECONDS + 200;
        simulateSeek(video, dest);

        // Both should be saved (timeline is not affected by keyboard debounce)
        expect(state.positionHistory.length).toBe(2);
        expect(state.positionHistory[1].time).toBe(position2);
      });
    });

    describe('recordBeforeSeek return value', () => {
      it('returns false for first save (not debounced)', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history and reset debounce state
        state.positionHistory = [];
        state.lastSeekTime = 0;

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position1;

        // First save should return false (not debounced)
        const wasDebounced = restorePositionAPI.recordBeforeSeek(position1);
        expect(wasDebounced).toBe(false);
        expect(state.positionHistory.length).toBe(1);
      });

      it('returns true for rapid saves (debounced)', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history and reset debounce state
        state.positionHistory = [];
        state.lastSeekTime = 0;

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position1;

        // First save - not debounced
        const wasDebounced1 = restorePositionAPI.recordBeforeSeek(position1);
        expect(wasDebounced1).toBe(false);

        // Second save 1s later - should be debounced
        vi.advanceTimersByTime(1000);
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position2;

        const wasDebounced2 = restorePositionAPI.recordBeforeSeek(position2);
        expect(wasDebounced2).toBe(true);
        expect(state.positionHistory.length).toBe(1); // Still only 1
      });

      it('returns false after debounce window expires', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history and reset debounce state
        state.positionHistory = [];
        state.lastSeekTime = 0;

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position1;

        // First save
        restorePositionAPI.recordBeforeSeek(position1);

        // Wait for debounce to expire
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);

        // Second save after debounce expired - not debounced
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position2;

        const wasDebounced = restorePositionAPI.recordBeforeSeek(position2);
        expect(wasDebounced).toBe(false);
        expect(state.positionHistory.length).toBe(2);
      });
    });

    describe('isKeyboardOrButtonSeek flag behavior', () => {
      it('flag stays true during rapid debounced button clicks', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];
        state.lastSeekTime = 0;

        const loadTime = state.loadTimePosition!;
        let currentPos = loadTime + SEEK_MIN_DIFF_SECONDS + 100;

        // Simulate rapid button clicks (every 200ms for 2 seconds)
        // Each click sets flag to true and schedules reset
        // With our fix, rapid clicks should extend the timeout
        for (let i = 0; i < 10; i++) {
          augmentedVideo._streamKeysStableTime = currentPos;

          restorePositionAPI.setKeyboardSeek(true);
          restorePositionAPI.recordBeforeSeek(currentPos);
          // Note: In real code, the timeout would reset the flag
          // Here we're testing that recordBeforeSeek returns debounced status

          currentPos += SEEK_MIN_DIFF_SECONDS + 50;
          vi.advanceTimersByTime(200);
        }

        // Only first click should have saved (rest debounced)
        expect(state.positionHistory.length).toBe(1);
      });

      it('timeline clicks do not affect button click debouncing', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];
        state.lastSeekTime = 0;

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position1;

        // First button click - saves
        restorePositionAPI.setKeyboardSeek(true);
        const wasDebounced1 = restorePositionAPI.recordBeforeSeek(position1);
        restorePositionAPI.setKeyboardSeek(false);
        expect(wasDebounced1).toBe(false);
        expect(state.positionHistory.length).toBe(1);

        // 1 second later, timeline click (goes through handleSeeking, not recordBeforeSeek)
        vi.advanceTimersByTime(1000);
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + 100;
        video._setCurrentTime(position2);
        augmentedVideo._streamKeysStableTime = position2;
        augmentedVideo._streamKeysLastKnownTime = position2;
        simulateSeek(video, position2 + 500);
        expect(state.positionHistory.length).toBe(2);

        // Another button click 500ms later - should still be debounced from first click
        vi.advanceTimersByTime(500);
        const position3 = position2 + SEEK_MIN_DIFF_SECONDS + 100;
        augmentedVideo._streamKeysStableTime = position3;

        restorePositionAPI.setKeyboardSeek(true);
        const wasDebounced3 = restorePositionAPI.recordBeforeSeek(position3);
        restorePositionAPI.setKeyboardSeek(false);

        // Should still be debounced (timeline click didn't reset button debounce)
        expect(wasDebounced3).toBe(true);
        expect(state.positionHistory.length).toBe(2); // No new entry from button click
      });
    });

    describe('rapid key presses with real Keyboard handler (regression test)', () => {
      /**
       * This test verifies the fix for a bug where rapid keyboard presses would
       * cause positions to be saved as "timeline clicks" instead of being debounced.
       *
       * The bug occurred because:
       * 1. Each key press set isKeyboardOrButtonSeek=true and added a 'seeked' listener
       * 2. The first 'seeked' event would reset the flag to false
       * 3. Subsequent 'seeking' events saw the flag as false and saved via handleSeeking
       *
       * The fix ensures that each new key press removes the previous listener,
       * so the flag stays true while the user is actively pressing keys.
       *
       * HBO Max uses the real video element for seeking (supportsDirectSeek=true).
       */
      let keyboardAPI: KeyboardAPI;

      afterEach(() => {
        keyboardAPI?.cleanup();
      });

      it('rapid ArrowRight presses only save first position', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;

        // Set initial video position
        video._setCurrentTime(position1);
        augmentedVideo._streamKeysStableTime = position1;
        augmentedVideo._streamKeysLastKnownTime = position1;

        // Initialize real Keyboard handler
        keyboardAPI = Keyboard.init({
          getVideoElement,
          restorePosition: restorePositionAPI,
          supportsDirectSeek: true,
        });

        // First key press - should save position1
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
        expect(state.positionHistory.length).toBe(1);
        expect(state.positionHistory[0].time).toBe(position1);

        // Rapid key presses - simulate user holding down the key
        for (let i = 0; i < 5; i++) {
          vi.advanceTimersByTime(100);

          // Video fires seeking/seeked events as it seeks
          video._setSeeking(true);
          video.dispatchEvent(new Event('seeking'));
          video._setSeeking(false);
          video.dispatchEvent(new Event('seeked'));

          // Another key press before the flag reset timeout
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
        }

        // Only the first position should be saved (rest debounced)
        expect(state.positionHistory.length).toBe(1);
        expect(state.positionHistory[0].time).toBe(position1);
      });

      it('timeline click works after keyboard presses and flag reset', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;

        // Set initial video position
        video._setCurrentTime(position1);
        augmentedVideo._streamKeysStableTime = position1;
        augmentedVideo._streamKeysLastKnownTime = position1;

        // Initialize real Keyboard handler
        keyboardAPI = Keyboard.init({
          getVideoElement,
          restorePosition: restorePositionAPI,
          supportsDirectSeek: true,
        });

        // Key press - saves position1
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
        expect(state.positionHistory.length).toBe(1);

        // Video fires seeked event, which resets the flag
        video.dispatchEvent(new Event('seeked'));

        // Wait for debounce to expire
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);

        // Timeline click should save normally
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + 200;
        video._setCurrentTime(position2);
        augmentedVideo._streamKeysStableTime = position2;
        augmentedVideo._streamKeysLastKnownTime = position2;

        simulateSeek(video, position2 + 500);
        expect(state.positionHistory.length).toBe(2);
        expect(state.positionHistory[1].time).toBe(position2);
      });

      it('mixed rapid key presses with seeked events dont cause extra saves', () => {
        /**
         * This test simulates realistic rapid key pressing behavior:
         * 1. User presses key (key repeat rate ~100ms)
         * 2. Video starts seeking (seeking event)
         * 3. User presses key again BEFORE seeked fires
         * 4. Previous seeked listener is removed, new one added
         * 5. Video finishes seek (seeked event, but listener was replaced)
         * 6. Flag stays true because new listener hasn't fired yet
         *
         * The bug was: each key press added a NEW listener without removing the old one.
         * The first seeked event would trigger the OLD listener and reset the flag,
         * causing subsequent seeking events to save as "timeline clicks".
         */
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        let currentPos = loadTime + SEEK_MIN_DIFF_SECONDS + 100;

        video._setCurrentTime(currentPos);
        augmentedVideo._streamKeysStableTime = currentPos;
        augmentedVideo._streamKeysLastKnownTime = currentPos;

        // Initialize real Keyboard handler
        keyboardAPI = Keyboard.init({
          getVideoElement,
          restorePosition: restorePositionAPI,
          supportsDirectSeek: true,
        });

        // Simulate rapid key presses - key press comes BEFORE seeked event
        // This is realistic: user holds down key, each press triggers a new seek
        // before the previous one completes
        for (let i = 0; i < 15; i++) {
          // Key press (registers new seeked listener, removes old one)
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));

          vi.advanceTimersByTime(100);
          currentPos += 10;

          // Update video position
          video._setCurrentTime(currentPos);
          augmentedVideo._streamKeysStableTime = currentPos;
          augmentedVideo._streamKeysLastKnownTime = currentPos;

          // Video fires seeking event (handleSeeking checks flag - should be true)
          video._setSeeking(true);
          video.dispatchEvent(new Event('seeking'));
          video._setSeeking(false);

          // Video fires seeked event (but the listener was replaced by next key press)
          video.dispatchEvent(new Event('seeked'));
        }

        // Only the first position should be saved (from first key press)
        // Rest were debounced because key presses kept replacing the seeked listener
        expect(state.positionHistory.length).toBe(1);
      });
    });
  });

  describe('Disney+ DOM', () => {
    // Disney+ progress bar time (simulates reading from Shadow DOM aria-valuenow)
    // This is mutable so tests can update it to simulate playback/seeking
    let disneyProgressBarTime: number;

    beforeEach(() => {
      resetFixture();
      vi.useFakeTimers();
      loadFixture('disney');

      // Initialize progress bar time
      disneyProgressBarTime = 0;

      // Create Disney+ progress bar for time tracking
      createMockProgressBar('3600', '7200'); // 1 hour into a 2 hour movie

      const mockVideo = createMockVideo({
        currentTime: 0, // Disney+ video.currentTime is buffer-relative (unreliable)
        duration: 7200,
        readyState: 4,
        src: 'blob:https://www.disneyplus.com/test',
      });

      // Add video to Disney player
      const player = document.querySelector('disney-web-player') as HTMLElement;
      if (player) {
        mockVideo.classList.add('hive-video');
        player.appendChild(mockVideo);
      }

      video = mockVideo;

      // Disney+ needs a custom getPlaybackTime that reads from the progress bar
      // (video.currentTime is buffer-relative and unreliable)
      getVideoElement = Video.createGetter({
        getPlayer: () => player || document.body,
        getVideo: () => video,
        getPlaybackTime: () => disneyProgressBarTime, // Simulates reading from Shadow DOM
      });

      restorePositionAPI = RestorePosition.init({ getVideoElement });

      // Simulate video load - vitest handles nested setTimeout correctly
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 100;
      disneyProgressBarTime = resumePosition; // Update progress bar time
      simulateVideoLoad(video, resumePosition);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      // MANUAL SETUP: jsdom doesn't support RAF, so we set stable time manually
      const augmentedVideo = getVideoElement() as StreamKeysVideoElement;
      if (augmentedVideo) {
        augmentedVideo._streamKeysStableTime = resumePosition;
        augmentedVideo._streamKeysLastKnownTime = resumePosition;
      }
    });

    describe('timeline clicks (never debounced)', () => {
      it('saves every timeline click on Disney+ even within debounce window', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        // Ensure video is ready for tracking
        expect(augmentedVideo).not.toBeNull();
        expect(augmentedVideo._streamKeysReadyForTracking).toBe(true);
        expect(augmentedVideo._streamKeysGetStableTime).toBeDefined();

        const loadTime = state.loadTimePosition!;
        // Use large gaps (1000s apart) to avoid any proximity blocking
        const position1 = loadTime + 1000;

        // For Disney+, update the progress bar time (simulates what the real player does)
        disneyProgressBarTime = position1;
        augmentedVideo._streamKeysStableTime = position1;
        augmentedVideo._streamKeysLastKnownTime = position1;

        // Verify stable time getter works
        expect(augmentedVideo._streamKeysGetStableTime?.()).toBe(position1);

        // First timeline click - when user clicks timeline, Disney+ updates progress bar
        // BEFORE the seeking event fires (this is the race condition we handle)
        const dest1 = position1 + 1000;
        // Stable time still reflects the OLD position (500ms delayed)
        simulateSeek(video, dest1);
        expect(state.positionHistory.length).toBe(1);
        expect(state.positionHistory[0].time).toBe(position1);

        // After seek completes, update progress bar and wait for stable time delay
        // Disney+ RAF loop updates stable time with STABLE_TIME_DELAY_MS delay
        disneyProgressBarTime = dest1;
        augmentedVideo._streamKeysLastKnownTime = dest1;

        // Wait for stable time to update (500ms delay in RAF loop)
        // Use vi.advanceTimersByTime to ensure setTimeout callback executes
        vi.advanceTimersByTime(STABLE_TIME_DELAY_MS + 100);
        augmentedVideo._streamKeysStableTime = dest1;

        // Verify stable time is updated
        expect(augmentedVideo._streamKeysGetStableTime?.()).toBe(dest1);

        // Second timeline click
        const dest2 = dest1 + 1000;
        simulateSeek(video, dest2);

        // Both should be saved (timeline clicks are NOT debounced)
        expect(state.positionHistory.length).toBe(2);
        expect(state.positionHistory[1].time).toBe(dest1);
      });
    });

    describe('keyboard/button seeks (debounced)', () => {
      it('debounces rapid keyboard seeks on Disney+', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + SEEK_MIN_DIFF_SECONDS + 100;

        // Update Disney+ progress bar time and stable time
        disneyProgressBarTime = position1;
        augmentedVideo._streamKeysStableTime = position1;

        // First keyboard seek
        restorePositionAPI.setKeyboardSeek(true);
        restorePositionAPI.recordBeforeSeek(position1);
        restorePositionAPI.setKeyboardSeek(false);
        expect(state.positionHistory.length).toBe(1);

        // Rapid keyboard seeks should be debounced
        for (let i = 0; i < 5; i++) {
          vi.advanceTimersByTime(500);
          const nextPos = position1 + (i + 1) * (SEEK_MIN_DIFF_SECONDS + 50);

          disneyProgressBarTime = nextPos;
          augmentedVideo._streamKeysStableTime = nextPos;

          restorePositionAPI.setKeyboardSeek(true);
          restorePositionAPI.recordBeforeSeek(nextPos);
          restorePositionAPI.setKeyboardSeek(false);
        }

        // Still only 1 (all others debounced)
        expect(state.positionHistory.length).toBe(1);
      });
    });

    describe('mixed timeline and keyboard seeks on Disney+', () => {
      it('user scenario: timeline seek then button clicks', () => {
        /**
         * This tests the exact user scenario that was reported:
         * 1. User at position A (e.g., 1:24:08)
         * 2. User clicks timeline to go to B (e.g., 10:05)
         * 3. Position A should be saved
         * 4. User then clicks skip buttons
         * 5. Position B should also be saved (not blocked by timeline debounce)
         *
         * Disney+ specifics:
         * - Uses Shadow DOM progress bar for time tracking
         * - video.currentTime is buffer-relative and unreliable
         * - Progress bar updates BEFORE seeking event fires (race condition)
         * - Stable time updates with STABLE_TIME_DELAY_MS (500ms) delay
         */
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        // Position A: user is watching at 1:24:08 (5048 seconds)
        const loadTime = state.loadTimePosition!;
        const positionA = loadTime + SEEK_MIN_DIFF_SECONDS + 5000; // ~1:24:08

        // Update Disney+ progress bar and stable time
        disneyProgressBarTime = positionA;
        augmentedVideo._streamKeysStableTime = positionA;
        augmentedVideo._streamKeysLastKnownTime = positionA;

        // User clicks timeline to go to position B (~10:05 = 605 seconds)
        const positionB = loadTime + SEEK_MIN_DIFF_SECONDS + 500; // ~10:05
        // Note: stable time still reflects position A (500ms delay protects against race)
        simulateSeek(video, positionB);

        // Position A should be saved
        expect(state.positionHistory.length).toBe(1);
        expect(state.positionHistory[0].time).toBe(positionA);

        // Update progress bar and wait for stable time delay
        disneyProgressBarTime = positionB;
        augmentedVideo._streamKeysLastKnownTime = positionB;

        // Wait for stable time to update (500ms delay) plus some extra time
        // Use vi.advanceTimersByTime to ensure setTimeout callback executes
        vi.advanceTimersByTime(STABLE_TIME_DELAY_MS + 500);
        augmentedVideo._streamKeysStableTime = positionB;

        // Button click should save position B
        restorePositionAPI.setKeyboardSeek(true);
        restorePositionAPI.recordBeforeSeek(positionB);
        restorePositionAPI.setKeyboardSeek(false);

        // Position B should also be saved (button seeks have separate debounce)
        expect(state.positionHistory.length).toBe(2);
        expect(state.positionHistory[1].time).toBe(positionB);
      });
    });

    describe('rapid key presses with real Keyboard handler on Disney+ (regression test)', () => {
      /**
       * Disney+ has additional timing complexity:
       * - Uses Shadow DOM progress bar for time tracking
       * - video.currentTime is buffer-relative (unreliable)
       * - Progress bar updates BEFORE seeking event fires
       * - Stable time is delayed by STABLE_TIME_DELAY_MS
       * - supportsDirectSeek=false (clicks native buttons instead)
       *
       * This test ensures the keyboard handler fix works correctly with
       * Disney+'s unique timing behavior.
       */
      let keyboardAPI: KeyboardAPI;

      afterEach(() => {
        keyboardAPI?.cleanup();
      });

      it('rapid ArrowRight presses only save first position on Disney+', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        let currentPos = loadTime + 1000;

        // Set initial position
        disneyProgressBarTime = currentPos;
        augmentedVideo._streamKeysStableTime = currentPos;
        augmentedVideo._streamKeysLastKnownTime = currentPos;

        // Initialize real Keyboard handler
        // Disney+ uses supportsDirectSeek=false, but for testing the flag behavior,
        // we can use supportsDirectSeek=true to simplify (avoid needing getButton)
        keyboardAPI = Keyboard.init({
          getVideoElement,
          restorePosition: restorePositionAPI,
          supportsDirectSeek: true,
        });

        // First key press - should save position
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
        expect(state.positionHistory.length).toBe(1);
        expect(state.positionHistory[0].time).toBe(currentPos);

        // Rapid key presses on Disney+ - flag stays true
        for (let i = 0; i < 5; i++) {
          vi.advanceTimersByTime(100);
          currentPos += 1000;

          // Disney+ updates progress bar
          disneyProgressBarTime = currentPos;
          augmentedVideo._streamKeysStableTime = currentPos;
          augmentedVideo._streamKeysLastKnownTime = currentPos;

          // Disney+ fires seeking/seeked events
          video._setSeeking(true);
          video.dispatchEvent(new Event('seeking'));
          video._setSeeking(false);
          video.dispatchEvent(new Event('seeked'));

          // Another key press
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
        }

        // Only the first position should be saved
        expect(state.positionHistory.length).toBe(1);
      });

      it('timeline click works after keyboard presses and seeked event on Disney+', () => {
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        const position1 = loadTime + 1000;

        // Set initial position
        disneyProgressBarTime = position1;
        augmentedVideo._streamKeysStableTime = position1;
        augmentedVideo._streamKeysLastKnownTime = position1;

        // Initialize real Keyboard handler
        keyboardAPI = Keyboard.init({
          getVideoElement,
          restorePosition: restorePositionAPI,
          supportsDirectSeek: true,
        });

        // Key press - saves position1
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
        expect(state.positionHistory.length).toBe(1);

        // Video fires seeked event, which resets the flag
        video.dispatchEvent(new Event('seeked'));

        // Wait for debounce to expire and stable time delay
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + STABLE_TIME_DELAY_MS + 100);

        // User clicks timeline
        const position2 = position1 + 1000;
        disneyProgressBarTime = position2;
        augmentedVideo._streamKeysStableTime = position2;
        augmentedVideo._streamKeysLastKnownTime = position2;

        simulateSeek(video, position2 + 500);
        expect(state.positionHistory.length).toBe(2);
        expect(state.positionHistory[1].time).toBe(position2);
      });

      it('rapid key presses with interleaved events only saves once on Disney+', () => {
        /**
         * Same as HBO Max test, but with Disney+ specifics:
         * - Progress bar updates simulated
         * - Stable time tracking
         *
         * The realistic scenario is: user holds down arrow key,
         * each key press comes BEFORE the previous seek completes.
         */
        const state = restorePositionAPI.getState();
        const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

        // Clear history
        state.positionHistory = [];

        const loadTime = state.loadTimePosition!;
        let currentPos = loadTime + 1000;

        disneyProgressBarTime = currentPos;
        augmentedVideo._streamKeysStableTime = currentPos;
        augmentedVideo._streamKeysLastKnownTime = currentPos;

        // Initialize real Keyboard handler
        keyboardAPI = Keyboard.init({
          getVideoElement,
          restorePosition: restorePositionAPI,
          supportsDirectSeek: true,
        });

        // Simulate rapid key presses - key press comes BEFORE seeked event
        for (let i = 0; i < 15; i++) {
          // Key press (registers new seeked listener, removes old one)
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));

          vi.advanceTimersByTime(100);
          currentPos += 10;

          // Disney+ updates progress bar
          disneyProgressBarTime = currentPos;
          augmentedVideo._streamKeysStableTime = currentPos;
          augmentedVideo._streamKeysLastKnownTime = currentPos;

          // Disney+ fires seeking event
          video._setSeeking(true);
          video.dispatchEvent(new Event('seeking'));
          video._setSeeking(false);

          // Disney+ fires seeked event (listener was replaced)
          video.dispatchEvent(new Event('seeked'));
        }

        // Only the first position should be saved
        expect(state.positionHistory.length).toBe(1);
      });
    });
  });
});
