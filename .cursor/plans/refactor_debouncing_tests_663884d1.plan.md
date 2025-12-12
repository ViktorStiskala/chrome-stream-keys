---
name: Refactor Debouncing Tests
overview: Complete rewrite using real DOM fixtures, @testing-library/user-event, and proper Shadow DOM attachment for Disney+. Tests distinguish debouncing from SEEK_MIN_DIFF_SECONDS rejection.
todos:
  - id: add-deps
    content: Add @testing-library/user-event and @testing-library/dom as dev dependencies
    status: pending
  - id: enhance-vitest-setup
    content: Add attachDisneyShadowDOM helper and enhance MockVideoElement in vitest.setup.ts
    status: pending
  - id: create-test-helpers
    content: Create service setup helpers and user action helpers in test-utils.ts
    status: pending
  - id: refactor-tests
    content: Rewrite debouncing.test.ts with parameterized tests using real fixtures
    status: pending
  - id: create-cursor-rule
    content: Create Cursor rule at features/restore-position/.cursor/rules/debouncing-test/RULE.md
    status: pending
---

# Refactor Debouncing Tests - Using Real DOM Fixtures

## Problem

Current tests have several issues:

1. Directly manipulate internal state (`setKeyboardSeek()`, `recordBeforeSeek()`, `_streamKeysStableTime`)
2. Don't distinguish between **debouncing** and **SEEK_MIN_DIFF_SECONDS rejection**
3. Use hardcoded selectors instead of real service configs
4. Don't use real DOM fixtures properly

## Key Insight: Real Fixtures

### HBO Max Fixture (`resources/dom/hbomax.html`)

- **Buttons already exist** with `data-testid` attributes
- No Shadow DOM needed - standard DOM access
- `button[data-testid="player-ux-skip-back-button"]` ✓
- `button[data-testid="player-ux-skip-forward-button"]` ✓

### Disney+ Fixture (`resources/dom/disney.html`)

- **Empty custom elements** that need Shadow DOM attached:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `<quick-rewind class="quick-rewind"></quick-rewind>`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `<quick-fast-forward class="quick-fast-forward"></quick-fast-forward>`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `<progress-bar></progress-bar>`
- Must attach Shadow DOM with correct internal structure

---

## Critical Test Distinctions

**Always import constants - never hardcode values!**

```typescript
import {
  SEEK_MIN_DIFF_SECONDS,  // Position threshold (currently 15s)
  SEEK_DEBOUNCE_MS,       // Time window (currently 5000ms)
  STABLE_TIME_DELAY_MS,   // Stable time delay (currently 500ms)
} from './history';
```

### SEEK_MIN_DIFF_SECONDS - NOT what we're testing

```typescript
position1 = 100;  // saved
position2 = 105;  // rejected (diff < SEEK_MIN_DIFF_SECONDS) - NOT debouncing!
```

### SEEK_DEBOUNCE_MS - What we ARE testing

```typescript
// Position 200s → SAVED (first press)
// 3s of rapid presses, position now 290s (diff >> SEEK_MIN_DIFF_SECONDS, valid!)
// Still DEBOUNCED because only 3s passed (< SEEK_DEBOUNCE_MS window)
```

### Test Requirements

- Start at `SEEK_MIN_DIFF_SECONDS * 10`+ (well above threshold)
- Use `SEEK_MIN_DIFF_SECONDS * 5`+ position jumps between saves
- Time advances < `SEEK_DEBOUNCE_MS` for debounce testing, > for expiration

---

## Implementation

### 1. Add Dependencies

```bash
npm install -D @testing-library/user-event @testing-library/dom
```

### 2. Enhance vitest.setup.ts

**Attach Shadow DOM to Disney+ elements (from fixture):**

```typescript
/**
 * Attach Shadow DOM to Disney+ custom elements from the fixture.
 * The fixture has empty <quick-rewind>, <quick-fast-forward>, <progress-bar> elements.
 * Real Disney+ has shadowRoot with info-tooltip > button inside.
 */
export function attachDisneyShadowDOM(): {
  backwardButton: HTMLButtonElement;
  forwardButton: HTMLButtonElement;
  setProgressBarTime: (seconds: number) => void;
} {
  // Attach Shadow DOM to quick-rewind (already in fixture)
  const quickRewind = document.querySelector('quick-rewind');
  if (quickRewind && !quickRewind.shadowRoot) {
    const shadow = quickRewind.attachShadow({ mode: 'open' });
    const infoTooltip = document.createElement('info-tooltip');
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    infoTooltip.appendChild(button);
    shadow.appendChild(infoTooltip);
  }
  
  // Attach Shadow DOM to quick-fast-forward (already in fixture)
  const quickFastForward = document.querySelector('quick-fast-forward');
  if (quickFastForward && !quickFastForward.shadowRoot) {
    const shadow = quickFastForward.attachShadow({ mode: 'open' });
    const infoTooltip = document.createElement('info-tooltip');
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    infoTooltip.appendChild(button);
    shadow.appendChild(infoTooltip);
  }
  
  // Attach Shadow DOM to progress-bar (already in fixture)
  const progressBar = document.querySelector('progress-bar');
  let thumb: HTMLDivElement | null = null;
  if (progressBar && !progressBar.shadowRoot) {
    const shadow = progressBar.attachShadow({ mode: 'open' });
    thumb = document.createElement('div');
    thumb.className = 'progress-bar__thumb';
    // Initial value set via setProgressBarTime() in test setup
    thumb.setAttribute('aria-valuenow', '0');
    thumb.setAttribute('aria-valuemax', '7200');
    shadow.appendChild(thumb);
  } else {
    thumb = progressBar?.shadowRoot?.querySelector('.progress-bar__thumb') ?? null;
  }
  
  return {
    backwardButton: quickRewind?.shadowRoot?.querySelector('info-tooltip button') as HTMLButtonElement,
    forwardButton: quickFastForward?.shadowRoot?.querySelector('info-tooltip button') as HTMLButtonElement,
    setProgressBarTime: (seconds: number) => {
      thumb?.setAttribute('aria-valuenow', String(seconds));
    },
  };
}
```

**Enhance MockVideoElement:**

```typescript
export interface MockVideoElement extends HTMLVideoElement {
  _setCurrentTime: (time: number) => void;
  _setSeeking: (seeking: boolean) => void;
  _setDuration: (duration: number) => void;
  /** Simulate playback - updates currentTime and fires timeupdate */
  _simulatePlayback: (toTime: number) => void;
}

// Add to createMockVideo():
video._simulatePlayback = (toTime: number) => {
  _currentTime = toTime;
  video.dispatchEvent(new Event('timeupdate'));
};
```

### 3. Service Setup Helpers (test-utils.ts)

```typescript
import { Handler } from '@/handlers';
import { loadFixture, resetFixture, createMockVideo, attachDisneyShadowDOM } from '@test';

export interface ServiceTestContext {
  name: string;
  video: MockVideoElement;
  player: HTMLElement;
  handler: { cleanup: () => void };
  getSeekButtons: () => { backward: HTMLElement | null; forward: HTMLElement | null };
  /** Disney+ only: update progress bar time */
  setProgressBarTime?: (seconds: number) => void;
  supportsDirectSeek: boolean;
}

/**
 * Set up HBO Max test using real fixture.
 * Fixture already has buttons with data-testid attributes.
 */
export function setupHBOMaxTest(): ServiceTestContext {
  loadFixture('hbomax');
  
  const player = document.querySelector<HTMLElement>('[data-testid="playerContainer"]')!;
  
  // Create mock video to replace fixture's video
  // Start well above SEEK_MIN_DIFF_SECONDS to avoid min diff rejection
  const video = createMockVideo({
    currentTime: SEEK_MIN_DIFF_SECONDS * 10,
    duration: 7200,
    readyState: 4,
    src: 'blob:https://play.hbomax.com/test',
  });
  
  // Replace fixture's video with mock
  const existingVideo = player.querySelector('video');
  existingVideo?.replaceWith(video);
  
  // Real HBO Max getSeekButtons pattern (from hbomax.ts)
  const getSeekButtons = () => ({
    backward: document.querySelector<HTMLElement>('button[data-testid="player-ux-skip-back-button"]'),
    forward: document.querySelector<HTMLElement>('button[data-testid="player-ux-skip-forward-button"]'),
  });
  
  const handler = Handler.create({
    name: 'HBO Max',
    getPlayer: () => player,
    getVideo: () => video,
    getSeekButtons,
    supportsDirectSeek: true, // HBO uses video.currentTime directly
    getButton: (code: string) => {
      if (code === 'ArrowLeft') return getSeekButtons().backward;
      if (code === 'ArrowRight') return getSeekButtons().forward;
      return null;
    },
  });
  
  return {
    name: 'HBO Max',
    video,
    player,
    handler,
    getSeekButtons,
    supportsDirectSeek: true,
  };
}

/**
 * Set up Disney+ test using real fixture.
 * Fixture has empty custom elements - attach Shadow DOM.
 */
export function setupDisneyPlusTest(): ServiceTestContext {
  loadFixture('disney');
  
  // Attach Shadow DOM to fixture's custom elements
  const { backwardButton, forwardButton, setProgressBarTime } = attachDisneyShadowDOM();
  
  const player = document.querySelector<HTMLElement>('disney-web-player')!;
  
  // Create mock video to replace fixture's video
  const video = createMockVideo({
    currentTime: 0, // Disney+ video.currentTime is unreliable (buffer-relative)
    duration: 7200,
    readyState: 4,
    src: 'blob:https://www.disneyplus.com/test',
  });
  video.classList.add('hive-video');
  
  // Replace fixture's video with mock
  const existingVideo = player.querySelector('video.hive-video') || player.querySelector('video');
  existingVideo?.replaceWith(video);
  
  // Real Disney+ getSeekButtons pattern (from disney.ts)
  // Uses Shadow DOM: element.shadowRoot.querySelector('info-tooltip button')
  const getSeekButtons = () => ({
    backward: document.querySelector('quick-rewind')?.shadowRoot?.querySelector<HTMLElement>('info-tooltip button') ?? null,
    forward: document.querySelector('quick-fast-forward')?.shadowRoot?.querySelector<HTMLElement>('info-tooltip button') ?? null,
  });
  
  // Real Disney+ getPlaybackTime pattern (from disney.ts)
  // Reads from progress bar Shadow DOM aria-valuenow
  const getPlaybackTime = () => {
    const thumb = document.querySelector('progress-bar')?.shadowRoot?.querySelector('.progress-bar__thumb');
    const value = thumb?.getAttribute('aria-valuenow');
    return value ? parseInt(value, 10) : null;
  };
  
  const handler = Handler.create({
    name: 'Disney+',
    getPlayer: () => player,
    getVideo: () => video,
    getPlaybackTime,
    getDuration: () => 7200,
    getSeekButtons,
    supportsDirectSeek: false, // Disney+ uses button clicks, not video.currentTime
    getButton: (code: string) => {
      if (code === 'ArrowLeft') return getSeekButtons().backward;
      if (code === 'ArrowRight') return getSeekButtons().forward;
      return null;
    },
  });
  
  // Set initial progress bar time (well above SEEK_MIN_DIFF_SECONDS)
  setProgressBarTime(SEEK_MIN_DIFF_SECONDS * 10);
  
  return {
    name: 'Disney+',
    video,
    player,
    handler,
    getSeekButtons,
    setProgressBarTime,
    supportsDirectSeek: false,
  };
}
```

### 4. User Action Helpers (test-utils.ts)

```typescript
import userEvent from '@testing-library/user-event';

export function createUserEventInstance() {
  return userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
  });
}

/** Press arrow key - fires realistic keydown/keypress/keyup sequence */
export async function pressArrowKey(
  user: ReturnType<typeof userEvent.setup>,
  direction: 'left' | 'right'
) {
  const key = direction === 'left' ? '{ArrowLeft}' : '{ArrowRight}';
  await user.keyboard(key);
}

/** Click skip button using pointerdown (matches real handler interception) */
export async function clickSkipButton(
  user: ReturnType<typeof userEvent.setup>,
  direction: 'backward' | 'forward',
  ctx: ServiceTestContext
) {
  const buttons = ctx.getSeekButtons();
  const button = direction === 'backward' ? buttons.backward : buttons.forward;
  
  if (button) {
    // Handler intercepts pointerdown, not click
    await user.pointer({ keys: '[MouseLeft>]', target: button });
    await user.pointer({ keys: '[/MouseLeft]', target: button });
  }
}

/** Simulate timeline click (direct seeking, NOT through buttons) */
export function clickTimeline(video: MockVideoElement, toTime: number) {
  video._setSeeking(true);
  video.dispatchEvent(new Event('seeking'));
  video._setCurrentTime(toTime);
  video._setSeeking(false);
  video.dispatchEvent(new Event('seeked'));
}

/** Advance playback and let RAF loop update stable time */
export function advancePlayback(
  ctx: ServiceTestContext,
  toTime: number,
  advanceMs: number = STABLE_TIME_DELAY_MS + 100
) {
  ctx.video._simulatePlayback(toTime);
  ctx.setProgressBarTime?.(toTime); // Disney+ needs progress bar update
  vi.advanceTimersByTime(advanceMs);
}
```

### 5. Test Structure (debouncing.test.ts)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import {
  setupHBOMaxTest,
  setupDisneyPlusTest,
  advancePlayback,
  clickTimeline,
  pressArrowKey,
  clickSkipButton,
  resetFixture,
  type ServiceTestContext,
} from './test-utils';
import {
  SEEK_MIN_DIFF_SECONDS,
  SEEK_DEBOUNCE_MS,
  STABLE_TIME_DELAY_MS,
  LOAD_TIME_CAPTURE_DELAY_MS,
  READY_FOR_TRACKING_DELAY_MS,
} from './history';

const services = [
  { name: 'HBO Max', setup: setupHBOMaxTest },
  { name: 'Disney+', setup: setupDisneyPlusTest },
] as const;

describe.each(services)('Position History Debouncing - $name', ({ setup }) => {
  let ctx: ServiceTestContext;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'setInterval', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    ctx = setup();
    
    // Wait for tracking to be ready
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);
  });

  afterEach(() => {
    ctx.handler.cleanup();
    vi.useRealTimers();
    resetFixture();
  });

  describe('timeline clicks (NEVER debounced)', () => {
    it('saves every timeline click even within debounce window', () => {
      // Start well above SEEK_MIN_DIFF_SECONDS
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);
      
      // First timeline click (large jump to avoid min diff rejection)
      const dest1 = startPos + SEEK_MIN_DIFF_SECONDS * 5;
      clickTimeline(ctx.video, dest1);
      expect(getPositionHistory()).toHaveLength(1);
      expect(getPositionHistory()[0].time).toBe(startPos);
      
      // Only 1 second later (within SEEK_DEBOUNCE_MS!)
      advancePlayback(ctx, dest1);
      vi.advanceTimersByTime(1000);
      
      // Second timeline click - saves dest1 (NOT debounced)
      const dest2 = dest1 + SEEK_MIN_DIFF_SECONDS * 5;
      clickTimeline(ctx.video, dest2);
      expect(getPositionHistory()).toHaveLength(2);
      expect(getPositionHistory()[1].time).toBe(dest1);
    });
  });

  describe('keyboard seeks (debounced)', () => {
    it('debounces rapid presses even when position diff exceeds SEEK_MIN_DIFF_SECONDS', async () => {
      /**
       * This test proves we're testing DEBOUNCING, not SEEK_MIN_DIFF_SECONDS.
       * 
       * Scenario: User holds arrow key for 3 seconds
       * - Position changes by SEEK_MIN_DIFF_SECONDS * 6 (valid for saving!)
       * - But only 3s passed (< SEEK_DEBOUNCE_MS window)
       * - Result: Still only 1 save (debounced!)
       */
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);
      
      // First key press - saves position
      await pressArrowKey(user, 'right');
      expect(getPositionHistory()).toHaveLength(1);
      expect(getPositionHistory()[0].time).toBe(startPos);
      
      // Hold key for 3 seconds (30 presses at 100ms intervals)
      // Position advances by SEEK_MIN_DIFF_SECONDS * 6 total
      const positionIncrement = (SEEK_MIN_DIFF_SECONDS * 6) / 30;
      for (let i = 0; i < 30; i++) {
        vi.advanceTimersByTime(100);
        const newPos = startPos + (i + 1) * positionIncrement;
        ctx.video._simulatePlayback(newPos);
        ctx.setProgressBarTime?.(newPos);
        await pressArrowKey(user, 'right');
      }
      
      // Position diff >> SEEK_MIN_DIFF_SECONDS, so position IS valid
      // But only 3s passed < SEEK_DEBOUNCE_MS, so it's DEBOUNCED
      expect(getPositionHistory()).toHaveLength(1);
    });

    it('saves again after debounce window expires', async () => {
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);
      
      // First press - saves
      await pressArrowKey(user, 'right');
      expect(getPositionHistory()).toHaveLength(1);
      
      // Wait for debounce to expire
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);
      const newPos = startPos + SEEK_MIN_DIFF_SECONDS * 5;
      advancePlayback(ctx, newPos);
      
      // Second press after debounce - saves
      await pressArrowKey(user, 'right');
      expect(getPositionHistory()).toHaveLength(2);
    });
  });

  describe('UI skip button clicks (debounced)', () => {
    it('debounces rapid button clicks from real DOM buttons', async () => {
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);
      
      // First click - saves
      await clickSkipButton(user, 'forward', ctx);
      expect(getPositionHistory()).toHaveLength(1);
      
      // Rapid clicks for 2 seconds (within SEEK_DEBOUNCE_MS)
      const positionIncrement = (SEEK_MIN_DIFF_SECONDS * 5) / 20;
      for (let i = 0; i < 20; i++) {
        vi.advanceTimersByTime(100);
        const newPos = startPos + (i + 1) * positionIncrement;
        ctx.video._simulatePlayback(newPos);
        ctx.setProgressBarTime?.(newPos);
        await clickSkipButton(user, 'forward', ctx);
      }
      
      // Still only 1 save (debounced despite valid position diff)
      expect(getPositionHistory()).toHaveLength(1);
    });
  });

  describe('mixed keyboard and timeline seeks', () => {
    it('keyboard debounce does not affect timeline clicks', async () => {
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);
      
      // Keyboard seek - saves startPos
      await pressArrowKey(user, 'right');
      expect(getPositionHistory()).toHaveLength(1);
      
      // 1 second later (within keyboard debounce window)
      vi.advanceTimersByTime(1000);
      const newPos = startPos + SEEK_MIN_DIFF_SECONDS * 5;
      advancePlayback(ctx, newPos);
      
      // Timeline click - should save newPos (timeline is NOT debounced)
      const dest = newPos + SEEK_MIN_DIFF_SECONDS * 5;
      clickTimeline(ctx.video, dest);
      expect(getPositionHistory()).toHaveLength(2);
      expect(getPositionHistory()[1].time).toBe(newPos);
    });
  });
});

// Disney+ specific: stable time via setTimeout
describe('Disney+ specific: STABLE_TIME_DELAY_MS behavior', () => {
  let ctx: ServiceTestContext;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'setInterval', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    ctx = setupDisneyPlusTest();
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);
  });

  afterEach(() => {
    ctx.handler.cleanup();
    vi.useRealTimers();
    resetFixture();
  });

  it('updates stable time after STABLE_TIME_DELAY_MS when not debouncing', () => {
    const startPos = SEEK_MIN_DIFF_SECONDS * 10;
    
    // Set progress bar time
    ctx.setProgressBarTime!(startPos);
    ctx.video._simulatePlayback(startPos);
    
    // Advance time for RAF loop + stable time setTimeout
    vi.advanceTimersByTime(STABLE_TIME_DELAY_MS + 100);
    
    const augmented = ctx.video as StreamKeysVideoElement;
    expect(augmented._streamKeysStableTime).toBe(startPos);
    
    // Change position (large jump to avoid min diff issues)
    const newPos = startPos + SEEK_MIN_DIFF_SECONDS * 5;
    ctx.setProgressBarTime!(newPos);
    ctx.video._simulatePlayback(newPos);
    
    // Advance again
    vi.advanceTimersByTime(STABLE_TIME_DELAY_MS + 100);
    expect(augmented._streamKeysStableTime).toBe(newPos);
  });
});

// HBO Max specific: seeked event resets flag
describe('HBO Max specific: seeked event flag reset', () => {
  let ctx: ServiceTestContext;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'setInterval', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    ctx = setupHBOMaxTest();
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);
  });

  afterEach(() => {
    ctx.handler.cleanup();
    vi.useRealTimers();
    resetFixture();
  });

  it('flag resets via seeked event, not setTimeout', async () => {
    const startPos = SEEK_MIN_DIFF_SECONDS * 10;
    advancePlayback(ctx, startPos);
    
    // Key press sets isKeyboardOrButtonSeek flag
    await pressArrowKey(user, 'right');
    expect(getPositionHistory()).toHaveLength(1);
    
    // Seeked event fires (like real video after seek completes)
    ctx.video.dispatchEvent(new Event('seeked'));
    
    // Small advance (but not enough for setTimeout timeout)
    vi.advanceTimersByTime(100);
    const newPos = startPos + SEEK_MIN_DIFF_SECONDS * 5;
    advancePlayback(ctx, newPos);
    
    // Timeline click should save (flag was reset by seeked event)
    const dest = newPos + SEEK_MIN_DIFF_SECONDS * 5;
    clickTimeline(ctx.video, dest);
    expect(getPositionHistory()).toHaveLength(2);
  });
});
```

---

## Key Design Decisions

| Aspect | Approach |

|--------|----------|

| **Fixtures** | Real fixtures from `resources/dom/` via `loadFixture()` |

| **HBO Max buttons** | Already in fixture with `data-testid` - no modification needed |

| **Disney+ buttons** | Attach Shadow DOM to existing `<quick-rewind>`, `<quick-fast-forward>` elements |

| **Disney+ progress bar** | Attach Shadow DOM with `.progress-bar__thumb` and `aria-valuenow` |

| **Video elements** | Replace fixture's video with MockVideoElement |

| **Position values** | Start at 200s+, jumps of 100s+ to avoid SEEK_MIN_DIFF_SECONDS confusion |

| **getSeekButtons** | Real patterns from `disney.ts` and `hbomax.ts` |

---

## Files to Modify

1. **package.json** - Add `@testing-library/user-event` and `@testing-library/dom`
2. **vitest.setup.ts** - Add `attachDisneyShadowDOM()`, enhance `MockVideoElement._simulatePlayback()`
3. **src/features/restore-position/test-utils.ts** - `setupHBOMaxTest()`, `setupDisneyPlusTest()`, user action helpers
4. **src/features/restore-position/debouncing.test.ts** - Complete rewrite with parameterized tests
5. **src/features/restore-position/.cursor/rules/debouncing-test/RULE.md** - Cursor rule documenting test behavior

---

## Cursor Rule: debouncing-test/RULE.md

Create `src/features/restore-position/.cursor/rules/debouncing-test/RULE.md`:

````markdown
---
description: Debouncing tests for position history - how to write and maintain tests that verify debouncing behavior distinctly from SEEK_MIN_DIFF_SECONDS rejection.
globs:
  - "**/restore-position/**/debouncing*.test.ts"
  - "**/restore-position/**/test-utils.ts"
---

# Debouncing Tests

## Critical Distinction: Debouncing vs SEEK_MIN_DIFF_SECONDS

**Always import constants from `./history` - never hardcode values!**

```typescript
import { SEEK_MIN_DIFF_SECONDS, SEEK_DEBOUNCE_MS, STABLE_TIME_DELAY_MS } from './history';
```

### SEEK_MIN_DIFF_SECONDS - Position rejection
Positions too close together are rejected regardless of timing:
- `position1 = 100` → saved
- `position2 = 105` → rejected (diff < SEEK_MIN_DIFF_SECONDS)
- This is NOT debouncing!

### SEEK_DEBOUNCE_MS - Time-based debouncing
Rapid actions within SEEK_DEBOUNCE_MS are debounced even with valid position differences:
- First press at position X → SAVED
- Hold key, position advances by SEEK_MIN_DIFF_SECONDS * 6 (valid!)
- Still DEBOUNCED because time < SEEK_DEBOUNCE_MS

## Test Setup Requirements

1. **Start positions at `SEEK_MIN_DIFF_SECONDS * 10`+** - Well above threshold
2. **Use `SEEK_MIN_DIFF_SECONDS * 5`+ jumps** - Ensure position diff doesn't block saves
3. **Time < `SEEK_DEBOUNCE_MS`** for debounce testing, > for expiration

## Real DOM Fixtures

Always use real fixtures via `loadFixture()`:

### HBO Max
- Fixture: `resources/dom/hbomax.html`
- Buttons exist with `data-testid` attributes - use directly
- `getSeekButtons()`: `button[data-testid="player-ux-skip-back-button"]`

### Disney+
- Fixture: `resources/dom/disney.html`
- Empty custom elements need Shadow DOM attached
- Use `attachDisneyShadowDOM()` to add Shadow DOM to `<quick-rewind>`, `<quick-fast-forward>`, `<progress-bar>`
- `getSeekButtons()`: `element.shadowRoot.querySelector('info-tooltip button')`

## User Event Simulation

Use `@testing-library/user-event` for realistic events:

```typescript
import userEvent from '@testing-library/user-event';

const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
await user.keyboard('{ArrowRight}');
await user.pointer({ keys: '[MouseLeft>]', target: button });
````

## Service-Specific Behavior

| Service | Stable Time Update | Flag Reset Mechanism |

|---------|-------------------|---------------------|

| Disney+ | `setTimeout` after `STABLE_TIME_DELAY_MS` (500ms) | Timeout-based |

| HBO Max | RAF loop updates | `seeked` event resets flag |

## Parameterized Tests

Use `describe.each` to run same tests on both services:

```typescript
const services = [
  { name: 'HBO Max', setup: setupHBOMaxTest },
  { name: 'Disney+', setup: setupDisneyPlusTest },
];

describe.each(services)('Debouncing - $name', ({ setup }) => {
  // Shared tests run on both
});
```
```