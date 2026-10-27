import { digest, equalSecrets, json, randomToken } from "./security";
import { handleAuth, accountSessionKey, sessionUser } from "./auth";
export { AuthSession } from "./auth";
import { Server, type Connection, type ConnectionContext } from "partyserver";
import {
  canonicalProject,
  applyCommand,
  ProtocolError,
} from "../src/sync/protocol.js";
import { projectDocument, materializeProject } from "../src/project/changes.js";
import { guestCreature, guestName, presenceColor, PRESENCE_COLORS } from "../src/sync/presence.js";
import type { User } from "./auth";

const MAX_BODY = 512_000;
const matchesHash = async (token: string, storedHash: string) => equalSecrets(await digest(token), storedHash);
const cookieName = (id: string) => `diggy_${id.replaceAll("-", "")}`;
function sessionCookie(request: Request, id: string, token: string) {
  return `${cookieName(id)}=${token}; Path=/api/projects/${id}; HttpOnly; SameSite=Strict; Max-Age=2592000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
async function body(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY)
    throw new ProtocolError("Project is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ProtocolError("A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      throw new ProtocolError("Project is too large.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ProtocolError("Invalid JSON.");
  }
}
function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return (
    origin === new URL(request.url).origin ||
    (!origin && request.method === "GET" && !request.headers.get("upgrade"))
  );
}
type RoomRow = { document: string; revision: number; token_hash: string };
type Presence = { personId: string; name: string; color: string; signedIn: boolean; avatarUrl?: string; selectedBlock: string | null; active: boolean; seenAt: number; clientId: string };
type RoomConnection = { pendingIds: string[]; accountKey?: string | null; presence?: Presence };

export class ProjectRoom extends Server<Env> {
  static options = { hibernate: true };
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS project (singleton INTEGER PRIMARY KEY CHECK(singleton=1), document TEXT NOT NULL, revision INTEGER NOT NULL, token_hash TEXT NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS mutations (id TEXT PRIMARY KEY, payload TEXT NOT NULL, revision INTEGER NOT NULL)",
    );
  }
  private row() {
    return this.ctx.storage.sql
      .exec<RoomRow>(
        "SELECT document,revision,token_hash FROM project WHERE singleton=1",
      )
      .toArray()[0];
  }
  initialize(project: any, tokenHash: string) {
    if (this.row()) throw new ProtocolError("Project already exists.", 409);
    const document = projectDocument(canonicalProject(project));
    this.ctx.storage.sql.exec(
      "INSERT INTO project VALUES (1, ?, 1, ?)",
      JSON.stringify(document),
      tokenHash,
    );
    return {
      projectId: this.name,
      revision: 1,
      project: materializeProject(document),
      acknowledgedIds: [],
    };
  }
  private snapshot(pendingIds: readonly string[] = []) {
    const row = this.row();
    if (!row) throw new ProtocolError("Project not found.", 404);
    const acknowledgedIds = pendingIds.filter(
      (id) =>
        this.ctx.storage.sql
          .exec("SELECT id FROM mutations WHERE id=?", id)
          .toArray().length,
    );
    return {
      projectId: this.name,
      revision: row.revision,
      project: materializeProject(JSON.parse(row.document)),
      acknowledgedIds,
    };
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/session") && request.method === "POST") {
      try {
        const { token } = await body(request),
          row = this.row();
        if (
          typeof token !== "string" ||
          token.length !== 64 ||
          !row ||
          !(await matchesHash(token, row.token_hash))
        )
          return json({ error: "This invite link is invalid." }, 403);
        return json({ ok: true }, 200, {
          "set-cookie": sessionCookie(request, this.name, token),
        });
      } catch (error) {
        return this.failure(error);
      }
    }
    const cookies = request.headers.get("cookie") ?? "";
    const token = cookies
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${cookieName(this.name)}=`))
      ?.split("=")[1];
    const row = this.row();
    if (
      !token ||
      token.length !== 64 ||
      !row ||
      !(await matchesHash(token, row.token_hash))
    )
      return json(
        { error: "Open a private invite link to join this project." },
        403,
      );
    if (
      request.headers.get("upgrade")?.toLowerCase() === "websocket" &&
      [...this.getConnections()].length >= 64
    )
      return json({ error: "This project has too many open tabs." }, 429);
    return super.fetch(request);
  }
  onRequest(request: Request) {
    if (request.method !== "GET")
      return json({ error: "Method not allowed." }, 405);
    try {
      return json(this.snapshot());
    } catch (error) {
      return this.failure(error);
    }
  }
  async onConnect(connection: Connection<RoomConnection>, context: ConnectionContext) {
    const accountKey = await accountSessionKey(context.request);
    const user = await sessionUser(this.env, accountKey);
    connection.setState({ pendingIds: [], accountKey, presence: await this.identity(user, connection.id) });
    connection.send(JSON.stringify({ type: "ready" }));
    this.broadcastPresence();
  }
  private async identity(user: User | null, clientId: string): Promise<Presence> {
    const personId = user ? await digest(`${this.name}:${user.id}`) : `guest:${clientId}`;
    const connected = [...this.getConnections<RoomConnection>()].flatMap((peer) => peer.state?.presence ? [peer.state.presence] : []);
    const preferred = presenceColor(personId), start = PRESENCE_COLORS.indexOf(preferred);
    const color = connected.find((peer) => peer.personId === personId)?.color ??
      PRESENCE_COLORS.map((_, index) => PRESENCE_COLORS[(start + index) % PRESENCE_COLORS.length]).find((candidate) => !connected.some((peer) => peer.color === candidate)) ?? preferred;
    return { clientId, personId, name: user?.name ?? guestName(clientId), color,
      signedIn: Boolean(user), ...(user?.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
      selectedBlock: null, active: true, seenAt: Date.now() };
  }
  private broadcastPresence(without?: string) {
    const connections = [...this.getConnections<RoomConnection>()].filter((peer) => peer.id !== without);
    const blocks = JSON.parse(this.row()?.document ?? '{"blocks":{}}').blocks;
    const peers = connections.flatMap((peer) => {
      const p = peer.state?.presence;
      if (!p || p.seenAt < Date.now() - 65_000) return [];
      return [{ id: peer.id, personId: p.personId, name: p.signedIn ? p.name : guestName(p.clientId), color: p.color, signedIn: p.signedIn,
        ...(!p.signedIn ? { creature: guestCreature(p.clientId).id } : {}),
        ...(p.avatarUrl ? { avatarUrl: p.avatarUrl } : {}), active: p.active,
        selectedBlock: p.selectedBlock && Object.hasOwn(blocks, p.selectedBlock) ? p.selectedBlock : null }];
    });
    for (const peer of connections) peer.send(JSON.stringify({ type: "presence", selfId: peer.id, peers }));
  }
  onClose(connection: Connection) { this.broadcastPresence(connection.id); }
  onError(connection: Connection) { connection.close(1011, "Reconnect to the project."); }
  async onMessage(
    connection: Connection<RoomConnection>,
    message: string | ArrayBuffer | ArrayBufferView,
  ) {
    try {
      if (
        typeof message !== "string" ||
        new TextEncoder().encode(message).byteLength > MAX_BODY
      )
        throw new ProtocolError("Edit message is too large.", 413);
      const packet = JSON.parse(message);
      if (packet.type === "presence") {
        if (typeof packet.clientId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(packet.clientId) ||
          typeof packet.active !== "boolean" || (packet.selectedBlock !== null &&
            (typeof packet.selectedBlock !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(packet.selectedBlock))))
          throw new ProtocolError("Invalid presence update.");
        const user = await sessionUser(this.env, connection.state?.accountKey);
        const presence = await this.identity(user, packet.clientId);
        const row = this.row();
        presence.selectedBlock = packet.selectedBlock && row && Object.hasOwn(JSON.parse(row.document).blocks, packet.selectedBlock) ? packet.selectedBlock : null;
        presence.active = packet.active;
        connection.setState({ ...connection.state, pendingIds: [...(connection.state?.pendingIds ?? [])], presence });
        this.broadcastPresence();
        return;
      }
      if (packet.type === "hello") {
        if (
          !Array.isArray(packet.pendingIds) ||
          packet.pendingIds.length > 1000 ||
          !packet.pendingIds.every(
            (id: unknown) => typeof id === "string" && id.length <= 80,
          )
        )
          throw new ProtocolError("Invalid reconnect request.");
        connection.setState({ ...connection.state, pendingIds: packet.pendingIds });
        connection.send(
          JSON.stringify({
            type: "snapshot",
            ...this.snapshot(packet.pendingIds),
          }),
        );
        return;
      }
      if (packet.type !== "mutation")
        throw new ProtocolError("Unknown message.");
      // Recheck every edit: open sockets must lose write access after logout or expiry.
      if (!(await sessionUser(this.env, connection.state?.accountKey)))
        throw new ProtocolError("Sign in to make changes to this project.", 401);
      const command = packet.command,
        row = this.row();
      if (!row) throw new ProtocolError("Project not found.", 404);
      const payload = JSON.stringify(command);
      const receipt =
        typeof command?.id === "string"
          ? this.ctx.storage.sql
              .exec<{ payload: string }>(
                "SELECT payload FROM mutations WHERE id=?",
                command.id,
              )
              .toArray()[0]
          : null;
      if (receipt && receipt.payload !== payload)
        throw new ProtocolError("An edit ID was reused.", 409);
      const pendingIds = [
        ...new Set([...(connection.state?.pendingIds ?? []), command?.id]),
      ]
        .filter((id): id is string => typeof id === "string")
        .slice(-1000);
      connection.setState({ ...connection.state, pendingIds });
      if (!receipt) {
        const next = applyCommand(JSON.parse(row.document), command, this.name);
        this.ctx.storage.transactionSync(() => {
          this.ctx.storage.sql.exec(
            "UPDATE project SET document=?,revision=? WHERE singleton=1",
            JSON.stringify(next),
            row.revision + 1,
          );
          this.ctx.storage.sql.exec(
            "INSERT INTO mutations VALUES (?,?,?)",
            command.id,
            payload,
            row.revision + 1,
          );
        });
      }
      for (const peer of this.getConnections<RoomConnection>())
        peer.send(
          JSON.stringify({
            type: "snapshot",
            ...this.snapshot(peer.state?.pendingIds ?? []),
          }),
        );
      this.broadcastPresence();
    } catch (error) {
      const status = error instanceof ProtocolError ? error.status : 400;
      connection.send(
        JSON.stringify({
          type: "error",
          status,
          message: error instanceof Error ? error.message : "Invalid edit.",
          snapshot: this.row()
            ? this.snapshot(connection.state?.pendingIds ?? [])
            : null,
        }),
      );
    }
  }
  private failure(error: unknown) {
    return json(
      { error: error instanceof Error ? error.message : "Request failed." },
      error instanceof ProtocolError ? error.status : 400,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/healthz")
      return json({ ok: true, service: "diggy" });
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!originAllowed(request))
      return json(
        { error: "Use the Diggy application to access projects." },
        403,
      );
    try {
      if (url.pathname.startsWith("/api/auth/")) return await handleAuth(request, env);
      if (url.pathname === "/api/projects" && request.method === "POST") {
        if (!(await sessionUser(env, await accountSessionKey(request))))
          return json({ error: "Sign in to create a project." }, 401);
        const { success } = await env.CREATE_LIMITER.limit({
          key: request.headers.get("CF-Connecting-IP") ?? "local",
        });
        if (!success)
          return json(
            { error: "Please wait a minute before sharing another project." },
            429,
          );
        const { project } = await body(request);
        const safe = canonicalProject(project);
        const projectId = crypto.randomUUID(),
          token = randomToken();
        const room = env.PROJECTS.getByName(projectId);
        const snapshot = await room.initialize(safe, await digest(token));
        return json(
          {
            ...snapshot,
            inviteUrl: `${url.origin}/?project=${projectId}#invite=${token}`,
          },
          201,
          { "set-cookie": sessionCookie(request, projectId, token) },
        );
      }
      const route = url.pathname.match(
        /^\/api\/projects\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})(?:\/(session|socket))?$/,
      );
      if (!route) return json({ error: "Not found." }, 404);
      if (
        route[2] === "socket" &&
        request.headers.get("upgrade")?.toLowerCase() !== "websocket"
      )
        return json({ error: "A WebSocket connection is required." }, 426);
      if (route[2] !== "socket" && request.headers.get("upgrade"))
        return json({ error: "Not found." }, 404);
      return env.PROJECTS.getByName(route[1]).fetch(request);
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Request failed." },
        error instanceof ProtocolError ? error.status : 400,
      );
    }
  },
} satisfies ExportedHandler<Env>;
