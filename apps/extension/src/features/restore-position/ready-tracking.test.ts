/**
 * Ready tracking tests for the event-based ready state management.
 *
 * Tests the handleVideoReady function and related ready state logic including:
 * - isVideoLoaded() duration validation
 * - handleVideoReady early returns and state transitions
 * - Event triggers (canplay, playing, loadeddata)
 * - Capture window timing
 * - Fallback timeout behavior
 * - New video detection and flag reset
 * - Disney+ compatibility (augmented duration)
 * - Stable time tracking isolation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupTestContext,
  cleanupTestContext,
  createMockVideo,
  resetFixture,
  simulateVideoLoad,
  RestorePosition,
  PositionHistory,
  SEEK_MIN_DIFF_SECONDS,
  LOAD_TIME_CAPTURE_DELAY_MS,
  READY_FOR_TRACKING_DELAY_MS,
  Video,
  type TestContext,
  type StreamKeysVideoElement,
} from './test-utils';

// Mock Settings module
vi.mock('@/core/settings', () => ({
  Settings: {
    isPositionHistoryEnabled: vi.fn(() => true),
    getSubtitlePreferences: vi.fn(() => ['English']),
  },
}));

// =============================================================================
// 1. Video Readiness Check (isVideoLoaded)
// =============================================================================

describe('isVideoLoaded duration validation', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = setupTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  describe.each([
    { duration: 0, expected: false, desc: 'zero duration' },
    { duration: NaN, expected: false, desc: 'NaN duration' },
    { duration: -1, expected: false, desc: 'negative duration' },
    { duration: 0.001, expected: true, desc: 'tiny positive duration' },
    { duration: 3600, expected: true, desc: 'normal duration' },
    { duration: Infinity, expected: true, desc: 'infinite duration (live stream)' },
  ])('with $desc (duration=$duration)', ({ duration, expected }) => {
    it(`video is ${expected ? 'loaded' : 'not loaded'} when native duration is ${duration}`, () => {
      // Create video with specific duration
      const video = createMockVideo({
        currentTime: 0,
        duration: duration,
        readyState: 4,
        src: 'blob:https://example.com/test',
      });
      document.body.appendChild(video);

      const getVideoElement = Video.createGetter({
        getPlayer: () => document.body,
        getVideo: () => video,
      });

      const api = RestorePosition.init({ getVideoElement });

      // If duration is valid, video should become ready
      // If duration is invalid, it should wait for fallback or valid duration
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

      if (expected) {
        // Valid duration - should be ready
        expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);
      } else {
        // Invalid duration - should NOT be ready yet (waiting for fallback)
        expect(augmentedVideo?._streamKeysReadyForTracking).toBe(false);
      }

      api.cleanup();
      video.remove();
    });
  });

  it('prefers _streamKeysGetDuration over native video.duration', () => {
    // Video with invalid native duration but valid augmented duration
    const video = createMockVideo({
      currentTime: 100,
      duration: 0, // Invalid native duration
      readyState: 4,
      src: 'blob:https://example.com/test',
    });
    document.body.appendChild(video);

    // Simulate Disney+ pattern: augmented duration works, native doesn't
    const getVideoElement = Video.createGetter({
      getPlayer: () => document.body,
      getVideo: () => video,
      getDuration: () => 3600, // Valid augmented duration
    });

    const api = RestorePosition.init({ getVideoElement });

    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

    // Should be ready because augmented duration is valid
    expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);

    api.cleanup();
    video.remove();
  });
});

// =============================================================================
// 2. handleVideoReady Early Returns
// =============================================================================

describe('handleVideoReady early returns', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = setupTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  it('clears fallback and exits when already ready', () => {
    ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

    // Simulate video loading to trigger ready state
    simulateVideoLoad(ctx.video, SEEK_MIN_DIFF_SECONDS + 100);
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
    expect(augmentedVideo._streamKeysReadyForTracking).toBe(true);

    // Dispatch another canplay event - should be a no-op
    ctx.video.dispatchEvent(new Event('canplay'));

    // Should still be ready (no change)
    expect(augmentedVideo._streamKeysReadyForTracking).toBe(true);
  });

  it('skips when video is not loaded (duration = 0)', () => {
    // Create video with zero duration
    const video = createMockVideo({
      currentTime: 0,
      duration: 0, // Not loaded
      readyState: 1, // HAVE_METADATA
      src: 'blob:https://example.com/test',
    });
    document.body.appendChild(video);

    const getVideoElement = Video.createGetter({
      getPlayer: () => document.body,
      getVideo: () => video,
    });

    const api = RestorePosition.init({ getVideoElement });

    // Dispatch canplay event - should not set ready (duration is 0)
    video.dispatchEvent(new Event('canplay'));

    const augmentedVideo = getVideoElement() as StreamKeysVideoElement;
    expect(augmentedVideo?._streamKeysReadyForTracking).toBe(false);

    api.cleanup();
    video.remove();
  });
});

// =============================================================================
// 3. Event Triggers
// =============================================================================

describe('event triggers', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = setupTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  describe.each([
    { event: 'canplay' },
    { event: 'playing' },
    { event: 'loadeddata' },
  ])('$event event', ({ event }) => {
    it(`triggers handleVideoReady and sets ready flag when video is loaded`, () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

      // Dispatch the event
      ctx.video.dispatchEvent(new Event(event));

      // Wait for the capture delay
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
      expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);
    });
  });

  describe('seeked event via handleSeeked', () => {
    it('triggers handleVideoReady if not yet ready', () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

      // Dispatch seeked event (simulating user seeking in the timeline)
      ctx.video.dispatchEvent(new Event('seeked'));

      // Wait for the capture delay
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
      expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);
    });
  });
});

// =============================================================================
// 4. Capture Window Timing
// =============================================================================

describe('capture window timing', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = setupTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  describe.each([
    { elapsed: 0, withinWindow: true, desc: 'at start' },
    { elapsed: 500, withinWindow: true, desc: 'mid-window' },
    { elapsed: LOAD_TIME_CAPTURE_DELAY_MS - 100, withinWindow: true, desc: 'near boundary' },
  ])('$desc ($elapsed ms elapsed)', ({ elapsed }) => {
    it('attempts to capture load time position', () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

      // Advance time to the elapsed point
      vi.advanceTimersByTime(elapsed);

      // Now dispatch canplay
      simulateVideoLoad(ctx.video, SEEK_MIN_DIFF_SECONDS + 100);

      // Wait for remaining time in capture window + ready delay
      vi.advanceTimersByTime(
        LOAD_TIME_CAPTURE_DELAY_MS - elapsed + READY_FOR_TRACKING_DELAY_MS + 100
      );

      const state = ctx.restorePositionAPI.getState();
      // Should have captured load time
      expect(state.loadTimePosition).not.toBeNull();
    });
  });

  it('sets ready flag immediately when past capture window', () => {
    // Create video with duration but without triggering canplay
    resetFixture();
    vi.useFakeTimers();

    const video = createMockVideo({
      currentTime: SEEK_MIN_DIFF_SECONDS + 100,
      duration: 3600,
      readyState: 2, // Not enough to auto-trigger
      src: 'blob:https://example.com/test',
    });
    document.body.appendChild(video);

    const getVideoElement = Video.createGetter({
      getPlayer: () => document.body,
      getVideo: () => video,
    });

    const api = RestorePosition.init({ getVideoElement });

    // Advance time past the capture window
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + 100);

    // Now dispatch canplay (past window)
    video.dispatchEvent(new Event('canplay'));

    // Should be ready immediately (no additional delay needed for past window)
    const augmentedVideo = getVideoElement() as StreamKeysVideoElement;
    expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);

    // Load time should NOT be captured (past window)
    const state = api.getState();
    expect(state.loadTimePosition).toBeNull();

    api.cleanup();
    video.remove();
  });

  it('captures load time only if position >= SEEK_MIN_DIFF_SECONDS', () => {
    ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

    // Simulate video at position less than minimum
    simulateVideoLoad(ctx.video, SEEK_MIN_DIFF_SECONDS - 1);
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    const state = ctx.restorePositionAPI.getState();
    // Should NOT capture because position is too short
    expect(state.loadTimePosition).toBeNull();

    // But should still be ready for tracking
    const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
    expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);
  });

  it('does not overwrite existing load time position', () => {
    ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

    // First load
    simulateVideoLoad(ctx.video, SEEK_MIN_DIFF_SECONDS + 100);
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    const state = ctx.restorePositionAPI.getState();
    const firstLoadTime = state.loadTimePosition;
    expect(firstLoadTime).not.toBeNull();

    // Trigger another canplay event with different time
    ctx.video._setCurrentTime(SEEK_MIN_DIFF_SECONDS + 200);
    ctx.video.dispatchEvent(new Event('canplay'));
    vi.advanceTimersByTime(100);

    // Load time should NOT change
    expect(state.loadTimePosition).toBe(firstLoadTime);
  });
});

// =============================================================================
// 5. Fallback Timeout
// =============================================================================

describe('fallback timeout', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = setupTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  it('sets ready flag after max wait time when no events fire', () => {
    // Create video that won't dispatch events automatically
    resetFixture();
    vi.useFakeTimers();

    const video = createMockVideo({
      currentTime: 100,
      duration: 3600,
      readyState: 2, // HAVE_CURRENT_DATA - not enough to trigger ready
      src: 'blob:https://example.com/test',
    });
    document.body.appendChild(video);

    const getVideoElement = Video.createGetter({
      getPlayer: () => document.body,
      getVideo: () => video,
    });

    const api = RestorePosition.init({ getVideoElement });

    // Don't dispatch any events
    // Wait for fallback timeout
    const maxWaitTime = LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 2000;
    vi.advanceTimersByTime(maxWaitTime + 100);

    const augmentedVideo = getVideoElement() as StreamKeysVideoElement;
    expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);

    api.cleanup();
    video.remove();
  });

  it('is cleared when canplay event triggers handleVideoReady', () => {
    ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

    // Trigger canplay immediately
    simulateVideoLoad(ctx.video, SEEK_MIN_DIFF_SECONDS + 100);

    // Wait for capture + ready delay
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
    expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);

    // Fast-forward past fallback timeout - should not cause any issues
    const maxWaitTime = LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 2000;
    vi.advanceTimersByTime(maxWaitTime);

    // Still ready (no double-logging or issues)
    expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);
  });

  it('does not set ready flag if video still not loaded at fallback time', () => {
    resetFixture();
    vi.useFakeTimers();

    // Video with invalid duration
    const video = createMockVideo({
      currentTime: 0,
      duration: 0, // Still not loaded
      readyState: 1,
      src: 'blob:https://example.com/test',
    });
    document.body.appendChild(video);

    const getVideoElement = Video.createGetter({
      getPlayer: () => document.body,
      getVideo: () => video,
    });

    const api = RestorePosition.init({ getVideoElement });

    // Wait for fallback timeout
    const maxWaitTime = LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 2000;
    vi.advanceTimersByTime(maxWaitTime + 100);

    const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

    // Should NOT be ready because video duration is still 0
    expect(augmentedVideo?._streamKeysReadyForTracking).toBe(false);

    api.cleanup();
    video.remove();
  });

  describe('max wait time calculation', () => {
    it.each([
      { loadDelay: 1000, readyDelay: 500, expected: 3500 },
      { loadDelay: 3000, readyDelay: 500, expected: 5500 }, // BBC timing
      { loadDelay: 500, readyDelay: 250, expected: 2750 }, // Faster timing
    ])(
      'is $expected ms with loadTimeCaptureDelay=$loadDelay, readyForTrackingDelay=$readyDelay',
      ({ loadDelay, readyDelay, expected }) => {
        resetFixture();
        vi.useFakeTimers();

        const video = createMockVideo({
          currentTime: 100,
          duration: 3600,
          readyState: 2,
          src: 'blob:https://example.com/test',
        });
        document.body.appendChild(video);

        const getVideoElement = Video.createGetter({
          getPlayer: () => document.body,
          getVideo: () => video,
        });

        const api = RestorePosition.init({
          getVideoElement,
          timing: {
            loadTimeCaptureDelay: loadDelay,
            readyForTrackingDelay: readyDelay,
          },
        });

        // Advance just before expected fallback time
        vi.advanceTimersByTime(expected - 100);

        let augmentedVideo = getVideoElement() as StreamKeysVideoElement;
        expect(augmentedVideo?._streamKeysReadyForTracking).toBe(false);

        // Advance past expected fallback time
        vi.advanceTimersByTime(200);

        augmentedVideo = getVideoElement() as StreamKeysVideoElement;
        expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);

        api.cleanup();
        video.remove();
      }
    );
  });
});

// =============================================================================
// 6. New Video Detection (Flag Reset)
// =============================================================================

describe('new video detection', () => {
  describe('cleanup on video change', () => {
    it('resets ready flags when video element changes', () => {
      resetFixture();
      vi.useFakeTimers();

      // Create first video
      const video1 = createMockVideo({
        currentTime: 100,
        duration: 3600,
        readyState: 4,
        src: 'blob:https://example.com/video1',
      });
      document.body.appendChild(video1);

      let currentVideo: HTMLVideoElement = video1;
      const getVideoElement = Video.createGetter({
        getPlayer: () => document.body,
        getVideo: () => currentVideo,
      });

      const api = RestorePosition.init({ getVideoElement });

      // Wait for ready
      simulateVideoLoad(video1, SEEK_MIN_DIFF_SECONDS + 100);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const augmentedVideo1 = getVideoElement() as StreamKeysVideoElement;
      expect(augmentedVideo1?._streamKeysReadyForTracking).toBe(true);

      // Create and switch to second video (HBO Max pattern)
      const video2 = createMockVideo({
        currentTime: 0,
        duration: 7200,
        readyState: 4,
        src: 'blob:https://example.com/video2',
      });
      document.body.appendChild(video2);
      currentVideo = video2;

      // Wait for detection interval
      vi.advanceTimersByTime(1100);

      // New video should start with flags reset
      const augmentedVideo2 = getVideoElement() as StreamKeysVideoElement;
      expect(augmentedVideo2?._streamKeysReadyForTracking).toBe(false);

      // State should be cleared
      const state = api.getState();
      expect(state.positionHistory.length).toBe(0);
      expect(state.loadTimePosition).toBeNull();

      api.cleanup();
      video1.remove();
      video2.remove();
    });
  });

  describe('flag reset', () => {
    it('resets _streamKeysReadyForTracking to false for new video', () => {
      let ctx = setupTestContext();

      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

      simulateVideoLoad(ctx.video, SEEK_MIN_DIFF_SECONDS + 100);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
      expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);

      // Change video source (Disney+ pattern)
      ctx.video.src = 'blob:https://example.com/new-video-' + Date.now();

      // Wait for detection
      vi.advanceTimersByTime(1100);

      // Flag should be reset
      expect(augmentedVideo?._streamKeysReadyForTracking).toBe(false);

      cleanupTestContext(ctx);
    });
  });

  describe('Disney+ pattern (same element, new source)', () => {
    it('clears position history when source changes', () => {
      let ctx = setupTestContext();

      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

      simulateVideoLoad(ctx.video, SEEK_MIN_DIFF_SECONDS + 100);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      // Save some positions
      const state = ctx.restorePositionAPI.getState();
      PositionHistory.save(state, state.loadTimePosition! + 50);
      expect(state.positionHistory.length).toBe(1);

      // Change source (Disney+ pattern)
      ctx.video.src = 'blob:https://example.com/new-' + Date.now();

      vi.advanceTimersByTime(1100);

      // History should be cleared
      expect(state.positionHistory.length).toBe(0);

      cleanupTestContext(ctx);
    });
  });
});

// =============================================================================
// 7. Timing Behavior (remainingDelay)
// =============================================================================

describe('capture timing relative to setup', () => {
  it.each([
    { eventAt: 0, captureAt: LOAD_TIME_CAPTURE_DELAY_MS, desc: 'event at setup' },
    { eventAt: 500, captureAt: LOAD_TIME_CAPTURE_DELAY_MS, desc: 'event mid-window' },
    { eventAt: 800, captureAt: LOAD_TIME_CAPTURE_DELAY_MS, desc: 'event late in window' },
  ])('$desc: canplay at $eventAt ms, capture at $captureAt ms', ({ eventAt, captureAt }) => {
    resetFixture();
    vi.useFakeTimers();

    const video = createMockVideo({
      currentTime: SEEK_MIN_DIFF_SECONDS + 100,
      duration: 3600,
      readyState: 4,
      src: 'blob:https://example.com/test',
    });
    document.body.appendChild(video);

    const getVideoElement = Video.createGetter({
      getPlayer: () => document.body,
      getVideo: () => video,
    });

    const api = RestorePosition.init({ getVideoElement });

    // Advance to event time
    vi.advanceTimersByTime(eventAt);

    // Dispatch canplay
    video.dispatchEvent(new Event('canplay'));

    // Advance to just before capture time
    const timeSinceEvent = eventAt;
    vi.advanceTimersByTime(captureAt - timeSinceEvent - 10);

    // Load time should NOT be captured yet
    let state = api.getState();
    expect(state.loadTimePosition).toBeNull();

    // Advance past capture time
    vi.advanceTimersByTime(20);

    // Now load time should be captured
    state = api.getState();
    expect(state.loadTimePosition).not.toBeNull();

    api.cleanup();
    video.remove();
  });
});

// =============================================================================
// 8. Disney+ Compatibility
// =============================================================================

describe('Disney+ compatibility', () => {
  it('uses _streamKeysGetDuration for video loaded check', () => {
    resetFixture();
    vi.useFakeTimers();

    // Native video.duration = 0 (buffer-relative, unreliable)
    // _streamKeysGetDuration = 3600 (from progress bar)
    const video = createMockVideo({
      currentTime: 100,
      duration: 0, // Unreliable native duration
      readyState: 4,
      src: 'blob:https://www.disneyplus.com/test',
    });
    document.body.appendChild(video);

    const getVideoElement = Video.createGetter({
      getPlayer: () => document.body,
      getVideo: () => video,
      getDuration: () => 3600, // Augmented duration from progress bar
    });

    const api = RestorePosition.init({ getVideoElement });

    // Dispatch canplay
    video.dispatchEvent(new Event('canplay'));
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

    // Should be ready because augmented duration is valid
    expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);

    api.cleanup();
    video.remove();
  });

  it('falls back to video.duration when _streamKeysGetDuration is not defined', () => {
    resetFixture();
    vi.useFakeTimers();

    const video = createMockVideo({
      currentTime: 100,
      duration: 3600, // Valid native duration
      readyState: 4,
      src: 'blob:https://example.com/test',
    });
    document.body.appendChild(video);

    // No getDuration provided - should use native duration
    const getVideoElement = Video.createGetter({
      getPlayer: () => document.body,
      getVideo: () => video,
    });

    const api = RestorePosition.init({ getVideoElement });

    video.dispatchEvent(new Event('canplay'));
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    const augmentedVideo = getVideoElement() as StreamKeysVideoElement;
    expect(augmentedVideo?._streamKeysReadyForTracking).toBe(true);

    api.cleanup();
    video.remove();
  });
});

// =============================================================================
// 9. Stable Time Tracking Isolation
// =============================================================================

describe('stable time tracking isolation', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = setupTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  it('handleSeeked does not modify _streamKeysStableTime', () => {
    ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

    // Set up initial stable time
    const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
    augmentedVideo._streamKeysStableTime = 100;

    // Trigger seeked event
    ctx.video._setCurrentTime(200);
    ctx.video.dispatchEvent(new Event('seeked'));

    // Stable time should NOT be changed by handleSeeked
    // (It's updated by the RAF loop with delay)
    expect(augmentedVideo._streamKeysStableTime).toBe(100);
  });

  it('handleVideoReady does not directly modify _streamKeysStableTime', () => {
    // This test verifies that the handleVideoReady function itself does NOT
    // modify _streamKeysStableTime. The stable time is only updated by the
    // RAF loop with delayed setTimeout capture.
    //
    // Note: The initial setup in setupVideoTracking DOES initialize stable time.
    // And the RAF loop schedules updates with 500ms delay. But handleVideoReady
    // should not touch it at all.

    resetFixture();
    vi.useFakeTimers();

    const video = createMockVideo({
      currentTime: 100,
      duration: 3600,
      readyState: 2, // Won't auto-trigger
      src: 'blob:https://example.com/test',
    });
    document.body.appendChild(video);

    const getVideoElement = Video.createGetter({
      getPlayer: () => document.body,
      getVideo: () => video,
    });

    const api = RestorePosition.init({ getVideoElement });

    // Get augmented video and record its stable time
    const augmentedVideo = getVideoElement() as StreamKeysVideoElement;
    const stableTimeBeforeCanplay = augmentedVideo._streamKeysStableTime;

    // Advance past capture window so handleVideoReady sets ready immediately
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + 100);

    // Trigger handleVideoReady via canplay (this should set ready immediately)
    video.dispatchEvent(new Event('canplay'));

    // Verify we're ready (handleVideoReady was called)
    expect(augmentedVideo._streamKeysReadyForTracking).toBe(true);

    // Stable time should be the same as before canplay
    // (handleVideoReady doesn't touch it - only RAF loop does)
    expect(augmentedVideo._streamKeysStableTime).toBe(stableTimeBeforeCanplay);

    api.cleanup();
    video.remove();
  });
});
