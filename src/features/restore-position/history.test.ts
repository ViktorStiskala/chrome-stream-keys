import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PositionHistory,
  SEEK_MAX_HISTORY,
  SEEK_MIN_DIFF_SECONDS,
  SEEK_DEBOUNCE_MS,
  type PositionHistoryState,
} from './history';

// Mock Settings module
vi.mock('@/core/settings', () => ({
  Settings: {
    isPositionHistoryEnabled: vi.fn(() => true),
  },
}));

describe('PositionHistory', () => {
  let state: PositionHistoryState;

  beforeEach(() => {
    state = PositionHistory.createState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createState', () => {
    it('creates initial state with empty history', () => {
      expect(state.positionHistory).toEqual([]);
      expect(state.loadTimePosition).toBeNull();
      expect(state.lastSeekTime).toBe(0);
      expect(state.isKeyboardOrButtonSeek).toBe(false);
    });
  });

  describe('save', () => {
    describe('position threshold rules', () => {
      it.each([
        {
          position: SEEK_MIN_DIFF_SECONDS - 5,
          shouldSave: false,
          description: 'does NOT save position below threshold',
        },
        {
          position: SEEK_MIN_DIFF_SECONDS - 1,
          shouldSave: false,
          description: 'does NOT save position just below threshold',
        },
        {
          position: SEEK_MIN_DIFF_SECONDS,
          shouldSave: true,
          description: 'saves position at exactly threshold',
        },
        {
          position: SEEK_MIN_DIFF_SECONDS + 10,
          shouldSave: true,
          description: 'saves position above threshold',
        },
      ])('$description (position: $position)', ({ position, shouldSave }) => {
        PositionHistory.save(state, position);

        if (shouldSave) {
          expect(state.positionHistory).toHaveLength(1);
          expect(state.positionHistory[0].time).toBe(position);
        } else {
          expect(state.positionHistory).toHaveLength(0);
        }
      });
    });

    describe('load time position rules', () => {
      it('does NOT save position too close to load time position', () => {
        state.loadTimePosition = 100;

        // Position within SEEK_MIN_DIFF_SECONDS of load time
        const tooClosePosition = 100 + SEEK_MIN_DIFF_SECONDS - 1;
        PositionHistory.save(state, tooClosePosition);

        expect(state.positionHistory).toHaveLength(0);
      });

      it('saves position sufficiently far from load time position', () => {
        state.loadTimePosition = 100;

        // Position outside SEEK_MIN_DIFF_SECONDS of load time
        const farEnoughPosition = 100 + SEEK_MIN_DIFF_SECONDS + 1;
        PositionHistory.save(state, farEnoughPosition);

        expect(state.positionHistory).toHaveLength(1);
        expect(state.positionHistory[0].time).toBe(farEnoughPosition);
      });
    });

    describe('existing position proximity rules', () => {
      it('does NOT save position too close to existing entry', () => {
        // Add an existing entry
        const existingPosition = 100;
        PositionHistory.save(state, existingPosition);
        expect(state.positionHistory).toHaveLength(1);

        // Try to add position within SEEK_MIN_DIFF_SECONDS
        const tooClosePosition = existingPosition + SEEK_MIN_DIFF_SECONDS - 1;
        PositionHistory.save(state, tooClosePosition);

        expect(state.positionHistory).toHaveLength(1); // Still only 1 entry
      });

      it('saves position sufficiently far from existing entry', () => {
        // Add an existing entry
        const existingPosition = 100;
        PositionHistory.save(state, existingPosition);
        expect(state.positionHistory).toHaveLength(1);

        // Add position outside SEEK_MIN_DIFF_SECONDS
        const farEnoughPosition = existingPosition + SEEK_MIN_DIFF_SECONDS + 1;
        PositionHistory.save(state, farEnoughPosition);

        expect(state.positionHistory).toHaveLength(2);
      });
    });

    describe('max history enforcement (FIFO)', () => {
      it(`removes oldest entry when adding more than ${SEEK_MAX_HISTORY} entries`, () => {
        // Add SEEK_MAX_HISTORY + 1 entries, spaced far apart
        const baseTime = 100;
        const spacing = SEEK_MIN_DIFF_SECONDS + 10;

        for (let i = 0; i <= SEEK_MAX_HISTORY; i++) {
          PositionHistory.save(state, baseTime + i * spacing);
        }

        // Should have exactly SEEK_MAX_HISTORY entries
        expect(state.positionHistory).toHaveLength(SEEK_MAX_HISTORY);

        // First entry should have been removed (FIFO)
        const firstRemainingTime = state.positionHistory[0].time;
        expect(firstRemainingTime).toBe(baseTime + spacing); // Second entry is now first
      });
    });
  });

  describe('record (debouncing)', () => {
    it('saves position on first call in a sequence', () => {
      const position = 100;
      PositionHistory.record(state, position);

      expect(state.positionHistory).toHaveLength(1);
      expect(state.positionHistory[0].time).toBe(position);
    });

    it('does NOT save second position within debounce window', () => {
      const position1 = 100;
      const position2 = 200;

      // First seek
      PositionHistory.record(state, position1);
      expect(state.positionHistory).toHaveLength(1);

      // Advance time but stay within debounce window
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS - 1000);

      // Second seek within debounce window
      PositionHistory.record(state, position2);

      // Should still have only the first position
      expect(state.positionHistory).toHaveLength(1);
      expect(state.positionHistory[0].time).toBe(position1);
    });

    it('saves second position after debounce window expires', () => {
      const position1 = 100;
      const position2 = 200;

      // First seek
      PositionHistory.record(state, position1);
      expect(state.positionHistory).toHaveLength(1);

      // Advance time past debounce window
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);

      // Second seek after debounce window
      PositionHistory.record(state, position2);

      // Should have both positions
      expect(state.positionHistory).toHaveLength(2);
      expect(state.positionHistory[0].time).toBe(position1);
      expect(state.positionHistory[1].time).toBe(position2);
    });
  });

  describe('getPositions', () => {
    it('returns empty array when no positions', () => {
      const positions = PositionHistory.getPositions(state);
      expect(positions).toHaveLength(0);
    });

    it('includes load time position first when available', () => {
      state.loadTimePosition = 120;
      PositionHistory.save(state, 200);

      const positions = PositionHistory.getPositions(state);

      expect(positions).toHaveLength(2);
      expect(positions[0].isLoadTime).toBe(true);
      expect(positions[0].time).toBe(120);
      expect(positions[1].isLoadTime).toBe(false);
      expect(positions[1].time).toBe(200);
    });

    it('does NOT include load time position below threshold', () => {
      state.loadTimePosition = SEEK_MIN_DIFF_SECONDS - 1;

      const positions = PositionHistory.getPositions(state);
      expect(positions).toHaveLength(0);
    });

    it('returns history positions in reverse order (most recent first)', () => {
      const times = [100, 150, 200];
      times.forEach((t) => PositionHistory.save(state, t));

      const positions = PositionHistory.getPositions(state);

      // History positions should be reversed
      expect(positions[0].time).toBe(200);
      expect(positions[1].time).toBe(150);
      expect(positions[2].time).toBe(100);
    });
  });
});
