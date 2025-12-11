---
description: Debug StreamKeys extension issues using runtime logs
---

# Debug Extension Issue

Read the debug log from the last dev mode session and analyze the issue described by the user.

## Instructions

1. Read the debug log file at `.cursor/debug.log`
2. Analyze the log output in context of the user's issue description
3. Look for:
   - Error messages or warnings
   - Missing expected log entries (code paths not executed)
   - Timing issues or unexpected execution order
   - State inconsistencies
4. Identify the root cause and propose a fix

## Context

The debug log contains all `console.log/warn/error` output from the extension running in dev mode (`npm run dev`). Each log entry from StreamKeys is prefixed with `[StreamKeys]`.

$ARGUMENTS
