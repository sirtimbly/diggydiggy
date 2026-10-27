import { PALETTE } from "./project.js";

export const BLOCK_COLOR_KEY = "diggy-last-block-color-v1";

// A browser preference, separate from shared work and project undo history.
export function createBlockColorPreference(storage) {
  let lastColor = "amber";
  let unsavedChoice = false;
  function current() {
    if (unsavedChoice) return lastColor;
    try {
      const saved = storage?.getItem(BLOCK_COLOR_KEY);
      if (Object.hasOwn(PALETTE, saved)) lastColor = saved;
    } catch { /* Keep the in-memory choice when storage is unavailable. */ }
    return lastColor;
  }
  return {
    initialColor(sourceColor) {
      return Object.hasOwn(PALETTE, sourceColor) ? sourceColor : current();
    },
    remember(color) {
      if (!Object.hasOwn(PALETTE, color)) return;
      lastColor = color;
      unsavedChoice = true;
      try { storage?.setItem(BLOCK_COLOR_KEY, color); unsavedChoice = false; }
      catch { /* The next form in this tab still remembers the selection. */ }
    },
  };
}
