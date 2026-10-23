import { useEffect } from "react";
import { historyShortcut } from "../project/shortcuts.js";

export function useProjectShortcuts(actions) {
  useEffect(() => {
    const keydown = (event) => {
      const action = historyShortcut(event);
      if (!action) return;
      event.preventDefault();
      actions[action]();
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [actions]);
}
