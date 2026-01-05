// Keyboard Event Handlers

import { getIsDialogOpen } from "./state";
import { toggleDialog, closeDialog } from "./dialog";
import { saveCurrentPosition, selectPositionByKey } from "./positions";

// ============================================================================
// Keyboard Handler
// ============================================================================

function handleKeydown(e: KeyboardEvent): void {
  // Skip if user is typing in an input field
  const target = e.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    return;
  }

  // Check for modifier keys
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return;
  }

  const key = e.key.toLowerCase();

  // S key - save position (works always)
  if (key === "s" && !e.shiftKey) {
    e.preventDefault();
    saveCurrentPosition();
    return;
  }

  // R key - toggle dialog
  if (key === "r" && !e.shiftKey) {
    e.preventDefault();
    toggleDialog();
    return;
  }

  // Only handle these keys when dialog is open
  if (!getIsDialogOpen()) return;

  // Escape key - close dialog
  if (key === "escape") {
    e.preventDefault();
    closeDialog();
    return;
  }

  // Number keys 0-9 - select position
  if (/^[0-9]$/.test(key)) {
    e.preventDefault();
    selectPositionByKey(parseInt(key, 10));
    return;
  }
}

// ============================================================================
// Initialization
// ============================================================================

export function initKeyboard(): void {
  document.addEventListener("keydown", handleKeydown);
}
