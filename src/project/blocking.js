// Manual site closures are independent of prerequisites and surface access.
// Clearing assignments is part of the same edit, so Undo restores both.
export function setBlockBlocked(block, blocked) {
  if (!block || block.done || typeof blocked !== "boolean" || Boolean(block.blocked) === blocked) return false;
  block.blocked = blocked;
  if (blocked) block.people = [];
  return true;
}
