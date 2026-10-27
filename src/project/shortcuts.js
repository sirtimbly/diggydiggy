export function canvasShortcut(event) {
  if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.metaKey || event.ctrlKey ||
    event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[inert]')) return null;
  const key = event.key.toLowerCase();
  return key === "n" ? "new" : key === "g" ? "go" : null;
}

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
