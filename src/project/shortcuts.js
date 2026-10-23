export function historyShortcut(event) {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    !(event.metaKey || event.ctrlKey)
  )
    return null;
  const editable = event.target?.closest?.(
    'textarea,input,[contenteditable],[role="textbox"]',
  );
  if (editable) {
    const inputWithProjectUndo =
      editable.tagName === "INPUT" &&
      ["range", "checkbox", "radio", "button", "submit"].includes(
        editable.type,
      );
    if (
      !inputWithProjectUndo &&
      editable.getAttribute?.("contenteditable") !== "false"
    )
      return null;
  }
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && !event.shiftKey) return "redo";
  return null;
}
