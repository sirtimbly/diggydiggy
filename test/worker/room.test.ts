import { SELF, env, runInDurableObject } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { demo, emptyProject } from "../../src/project/project.js";
import { applyMasonry } from "../../masonry.js";
import { projectDocument, diffDocuments } from "../../src/project/changes.js";
import { accountSession } from "./account";
import { previewResize } from "../../masonry.js";
import { guestCreature, guestName } from "../../src/sync/presence.js";

const origin = "https://diggy.test";
async function create(project = demo()) {
  const account = await accountSession();
  applyMasonry(project);
  const response = await SELF.fetch(`${origin}/api/projects`, {
    method: "POST",
    headers: {
      origin,
      cookie: account.cookie,
      "content-type": "application/json",
      "cf-connecting-ip": crypto.randomUUID(),
    },
    body: JSON.stringify({ project }),
  });
  expect(response.status).toBe(201);
  const data: any = await response.json();
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  return { data, cookie: `${cookie}; ${account.cookie}`, projectCookie: cookie, account };
}
async function connect(id: string, cookie: string) {
  const response = await SELF.fetch(`${origin}/api/projects/${id}/socket`, {
    headers: { origin, cookie, upgrade: "websocket" },
  });
  expect(response.status).toBe(101);
  const ws = response.webSocket!;
  const ready = next(ws);
  ws.accept();
  await ready;
  return ws;
}
function next(ws: WebSocket, type?: string) {
  return new Promise<any>((resolve) => {
    const receive = (e: MessageEvent) => {
      const packet = JSON.parse(e.data as string);
      if (type ? packet.type !== type : packet.type === "presence") return;
      ws.removeEventListener("message", receive);
      resolve(packet);
    };
    ws.addEventListener("message", receive);
  });
}
function command(data: any, project: any) {
  return {
    version: 1,
    id: crypto.randomUUID(),
    projectId: data.projectId,
    clientId: crypto.randomUUID(),
    baseRevision: data.revision,
    kind: "edit",
    label: "Rename",
    changes: diffDocuments(
      projectDocument(data.project),
      projectDocument(project),
    ),
  };
}

describe("private project rooms", () => {
  it("syncs and persists project color legends while rejecting anonymous edits", async () => {
    const { data, cookie, projectCookie } = await create();
    const editor = await connect(data.projectId, cookie), viewer = await connect(data.projectId, projectCookie);
    const labeled = { ...data.project, colorLegend: { amber: { color: "#336699", label: "Engineering" } } };
    let saved = next(editor), received = next(viewer);
    editor.send(JSON.stringify({ type: "mutation", command: command(data, labeled) }));
    const confirmed = await saved;
    expect(confirmed.type).toBe("snapshot");
    expect((await received).project.colorLegend).toEqual(labeled.colorLegend);
    const persisted: any = await (await SELF.fetch(`${origin}/api/projects/${data.projectId}`, {headers: {cookie: projectCookie}})).json();
    expect(persisted.project.colorLegend).toEqual(labeled.colorLegend);
    const denied = next(viewer);
    viewer.send(JSON.stringify({type: "mutation", command: command(confirmed, {...labeled, colorLegend: {}})}));
    expect(await denied).toMatchObject({type: "error", status: 401});
    const malformed = next(editor);
    editor.send(JSON.stringify({type: "mutation", command: command(confirmed, {...labeled, colorLegend: {amber: {color: "red", label: "Invalid"}}})}));
    expect(await malformed).toMatchObject({type: "error", status: 400});
    editor.close(); viewer.close();
  });
  it("publishes authenticated and anonymous presence, selections, and departures without changing project data", async () => {
    const { data, cookie, projectCookie } = await create();
    const editor = await connect(data.projectId, cookie), guest = await connect(data.projectId, projectCookie);
    let roster = next(editor, "presence"), guestRoster = next(guest, "presence");
    guest.send(JSON.stringify({ type: "presence", clientId: "guest-browser", selectedBlock: data.project.blocks[0].id,
      active: true, name: "Forged owner", signedIn: true, color: "red" }));
    const visible = await roster, own = await guestRoster;
    const anonymous = visible.peers.find((peer: any) => peer.id === own.selfId);
    expect(anonymous).toMatchObject({ signedIn: false, selectedBlock: data.project.blocks[0].id, active: true });
    expect(anonymous.name).toMatch(/^Anonymous /);
    expect(anonymous.name).toBe(guestName("guest-browser"));
    expect(anonymous.creature).toBe(guestCreature("guest-browser").id);
    expect(visible.peers.find((peer: any) => peer.signedIn).name).toBe("Digger");
    expect(anonymous.color).not.toBe(visible.peers.find((peer: any) => peer.signedIn).color);
    expect(JSON.stringify(visible)).not.toMatch(/accountKey|diggy_account|session:/);
    const stored: any = await (await SELF.fetch(`${origin}/api/projects/${data.projectId}`, { headers: { cookie: projectCookie } })).json();
    expect(stored.revision).toBe(1); expect(stored.project).toEqual(data.project);
    roster = next(editor, "presence");
    guest.send(JSON.stringify({ type: "presence", clientId: "guest-browser", selectedBlock: null, active: false }));
    expect((await roster).peers.find((peer: any) => peer.id === own.selfId)).toMatchObject({ selectedBlock: null, active: false });
    roster = next(editor, "presence");
    guest.close();
    expect((await roster).peers.some((peer: any) => peer.id === own.selfId)).toBe(false);
    editor.close();
  });
  it("keeps one signed-in identity/color across tabs and drops stale anonymous presence", async () => {
    const { data, cookie, projectCookie } = await create();
    const a = await connect(data.projectId, cookie), b = await connect(data.projectId, cookie), guest = await connect(data.projectId, projectCookie);
    let roster = next(a, "presence");
    a.send(JSON.stringify({ type: "presence", clientId: "editor-browser", selectedBlock: null, active: true }));
    const peers = (await roster).peers.filter((peer: any) => peer.signedIn);
    expect(peers).toHaveLength(2); expect(peers[0].personId).toBe(peers[1].personId); expect(peers[0].color).toBe(peers[1].color);
    await runInDurableObject(env.PROJECTS.getByName(data.projectId), (instance) => {
      for (const peer of instance.getConnections<any>()) {
        if (!peer.state.presence.signedIn) peer.setState({ ...peer.state, presence: { ...peer.state.presence, seenAt: 0 } });
      }
    });
    roster = next(a, "presence");
    a.send(JSON.stringify({ type: "presence", clientId: "editor-browser", selectedBlock: null, active: true }));
    expect((await roster).peers.every((peer: any) => peer.signedIn)).toBe(true);
    a.close(); b.close(); guest.close();
  });
  it("merges simultaneous resizes of different blocks and broadcasts the canonical dimensions", async () => {
    const { data, cookie } = await create();
    const a = await connect(data.projectId, cookie), b = await connect(data.projectId, cookie);
    const first = structuredClone(data.project), second = structuredClone(data.project);
    first.blocks = previewResize(first, "b1", "s", 0, 96).blocks; applyMasonry(first);
    second.blocks = previewResize(second, "b2", "e", 64, 0).blocks; applyMasonry(second);
    let receivedA = next(a), receivedB = next(b);
    a.send(JSON.stringify({ type: "mutation", command: command(data, first) })); await receivedA; await receivedB;
    receivedA = next(a); receivedB = next(b);
    b.send(JSON.stringify({ type: "mutation", command: command(data, second) }));
    const saved = await receivedA;
    expect(saved.type).toBe("snapshot"); expect(saved.revision).toBe(3);
    expect(saved.project.blocks.find((block: any) => block.id === "b1").height).toBe(first.blocks.find((block: any) => block.id === "b1").height);
    expect(saved.project.blocks.find((block: any) => block.id === "b2").width).toBe(second.blocks.find((block: any) => block.id === "b2").width);
    expect((await receivedB).project).toEqual(saved.project);
    a.close(); b.close();
  });
  it.each(["missing", "forged", "expired", "revoked"])("requires a valid account to create a project: %s", async (kind) => {
    const session = await accountSession(kind === "expired" ? -1 : 3600);
    if (kind === "revoked") await env.AUTH_SESSIONS.getByName(`session:${session.key}`).revoke();
    const cookie = kind === "missing" ? "" : kind === "forged" ? `diggy_account=${"f".repeat(64)}` : session.cookie;
    const response = await SELF.fetch(`${origin}/api/projects`, {
      method: "POST", headers: { origin, cookie }, body: JSON.stringify({ project: emptyProject() }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it.each(["missing", "forged", "expired", "revoked"])("allows private-link viewing but blocks project name/subtitle edits: %s account", async (kind) => {
    const { data, projectCookie } = await create();
    const session = await accountSession(kind === "expired" ? -1 : 3600);
    if (kind === "revoked") await env.AUTH_SESSIONS.getByName(`session:${session.key}`).revoke();
    const account = kind === "missing" ? "" : kind === "forged" ? `diggy_account=${"f".repeat(64)}` : session.cookie;
    const cookie = `${projectCookie}; ${account}`;
    const viewer = await connect(data.projectId, cookie);
    let response = next(viewer);
    viewer.send(JSON.stringify({ type: "hello", pendingIds: [] }));
    expect((await response).project).toEqual(data.project);
    const renamed = { ...data.project, name: "Unauthorized name", subtitle: "Unauthorized subtitle" };
    response = next(viewer);
    viewer.send(JSON.stringify({ type: "mutation", command: command(data, renamed) }));
    expect(await response).toMatchObject({ type: "error", status: 401, snapshot: { revision: 1, project: data.project } });
    const reloaded: any = await (await SELF.fetch(`${origin}/api/projects/${data.projectId}`, { headers: { cookie: projectCookie } })).json();
    expect(reloaded.project).toEqual(data.project);
    expect(reloaded.revision).toBe(1);
    viewer.close();
  });
  it.each(["logout", "expiry"])("revokes writes on an existing socket after %s while viewers keep receiving updates", async (reason) => {
    const { data, cookie, projectCookie, account } = await create();
    const editor = await connect(data.projectId, cookie), viewer = await connect(data.projectId, projectCookie);
    const renamed = { ...data.project, name: "Signed-in change", subtitle: "Saved together" };
    let saved = next(editor), received = next(viewer);
    editor.send(JSON.stringify({ type: "mutation", command: command(data, renamed) }));
    const confirmed = await saved;
    expect((await received).project).toMatchObject({ name: renamed.name, subtitle: renamed.subtitle });
    if (reason === "logout") {
      expect((await SELF.fetch(`${origin}/api/auth/logout`, { method: "POST", headers: { origin, cookie: account.cookie } })).status).toBe(200);
    } else {
      await runInDurableObject(env.AUTH_SESSIONS.getByName(`session:${account.key}`), (_, state) => {
        state.storage.kv.put("record", { ...state.storage.kv.get<any>("record"), expires: 0 });
      });
    }
    saved = next(editor);
    editor.send(JSON.stringify({ type: "mutation", command: command(confirmed, { ...renamed, name: "Rejected after sign-out" }) }));
    expect(await saved).toMatchObject({ type: "error", status: 401, snapshot: { revision: 2, project: renamed } });
    const otherAccount = await accountSession();
    const other = await connect(data.projectId, `${projectCookie}; ${otherAccount.cookie}`);
    saved = next(other); received = next(viewer);
    const formerEditorUpdate = next(editor);
    other.send(JSON.stringify({ type: "mutation", command: command(confirmed, { ...renamed, subtitle: "Another signed-in editor" }) }));
    expect((await saved).revision).toBe(3);
    expect((await received).project.subtitle).toBe("Another signed-in editor");
    await formerEditorUpdate;
    editor.close(); viewer.close(); other.close();
  });
  it("broadcasts project renames to collaborators and retains them on reload", async () => {
    const { data, cookie } = await create(emptyProject());
    const a = await connect(data.projectId, cookie), b = await connect(data.projectId, cookie);
    const renamed = structuredClone(data.project);
    renamed.name = "The autumn launch";
    const receivedA = next(a), receivedB = next(b);
    a.send(JSON.stringify({ type: "mutation", command: command(data, renamed) }));
    for (const saved of await Promise.all([receivedA, receivedB])) {
      expect(saved.project.name).toBe("The autumn launch");
      expect(saved.project.blocks).toEqual([]);
    }
    const reloaded: any = await (await SELF.fetch(`${origin}/api/projects/${data.projectId}`, { headers: { origin, cookie } })).json();
    expect(reloaded.project.name).toBe("The autumn launch");
    a.close(); b.close();
  });
  it("creates an independent blank room, joins by invite, and accepts its first block", async () => {
    const existing = await create();
    const { data, cookie } = await create(emptyProject());
    expect(data.projectId).not.toBe(existing.data.projectId);
    for (const collection of ["blocks", "crew", "dividers", "excavations"])
      expect(data.project[collection]).toEqual([]);
    const token = new URL(data.inviteUrl).hash.slice("#invite=".length);
    const join = await SELF.fetch(`${origin}/api/projects/${data.projectId}/session`, {
      method: "POST", headers: { origin }, body: JSON.stringify({ token }),
    });
    expect(join.status).toBe(200);
    const guest = join.headers.get("set-cookie")!.split(";")[0];
    const collaborator = await accountSession();
    const ws = await connect(data.projectId, `${guest}; ${collaborator.cookie}`);
    const project = structuredClone(data.project);
    project.blocks.push({ ...demo().blocks[0], title: "Our first block", people: [], progress: 0 });
    applyMasonry(project);
    const response = next(ws);
    ws.send(JSON.stringify({ type: "mutation", command: command(data, project) }));
    const saved = await response;
    expect(saved.revision).toBe(2);
    expect(saved.project.blocks[0].title).toBe("Our first block");
    expect(saved.project.crew).toEqual([]);
    const original: any = await (await SELF.fetch(`${origin}/api/projects/${existing.data.projectId}`, {
      headers: { origin, cookie: existing.cookie },
    })).json();
    expect(original.project).toEqual(existing.data.project);
    expect(original.revision).toBe(1);
    expect((await SELF.fetch(`${origin}/api/projects/${existing.data.projectId}`, { headers: { origin, cookie } })).status).toBe(403);
    ws.close();
  });
  it("requires a private invite/session and rejects cross-origin creation", async () => {
    const { data, cookie } = await create();
    const missing = await SELF.fetch(
      `${origin}/api/projects/${data.projectId}`,
      { headers: { origin } },
    );
    expect(missing.status).toBe(403);
    const ok = await SELF.fetch(`${origin}/api/projects/${data.projectId}`, {
      headers: { origin, cookie },
    });
    expect(ok.status).toBe(200);
    const foreign = await SELF.fetch(`${origin}/api/projects`, {
      method: "POST",
      headers: { origin: "https://other.test" },
      body: "{}",
    });
    expect(foreign.status).toBe(403);
    const token = new URL(data.inviteUrl).hash.slice("#invite=".length);
    const session = await SELF.fetch(
      `${origin}/api/projects/${data.projectId}/session`,
      { method: "POST", headers: { origin }, body: JSON.stringify({ token }) },
    );
    expect(session.status).toBe(200);
    expect(session.headers.get("set-cookie")).toContain("HttpOnly");
    const wrong = await SELF.fetch(
      `${origin}/api/projects/${data.projectId}/session`,
      {
        method: "POST",
        headers: { origin },
        body: JSON.stringify({ token: "a".repeat(64) }),
      },
    );
    expect(wrong.status).toBe(403);
  });
  it("persists once, broadcasts to two clients, and returns receipts on reconnect", async () => {
    const { data, cookie } = await create(),
      a = await connect(data.projectId, cookie),
      b = await connect(data.projectId, cookie);
    const project = structuredClone(data.project);
    project.blocks[0].title = "Together";
    const edit = command(data, project);
    const first = next(a),
      other = next(b);
    a.send(JSON.stringify({ type: "mutation", command: edit }));
    const ack = await first,
      remote = await other;
    expect(ack.revision).toBe(2);
    expect(ack.acknowledgedIds).toContain(edit.id);
    expect(remote.project.blocks[0].title).toBe("Together");
    const duplicate = next(a);
    a.send(JSON.stringify({ type: "mutation", command: edit }));
    expect((await duplicate).revision).toBe(2);
    const reconnect = next(b);
    b.send(JSON.stringify({ type: "hello", pendingIds: [edit.id] }));
    expect((await reconnect).acknowledgedIds).toContain(edit.id);
    const stored = await SELF.fetch(
      `${origin}/api/projects/${data.projectId}`,
      { headers: { origin, cookie } },
    );
    expect(((await stored.json()) as any).revision).toBe(2);
    a.close();
    b.close();
  });
  it("rejects conflicting edits atomically, cycles, and reused edit IDs", async () => {
    const { data, cookie } = await create(),
      ws = await connect(data.projectId, cookie);
    const p = structuredClone(data.project);
    p.blocks[0].title = "First";
    const edit = command(data, p);
    let response = next(ws);
    ws.send(JSON.stringify({ type: "mutation", command: edit }));
    await response;
    p.blocks[0].title = "Stale";
    response = next(ws);
    ws.send(JSON.stringify({ type: "mutation", command: command(data, p) }));
    expect((await response).status).toBe(409);
    response = next(ws);
    ws.send(
      JSON.stringify({
        type: "mutation",
        command: { ...edit, label: "Changed payload" },
      }),
    );
    expect((await response).status).toBe(409);
    response = next(ws);
    ws.send(
      JSON.stringify({
        type: "mutation",
        command: {
          ...edit,
          id: crypto.randomUUID(),
          changes: [
            {
              path: ["__proto__", "polluted"],
              before: null,
              after: { value: true },
            },
          ],
        },
      }),
    );
    expect((await response).status).toBe(400);
    const latest: any = await (await SELF.fetch(`${origin}/api/projects/${data.projectId}`, {headers: {origin, cookie}})).json();
    const cyclic = structuredClone(latest.project);
    cyclic.blocks[0].dependencies = [cyclic.blocks[1].id];
    cyclic.blocks[0].dependency = cyclic.blocks[1].id;
    cyclic.blocks[1].dependencies = [cyclic.blocks[0].id];
    cyclic.blocks[1].dependency = cyclic.blocks[0].id;
    response = next(ws);
    ws.send(JSON.stringify({type: "mutation", command: command(latest, cyclic)}));
    expect((await response).status).toBe(400);
    const unchanged: any = await (await SELF.fetch(`${origin}/api/projects/${data.projectId}`, {headers: {origin, cookie}})).json();
    expect(unchanged.revision).toBe(2);
    expect(unchanged.project.blocks[0].title).toBe("First");
    ws.close();
  });
  it("accepts independent stale-field edits and removal of legacy anonymous holes", async () => {
    const initial = demo();
    initial.excavations = [{x: 3200, y: 800, width: 100, height: 100}];
    const {data, cookie} = await create(initial), ws = await connect(data.projectId, cookie);
    const renamed = structuredClone(data.project);
    renamed.blocks[0].title = "Independent title";
    let response = next(ws);
    ws.send(JSON.stringify({type: "mutation", command: command(data, renamed)}));
    expect((await response).revision).toBe(2);
    const other = structuredClone(data.project);
    other.blocks[0].note = "An independent note";
    other.excavations = [];
    response = next(ws);
    ws.send(JSON.stringify({type: "mutation", command: command(data, other)}));
    const saved = await response;
    expect(saved.revision).toBe(3);
    expect(saved.project.blocks[0].title).toBe("Independent title");
    expect(saved.project.blocks[0].note).toBe("An independent note");
    expect(saved.project.excavations).toEqual([]);
    ws.close();
  });
  it("isolates projects and can fan out a durable edit to twenty connections", async () => {
    const { data, cookie } = await create();
    const sockets = await Promise.all(
      Array.from({ length: 20 }, () => connect(data.projectId, cookie)),
    );
    const project = structuredClone(data.project);
    project.blocks[0].note = "Twenty people see this";
    const edit = command(data, project);
    const updates = sockets.map((ws) => next(ws));
    sockets[0].send(JSON.stringify({ type: "mutation", command: edit }));
    for (const update of await Promise.all(updates))
      expect(update.project.blocks[0].note).toBe("Twenty people see this");
    const another = await create();
    const wrong = await SELF.fetch(
      `${origin}/api/projects/${another.data.projectId}`,
      { headers: { origin, cookie } },
    );
    expect(wrong.status).toBe(403);
    sockets.forEach((ws) => ws.close());
  });
  it("upgrades a legacy room and persists phase annotations independently of work", async () => {
    const {data,cookie}=await create();
    const legacy=projectDocument(data.project); delete legacy.dividers;
    await runInDurableObject(env.PROJECTS.getByName(data.projectId),async(_instance,state)=>{
      state.storage.sql.exec("UPDATE project SET document=? WHERE singleton=1",JSON.stringify(legacy));
    });
    const a=await connect(data.projectId,cookie),b=await connect(data.projectId,cookie);
    const project=structuredClone(data.project);
    project.dividers=[{id:"beta-phase",label:"Private beta",color:"heather",x:-128,y:512}];
    let first=next(a),second=next(b);
    a.send(JSON.stringify({type:"mutation",command:command(data,project)}));
    const saved=await first,remote=await second;
    expect(remote.project.dividers).toEqual(project.dividers);
    expect(saved.project.blocks).toEqual(data.project.blocks);
    const moved=structuredClone(saved.project);moved.dividers[0].y=720;
    first=next(a);second=next(b);
    a.send(JSON.stringify({type:"mutation",command:command(saved,moved)}));
    await first;expect((await second).project.dividers[0].y).toBe(720);
    const persisted:any=await(await SELF.fetch(`${origin}/api/projects/${data.projectId}`,{headers:{origin,cookie}})).json();
    expect(persisted.project.dividers[0]).toMatchObject({label:"Private beta",y:720});
    a.close();b.close();
  });
  it("upgrades an existing SQLite room and syncs crew creation, assignment, archive, and restore", async () => {
    const {data, cookie} = await create();
    const legacy = projectDocument(data.project); delete legacy.crew;
    await runInDurableObject(env.PROJECTS.getByName(data.projectId), async (_instance, state) => {
      state.storage.sql.exec("UPDATE project SET document=? WHERE singleton=1", JSON.stringify(legacy));
    });
    const loaded: any = await (await SELF.fetch(`${origin}/api/projects/${data.projectId}`, {headers: {origin, cookie}})).json();
    expect(loaded.project.crew).toHaveLength(4);
    const a = await connect(data.projectId, cookie), b = await connect(data.projectId, cookie);
    let confirmed = loaded;
    async function mutate(project: any) {
      const first = next(a), second = next(b);
      a.send(JSON.stringify({type: "mutation", command: command(confirmed, project)}));
      const saved = await first, remote = await second;
      expect(saved.type).toBe("snapshot");
      expect(remote.project.crew).toEqual(saved.project.crew);
      confirmed = saved;
      return saved;
    }
    let project = structuredClone(confirmed.project);
    project.crew.push({id: "alex", name: "Alex", color: "#cda65a", shirt: "#335577", skin: "#8b6044", archived: false,
      hairLength: "long", hairColor: "#ddaa66", glasses: true, headphones: true});
    Object.assign(project.crew[0], {hairLength: "medium", hairColor: "#223344", glasses: true, headphones: false});
    project.blocks[0].people.push("alex");
    await mutate(project);
    project = structuredClone(confirmed.project);
    project.crew.find((p: any) => p.id === "alex").archived = true;
    const rejected = next(a);
    a.send(JSON.stringify({type: "mutation", command: command(confirmed, project)}));
    expect((await rejected).status).toBe(400);
    project.blocks.forEach((block: any) => {block.people = block.people.filter((id: string) => id !== "alex");});
    await mutate(project);
    expect(confirmed.project.blocks.some((block: any) => block.people.includes("alex"))).toBe(false);
    project = structuredClone(confirmed.project);
    const person = project.crew.find((p: any) => p.id === "alex"); person.archived = false; person.name = "Alex renamed";
    await mutate(project);
    const persisted: any = await (await SELF.fetch(`${origin}/api/projects/${data.projectId}`, {headers: {origin, cookie}})).json();
    expect(persisted.project.crew.find((p: any) => p.id === "alex")).toMatchObject({name: "Alex renamed", archived: false,
      hairLength: "long", hairColor: "#ddaa66", glasses: true, headphones: true});
    expect(persisted.project.crew[0]).toMatchObject({hairLength: "medium", hairColor: "#223344", glasses: true, headphones: false});
    a.close(); b.close();
  });

});

it("syncs a manual closure with crew removal atomically and rejects assignments until reopened", async () => {
  const { data, cookie } = await create();
  const a = await connect(data.projectId, cookie), b = await connect(data.projectId, cookie);
  const closed = structuredClone(data.project);
  closed.blocks[0].blocked = true; closed.blocks[0].people = [];
  let saved = next(a), received = next(b);
  a.send(JSON.stringify({ type: "mutation", command: command(data, closed) }));
  const confirmed = await saved, remote = await received;
  expect(confirmed.project.blocks[0]).toMatchObject({ blocked: true, people: [], progress: data.project.blocks[0].progress });
  expect(remote.project).toEqual(confirmed.project);
  const reloaded: any = await (await SELF.fetch(`${origin}/api/projects/${data.projectId}`, { headers: { cookie } })).json();
  expect(reloaded.project.blocks[0]).toMatchObject({ blocked: true, people: [] });
  const invalid = structuredClone(confirmed.project); invalid.blocks[0].people = ["maya"];
  saved = next(a);
  a.send(JSON.stringify({ type: "mutation", command: command(confirmed, invalid) }));
  expect(await saved).toMatchObject({ type: "error", status: 400 });
  const open = structuredClone(confirmed.project); open.blocks[0].blocked = false;
  saved = next(a); received = next(b);
  a.send(JSON.stringify({ type: "mutation", command: command(confirmed, open) }));
  expect((await saved).project.blocks[0]).toMatchObject({ blocked: false, people: [] });
  expect((await received).project.blocks[0].blocked).toBe(false);
  a.close(); b.close();
});

it("syncs the project placement limit, permits extra slots, and rejects overbooking or anonymous setting changes", async () => {
  const { data, cookie, projectCookie } = await create();
  const a = await connect(data.projectId, cookie), b = await connect(data.projectId, cookie);
  let current = data;
  async function save(project: any) {
    const saved = next(a), received = next(b);
    a.send(JSON.stringify({ type: "mutation", command: command(current, project) }));
    const confirmed = await saved;
    expect((await received).project).toEqual(confirmed.project);
    current = confirmed;
    return confirmed;
  }
  await save({ ...current.project, maxPlacements: 3 });
  for (const id of ["b2", "b3"]) {
    const assigned = structuredClone(current.project);
    assigned.blocks.find((block: any) => block.id === id).people.push("maya");
    await save(assigned);
  }
  expect(current.project.blocks.filter((block: any) => block.people.includes("maya"))).toHaveLength(3);
  const rejected = next(a);
  a.send(JSON.stringify({ type: "mutation", command: command(current, { ...current.project, maxPlacements: 2 }) }));
  expect(await rejected).toMatchObject({ type: "error", status: 400 });
  const reloaded: any = await (await SELF.fetch(`${origin}/api/projects/${data.projectId}`, { headers: { cookie } })).json();
  expect(reloaded.project.maxPlacements).toBe(3);
  expect(reloaded.project.blocks.filter((block: any) => block.people.includes("maya"))).toHaveLength(3);
  const viewer = await connect(data.projectId, projectCookie);
  const denied = next(viewer);
  viewer.send(JSON.stringify({ type: "mutation", command: command(current, { ...current.project, maxPlacements: 4 }) }));
  expect(await denied).toMatchObject({ type: "error", status: 401 });
  a.close(); b.close(); viewer.close();
});
