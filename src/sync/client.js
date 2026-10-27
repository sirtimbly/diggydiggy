import ReconnectingWebSocket from "partysocket/ws";
import { STORAGE } from "../project/project.js";

const inviteKey = (id) => `diggy-invite:${id}`;
function rememberInvite(projectId, inviteUrl) {
  try { localStorage.setItem(inviteKey(projectId), inviteUrl); } catch { /* The invite still opens without browser storage. */ }
}
function rememberedInvite(projectId) {
  try { return localStorage.getItem(inviteKey(projectId)) ?? ""; } catch { return ""; }
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "Could not reach the shared project.");
  return data;
}
export async function createAndOpenProject(project) {
  const created = await api("/api/projects", {
    method: "POST",
    body: JSON.stringify({ project }),
  });
  rememberInvite(created.projectId, created.inviteUrl);
  location.assign(created.inviteUrl);
}
export async function loadSharedProject() {
  const url = new URL(location.href),
    projectId = url.searchParams.get("project");
  if (!projectId) return null;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(projectId))
    throw new Error("This project link is invalid.");
  const token = new URLSearchParams(url.hash.slice(1)).get("invite");
  const inviteUrl = token ? url.href : rememberedInvite(projectId);
  if (token) {
    await api(`/api/projects/${projectId}/session`, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    rememberInvite(projectId, inviteUrl);
    url.hash = "";
    history.replaceState(null, "", url);
  }
  const snapshot = await api(`/api/projects/${projectId}`);
  return {
    projectId,
    snapshot,
    storageKey: `${STORAGE}:${projectId}`,
    inviteUrl,
  };
}

export function connectCollaboration(controller, shared, {
  Socket = ReconnectingWebSocket, page = globalThis.document, currentLocation = globalThis.location,
} = {}) {
  const { store } = controller;
  let socket,
    disposed = false,
    ready = false,
    inFlight = null,
    latest = null,
    conflict = null,
    retryTimer,
    live = false;
  let lastPresence = "";
  function sendPresence(force = false) {
    if (disposed || socket?.readyState !== 1) return;
    const active = !page.hidden;
    const packet = { type: "presence", clientId: store.getStatus().clientId,
      selectedBlock: active ? controller.getView().state.selected ?? null : null, active };
    const encoded = JSON.stringify(packet);
    if (force || encoded !== lastPresence) { socket.send(encoded); lastPresence = encoded; }
  }
  const update = (extra = {}) =>
    controller.setSyncState({
      status: conflict
        ? "conflict"
        : live
          ? "live"
          : shared
            ? "offline"
            : "local",
      pending: store.getStatus().pendingCount,
      ...extra,
    });
  const schedule = () => {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(applyLatest, 150);
  };
  function flush() {
    if (!controller.getView().canEdit || disposed || conflict || !ready || inFlight || socket?.readyState !== 1)
      return;
    const command = store.getPendingMutations()[0];
    if (command) {
      inFlight = command.id;
      socket.send(JSON.stringify({ type: "mutation", command }));
    }
    update();
  }
  function applyLatest() {
    if (!latest || disposed) return;
    let result;
    try {
      result = controller.receiveRemote(latest);
    } catch (error) {
      update({ status: "error", error: error.message });
      return;
    }
    if (result.deferred) {
      schedule();
      return;
    }
    if (result.conflict) {
      conflict = latest;
      update({ error: "Some work changed while you were editing." });
      return;
    }
    if (inFlight && !store.getPendingMutations().some((c) => c.id === inFlight))
      inFlight = null;
    latest = null;
    ready = true;
    live = true;
    update({ error: "" });
    flush();
  }
  const unsubscribe = store.subscribe((event) => {
    if (event.source !== "remote") {
      update();
      queueMicrotask(flush);
    }
  });
  const unsubscribeView = controller.subscribeView(() => sendPresence());
  const visibilityChanged = () => sendPresence(true);
  page.addEventListener("visibilitychange", visibilityChanged);
  const heartbeat = setInterval(() => sendPresence(true), 20_000);
  controller.setSyncHandlers({
    authenticationChanged() {
      ready = false;
      inFlight = null;
      socket?.reconnect();
    },
    async create() {
      update({ status: "sharing", error: "" });
      try {
        await createAndOpenProject(store.getProject());
      } catch (error) {
        update({ error: error.message });
      }
    },
    async copy() {
      try {
        await navigator.clipboard.writeText(shared?.inviteUrl ?? "");
        update({ copied: true, error: "" });
      } catch {
        update({ error: "Select and copy the invite link below." });
      }
    },
    resolve(keepLocal) {
      if (!conflict) return;
      try {
        const project = store.resolveRemote(conflict, keepLocal);
        controller.applyResolvedProject(project);
        conflict = null;
        latest = null;
        inFlight = null;
        ready = true;
        update({ error: "" });
        flush();
      } catch (error) {
        update({ error: error.message });
      }
    },
  });
  if (shared) {
    if (!store.getStatus().syncEnabled)
      store.enableSync({
        projectId: shared.projectId,
        revision: shared.snapshot.revision,
      });
    const url = new URL(
      `/api/projects/${shared.projectId}/socket`,
      currentLocation.origin,
    );
    url.protocol = currentLocation.protocol === "https:" ? "wss:" : "ws:";
    socket = new Socket(url.href, [], {
      maxEnqueuedMessages: 0,
      minReconnectionDelay: 500,
      maxReconnectionDelay: 10000,
    });
    socket.addEventListener("open", () => {
      live = false;
      ready = false;
      inFlight = null;
      socket.send(
        JSON.stringify({
          type: "hello",
          pendingIds: store
            .getPendingMutations()
            .map((c) => c.id)
            .slice(0, 1000),
        }),
      );
      sendPresence(true);
      update({ inviteUrl: shared.inviteUrl });
    });
    socket.addEventListener("close", () => {
      live = false;
      ready = false;
      inFlight = null;
      lastPresence = "";
      controller.setPresenceState({ selfId: null, peers: [] });
      update();
    });
    socket.addEventListener("message", (event) => {
      if (disposed) return;
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === "presence") {
          controller.setPresenceState({ selfId: packet.selfId, peers: packet.peers });
          return;
        }
        if (packet.type === "snapshot") {
          latest = packet;
          applyLatest();
        }
        if (packet.type === "error") {
          if (packet.status === 401) {
            controller.actions.setAccount(null);
            update({ error: packet.message });
            return;
          }
          if (packet.status === 409 && packet.snapshot) {
            // Rebase packing-only differences and lost acknowledgements before
            // asking the user to resolve an actual competing field edit.
            inFlight = null;
            latest = packet.snapshot;
            applyLatest();
            return;
          }
          ready = false;
          conflict = packet.snapshot;
          update({
            status: packet.snapshot ? "conflict" : "error",
            error: packet.message,
          });
        }
      } catch {
        update({
          status: "error",
          error: "An unexpected update arrived. Reconnect to this project.",
        });
      }
    });
    update({ inviteUrl: shared.inviteUrl });
  } else update();
  return () => {
    disposed = true;
    clearTimeout(retryTimer);
    clearInterval(heartbeat);
    page.removeEventListener("visibilitychange", visibilityChanged);
    unsubscribeView();
    unsubscribe();
    socket?.close();
  };
}
