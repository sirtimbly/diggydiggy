export const RECENT_PROJECTS_KEY = "diggy-recent-projects-v1";
const validId = (id) => typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);

// History stays in this browser; invite credentials remain in the existing invite store.
export function createRecentProjects(storage) {
  let fallback = [];
  let unsaved = false;
  function read() {
    if (!storage || unsaved) return fallback;
    try {
      const parsed = JSON.parse(storage?.getItem(RECENT_PROJECTS_KEY) ?? "[]");
      if (Array.isArray(parsed)) fallback = parsed.filter((entry) =>
        entry && validId(entry.id) && typeof entry.name === "string" && entry.name.length <= 80);
    } catch { /* Keep this tab's history if storage is unavailable. */ }
    return fallback;
  }
  return {
    read,
    remember(id, name) {
      if (!validId(id)) return read();
      fallback = [{ id, name }, ...read().filter((entry) => entry.id !== id)];
      unsaved = true;
      try { storage?.setItem(RECENT_PROJECTS_KEY, JSON.stringify(fallback)); unsaved = !storage; }
      catch { /* History remains usable in this tab. */ }
      return fallback;
    },
    href(id, origin) {
      const path = `/?project=${encodeURIComponent(id)}`;
      try {
        const saved = storage?.getItem(`diggy-invite:${id}`);
        if (!saved) return path;
        const url = new URL(saved, origin);
        if (url.origin !== origin || url.searchParams.get("project") !== id) return path;
        const invite = new URLSearchParams(url.hash.slice(1)).get("invite");
        return invite ? `${path}#${new URLSearchParams({ invite })}` : path;
      } catch { return path; }
    },
  };
}
