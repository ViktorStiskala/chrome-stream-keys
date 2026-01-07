/**
 * Content ID tracking tests for Restore Position feature.
 *
 * Tests the getContentId config option that allows services to provide stable
 * content identifiers instead of relying on video source tracking.
 *
 * Background (BBC iPlayer regression):
 * BBC uses MediaSource Extensions (MSE/DASH.js) for adaptive streaming, which
 * causes video.currentSrc to change frequently with dynamic blob URLs. This was
 * triggering false "new video" detection, constantly clearing position history.
 *
 * Solution: Services can provide a getContentId function that returns a stable
 * identifier (e.g., episode ID from URL). When provided, this is used instead
 * of source tracking to detect content changes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupTestContext,
  cleanupTestContext,
  simulateVideoLoad,
  PositionHistory,
  RestorePosition,
  SEEK_MIN_DIFF_SECONDS,
  LOAD_TIME_CAPTURE_DELAY_MS,
  READY_FOR_TRACKING_DELAY_MS,
  type TestContext,
  type StreamKeysVideoElement,
} from './test-utils';
import { BBCHandler } from '@/services/bbc';

// Mock Settings module
vi.mock('@/core/settings', () => ({
  Settings: {
    isPositionHistoryEnabled: vi.fn(() => true),
    getSubtitlePreferences: vi.fn(() => ['English']),
    isMediaKeysCaptureEnabled: vi.fn(() => false),
    isCustomSeekEnabled: vi.fn(() => false),
    getSeekTime: vi.fn(() => 10),
    get: vi.fn(() => ({
      captureMediaKeys: false,
      customSeekEnabled: false,
      seekTime: 10,
      positionHistoryEnabled: true,
      subtitleLanguages: ['English'],
    })),
  },
}));

// Mock Guard to prevent auto-initialization
vi.mock('@/core/guard', () => ({
  Guard: {
    create: vi.fn(() => () => true), // Always skip init
  },
}));

describe('Content ID tracking', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = setupTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  describe('with getContentId provided', () => {
    /**
     * Regression test: BBC blob URL changes should NOT clear position history.
     *
     * Before the fix, every blob URL change triggered "New video detected, position
     * history cleared" because the source tracking logic saw different currentSrc values.
     */
    it('does NOT clear history when video source changes but content ID stays the same', async () => {
      // Track content ID via closure (simulating URL-based ID)
      let contentId = 'episode-123';
      const getContentId = () => contentId;

      ctx.restorePositionAPI = RestorePosition.init({
        getVideoElement: ctx.getVideoElement,
        getContentId,
      });

      // Simulate video loading with resume position
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, resumePosition);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const state = ctx.restorePositionAPI.getState();
      expect(state.loadTimePosition).not.toBeNull();

      // Save some positions
      const loadTime = state.loadTimePosition!;
      PositionHistory.save(state, loadTime + 50);
      PositionHistory.save(state, loadTime + 100);
      expect(state.positionHistory.length).toBe(2);

      // Simulate MSE changing the blob URL (like BBC's DASH.js does)
      // This would have cleared history before the fix
      ctx.video.src = 'blob:https://bbc.co.uk/new-segment-' + Date.now();

      // Wait for setup interval to check video
      vi.advanceTimersByTime(1100);

      // History should NOT be cleared because content ID is the same
      expect(state.positionHistory.length).toBe(2);
      expect(state.loadTimePosition).not.toBeNull();
    });

    /**
     * Test: History IS cleared when content ID changes (e.g., SPA navigation to new episode).
     */
    it('clears history when content ID changes (new episode)', async () => {
      // Track content ID via closure (simulating URL-based ID)
      let contentId: string | null = 'episode-123';
      const getContentId = () => contentId;

      ctx.restorePositionAPI = RestorePosition.init({
        getVideoElement: ctx.getVideoElement,
        getContentId,
      });

      // Simulate video loading with resume position
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, resumePosition);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const state = ctx.restorePositionAPI.getState();
      expect(state.loadTimePosition).not.toBeNull();

      // Save some positions
      const loadTime = state.loadTimePosition!;
      PositionHistory.save(state, loadTime + 50);
      PositionHistory.save(state, loadTime + 100);
      expect(state.positionHistory.length).toBe(2);

      // Simulate navigating to a new episode (different content ID)
      contentId = 'episode-456';

      // Wait for setup interval to detect the change
      vi.advanceTimersByTime(1100);

      // History should be cleared for the new episode
      expect(state.positionHistory.length).toBe(0);
    });

    /**
     * Test: Content ID null to non-null transition doesn't clear history.
     * This can happen when the page loads and URL parsing initially fails.
     */
    it('does NOT clear history on initial content ID assignment (null → value)', async () => {
      // Start with null content ID (page still loading)
      let contentId: string | null = null;
      const getContentId = () => contentId;

      ctx.restorePositionAPI = RestorePosition.init({
        getVideoElement: ctx.getVideoElement,
        getContentId,
      });

      // Set content ID before video loads (simulating URL becoming available)
      contentId = 'episode-123';

      // Simulate video loading
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, resumePosition);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const state = ctx.restorePositionAPI.getState();

      // Should have captured load time (not cleared)
      expect(state.loadTimePosition).not.toBeNull();
    });
  });

  describe('without getContentId (fallback behavior)', () => {
    /**
     * Test: Source tracking still works when getContentId is not provided.
     * This preserves existing behavior for services like Disney+ that reuse
     * video elements with different blob URLs for different content.
     */
    it('falls back to source tracking when getContentId not provided', async () => {
      // No getContentId - should use source tracking
      ctx.restorePositionAPI = RestorePosition.init({
        getVideoElement: ctx.getVideoElement,
      });

      // Simulate video loading
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, resumePosition);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const state = ctx.restorePositionAPI.getState();
      expect(state.loadTimePosition).not.toBeNull();

      // Save some positions
      const loadTime = state.loadTimePosition!;
      PositionHistory.save(state, loadTime + 50);
      expect(state.positionHistory.length).toBe(1);

      // Change video source (like Disney+ navigating to new video)
      ctx.video.src = 'blob:https://disneyplus.com/new-video-' + Date.now();
      ctx.video.dispatchEvent(new Event('loadedmetadata'));

      // Wait for setup interval
      vi.advanceTimersByTime(1100);

      // History should be cleared (source changed)
      expect(state.positionHistory.length).toBe(0);
    });

    /**
     * Test: Element change still clears history (HBO Max pattern).
     */
    it('clears history when video element changes (even without getContentId)', async () => {
      // Create mutable video reference
      let currentVideo: StreamKeysVideoElement = ctx.video as unknown as StreamKeysVideoElement;

      const getVideoElement = () => currentVideo;

      ctx.restorePositionAPI = RestorePosition.init({
        getVideoElement,
      });

      // Simulate video loading
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, resumePosition);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const state = ctx.restorePositionAPI.getState();

      // Save a position
      const loadTime = state.loadTimePosition!;
      PositionHistory.save(state, loadTime + 50);
      expect(state.positionHistory.length).toBe(1);

      // Create new video element (HBO Max pattern)
      const newVideo = document.createElement('video') as unknown as StreamKeysVideoElement;
      newVideo.src = 'blob:https://play.hbomax.com/new-video';
      Object.defineProperty(newVideo, 'duration', { value: 3600, writable: true });
      Object.defineProperty(newVideo, 'readyState', { value: 4, writable: true });
      newVideo.currentTime = 60;
      document.body.appendChild(newVideo);
      currentVideo = newVideo;

      // Wait for setup interval
      vi.advanceTimersByTime(1100);

      // History should be cleared (element changed)
      expect(state.positionHistory.length).toBe(0);

      // Cleanup
      newVideo.remove();
    });
  });

  describe('BBC getContentId implementation', () => {
    // Store original pathname getter
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

    /**
     * Helper to mock window.location.pathname for testing URL parsing.
     */
    function mockPathname(pathname: string) {
      Object.defineProperty(window, 'location', {
        value: { pathname },
        writable: true,
        configurable: true,
      });
    }

    afterEach(() => {
      // Restore original location
      if (originalDescriptor) {
        Object.defineProperty(window, 'location', originalDescriptor);
      }
    });

    it('extracts episode ID from BBC iPlayer URL', () => {
      mockPathname('/iplayer/episode/m002nzps/the-traitors-series-4-episode-1');

      const contentId = BBCHandler._test.getContentId();
      expect(contentId).toBe('m002nzps');
    });

    it('extracts episode ID from URL without slug', () => {
      mockPathname('/iplayer/episode/b0000001');

      const contentId = BBCHandler._test.getContentId();
      expect(contentId).toBe('b0000001');
    });

    it('returns null for non-episode URLs', () => {
      mockPathname('/iplayer/categories/comedy');

      const contentId = BBCHandler._test.getContentId();
      expect(contentId).toBeNull();
    });

    it('returns null for homepage', () => {
      mockPathname('/iplayer');

      const contentId = BBCHandler._test.getContentId();
      expect(contentId).toBeNull();
    });

    it('handles URL with additional path segments', () => {
      mockPathname('/iplayer/episode/m002nzps/the-traitors/series-4/episode-1');

      const contentId = BBCHandler._test.getContentId();
      expect(contentId).toBe('m002nzps');
    });
  });

  describe('interaction with trailer handling', () => {
    /**
     * Test: Content ID stays the same during trailer and main content.
     * Trailer handling is done by getVideo() returning null, not by content ID.
     */
    it('returns same content ID during trailer and main content (same URL)', async () => {
      // The URL doesn't change between trailer and main content
      const contentId = 'episode-123';
      const getContentId = () => contentId;

      // Track whether we're in "trailer mode"
      let isTrailer = true;
      const getVideo = () => (isTrailer ? null : ctx.video);

      ctx.restorePositionAPI = RestorePosition.init({
        getVideoElement: () => {
          const video = getVideo();
          if (!video) return null;
          // Return augmented video element
          return ctx.getVideoElement();
        },
        getContentId,
      });

      // During trailer: getVideo returns null, no tracking happens
      vi.advanceTimersByTime(1100);

      const state = ctx.restorePositionAPI.getState();
      // No load time captured during trailer (no video element)
      expect(state.loadTimePosition).toBeNull();

      // Trailer ends, main content starts
      isTrailer = false;

      // Simulate video loading
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, resumePosition);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      // Now we should have load time (same content ID, but video now available)
      expect(state.loadTimePosition).not.toBeNull();
      expect(state.positionHistory.length).toBe(0); // No false "new video" detection
    });
  });
});
