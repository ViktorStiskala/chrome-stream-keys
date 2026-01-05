// Restore Dialog Configuration

import type { Position } from "./types";

// Video duration in seconds (1h 30m = 90 minutes)
export const DURATION_SECONDS = 90 * 60;

// Initial video position in seconds (14:32 = 872 seconds)
export const INITIAL_VIDEO_SECONDS = 14 * 60 + 32;

// Banner display duration
export const BANNER_FADE_DELAY = 1500;
export const BANNER_FADE_DURATION = 300;

// Dialog animation duration
export const DIALOG_FADE_DURATION = 200;

// Initial positions data
export const initialPositions: Position[] = [
  {
    time: "1:05:17",
    timeSeconds: 1 * 3600 + 5 * 60 + 17,
    label: "load time",
    isLoadTime: true,
  },
  {
    time: "12:47",
    timeSeconds: 12 * 60 + 47,
    label: "30s ago",
    savedAt: Date.now() - 30 * 1000, // 30 seconds ago
  },
  {
    time: "40:23",
    timeSeconds: 40 * 60 + 23,
    label: "2m ago",
    savedAt: Date.now() - 120 * 1000, // 2 minutes ago
  },
];
