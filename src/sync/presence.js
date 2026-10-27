import { UNDERGROUND_CREATURES } from "./creatures.js";

export const PRESENCE_COLORS = ["#277b91", "#a54b35", "#6f55a5", "#397a4b", "#a13d72", "#866017", "#3d65ad", "#736047"];
function number(seed) {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}
export const presenceColor = (id) => PRESENCE_COLORS[number(id) % PRESENCE_COLORS.length];
export const guestCreature = (id) => UNDERGROUND_CREATURES[number(id) % UNDERGROUND_CREATURES.length];
export const guestName = (id) => `Anonymous ${guestCreature(id).name}`;
export const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((part) => [...part][0]).join("").toUpperCase();

export function collaborators(peers, selfId) {
  const people = new Map();
  for (const peer of peers) {
    const existing = people.get(peer.personId);
    if (existing) {
      existing.tabs++;
      existing.active ||= peer.active;
      existing.self ||= peer.id === selfId;
    } else people.set(peer.personId, { ...peer, tabs: 1, self: peer.id === selfId });
  }
  return [...people.values()].sort((a, b) => Number(b.self) - Number(a.self) || a.name.localeCompare(b.name));
}
