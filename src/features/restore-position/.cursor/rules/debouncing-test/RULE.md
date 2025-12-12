---
description: Debouncing tests for position history - how to write and maintain tests that verify debouncing behavior distinctly from SEEK_MIN_DIFF_SECONDS rejection.
globs:
  - "**/features/restore-position/**"
---

# Debouncing Tests

## Critical Distinction: Debouncing vs SEEK_MIN_DIFF_SECONDS

**Always import constants from `./history` - never hardcode values!**

```typescript
import {
  SEEK_MIN_DIFF_SECONDS,  // Position threshold (currently 15s)
  SEEK_DEBOUNCE_MS,       // Time window (currently 5000ms)
  STABLE_TIME_DELAY_MS,   // Stable time delay (currently 500ms)
} from './history';
```

### SEEK_MIN_DIFF_SECONDS - Position rejection (NOT what we're testing)

Positions too close together are rejected regardless of timing:

```typescript
position1 = 100;  // saved
position2 = 105;  // rejected (diff < SEEK_MIN_DIFF_SECONDS) - NOT debouncing!
```

### SEEK_DEBOUNCE_MS - Time-based debouncing (what we ARE testing)

Rapid actions within SEEK_DEBOUNCE_MS are debounced even with valid position differences:

```typescript
// Position 200s → SAVED (first press)
// 3s of rapid presses, position now 290s (diff >> SEEK_MIN_DIFF_SECONDS, valid!)
// Still DEBOUNCED because only 3s passed (< SEEK_DEBOUNCE_MS window)
```

## Test Setup Requirements

1. **Start positions at `SEEK_MIN_DIFF_SECONDS * 10`+** - Well above threshold
2. **Use `SEEK_MIN_DIFF_SECONDS * 5`+ jumps** - Ensure position diff doesn't block saves
3. **Time < `SEEK_DEBOUNCE_MS`** for debounce testing, > for expiration

## Real DOM Fixtures

Always use real fixtures via `loadFixture()` from `vitest.setup.ts`:

### HBO Max

- Fixture: `resources/dom/hbomax.html`
- Buttons exist with `data-testid` attributes - use directly
- `getSeekButtons()`: `button[data-testid="player-ux-skip-back-button"]`
- Standard DOM access, no Shadow DOM needed

### Disney+

- Fixture: `resources/dom/disney.html`
- Empty custom elements need Shadow DOM attached
- Use `attachDisneyShadowDOM()` to add Shadow DOM to:
  - `<quick-rewind>`
  - `<quick-fast-forward>`
  - `<progress-bar>`
- `getSeekButtons()`: `element.shadowRoot.querySelector('info-tooltip button')`

## User Event Simulation

Use `@testing-library/user-event` for realistic events:

```typescript
import userEvent from '@testing-library/user-event';

const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
await user.keyboard('{ArrowRight}');
await user.pointer({ keys: '[MouseLeft>]', target: button });
```

## Service Setup Helpers

Use the helpers from `test-utils.ts`:

```typescript
import {
  setupHBOMaxTest,
  setupDisneyPlusTest,
  pressArrowKey,
  clickSkipButton,
  clickTimeline,
  advancePlayback,
  type ServiceTestContext,
} from './test-utils';
```

## Parameterized Tests

Use `describe.each` to run same tests on both services:

```typescript
const services = [
  { name: 'HBO Max', fixture: 'hbomax', setup: setupHBOMaxTest },
  { name: 'Disney+', fixture: 'disney', setup: setupDisneyPlusTest },
] as const;

describe.each(services)('Debouncing - $name (fixture: $fixture)', ({ setup }) => {
  // Shared tests run on both services
});
```

## Service-Specific Behavior

| Service | Stable Time Update | Flag Reset Mechanism |
|---------|-------------------|---------------------|
| Disney+ | `setTimeout` after `STABLE_TIME_DELAY_MS` (500ms) | Timeout-based |
| HBO Max | RAF loop updates | `seeked` event resets flag |

## When Tests Fail

**Challenge implementation first, not tests.**

Ask: Is the test correctly expressing intended behavior?

- **YES** → Fix the implementation (it has a bug)
- **NO** → Fix the test

### Red flags suggesting implementation bugs:

- Timeline clicks being debounced (they should NEVER be debounced)
- Position history not saving first keyboard press
- `isKeyboardOrButtonSeek` flag being reset prematurely during rapid presses
- Stable time not being captured correctly before seek

