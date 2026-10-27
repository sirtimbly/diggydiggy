import { DurableObject } from "cloudflare:workers";
import { digest, equalSecrets, json, randomToken, readCookie } from "./security";

type Provider = "google" | "github";
export type User = { id: string; name: string; provider: Provider; avatarUrl?: string };
type Flow = {
  kind: "flow"; provider: Provider; origin: string; returnTo: string; verifier: string;
};
type Session = { kind: "session"; user: User };
type StoredRecord = { value: Flow | Session; expires: number };
const SESSION_AGE = 30 * 24 * 60 * 60;
const FLOW_AGE = 10 * 60;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const providers = {
  google: {
    authorization: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    profile: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid profile",
  },
  github: {
    authorization: "https://github.com/login/oauth/authorize",
    token: "https://github.com/login/oauth/access_token",
    profile: "https://api.github.com/user",
    scope: "read:user",
  },
} as const;

// Each random flow/session has its own object. No user directory or project ACL.
export class AuthSession extends DurableObject<Env> {
  async initialize(value: Flow | Session, age: number) {
    const expires = Date.now() + age * 1000;
    if (this.ctx.storage.kv.get("record")) throw new Error("Session already exists.");
    this.ctx.storage.kv.put("record", { value, expires });
    await this.ctx.storage.setAlarm(expires);
  }
  private read(): Flow | Session | null {
    const row = this.ctx.storage.kv.get<StoredRecord>("record");
    return row && row.expires > Date.now() ? row.value : null;
  }
  consume(provider: Provider, origin: string): Flow | null {
    const value = this.read();
    if (value?.kind !== "flow" || value.provider !== provider || value.origin !== origin) return null;
    // Synchronous consume prevents duplicate callbacks from exchanging the code twice.
    this.ctx.storage.kv.delete("record");
    return value;
  }
  user(): User | null {
    const value = this.read();
    return value?.kind === "session" ? value.user : null;
  }
  async revoke() { await this.ctx.storage.deleteAll(); }
  async alarm() { await this.ctx.storage.deleteAll(); }
}

function credentials(env: Env, provider: Provider) {
  return provider === "google"
    ? { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET }
    : { id: env.GITHUB_CLIENT_ID, secret: env.GITHUB_CLIENT_SECRET };
}
function cookie(request: Request, name: string, value: string, age: number, path = name === "diggy_account" ? "/api" : "/api/auth") {
  return `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
const clearLegacyAccount = (request: Request) => cookie(request, "diggy_account", "", 0, "/api/auth");
export async function accountSessionKey(request: Request) {
  const token = readCookie(request, "diggy_account");
  return token && TOKEN_PATTERN.test(token) ? await digest(token) : null;
}
export async function sessionUser(env: Env, key: string | null | undefined) {
  return key ? await env.AUTH_SESSIONS.getByName(`session:${key}`).user() : null;
}
function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ location, "cache-control": "no-store", "referrer-policy": "no-referrer" });
  for (const value of cookies) headers.append("set-cookie", value);
  return new Response(null, { status: 303, headers });
}
function returnPath(value: string | null) {
  // Only return to the local draft or a project. Never forward arbitrary redirects or invite tokens.
  if (value === "/") return "/";
  return value && /^\/\?project=[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value) ? value : "/";
}
async function object(env: Env, kind: "flow" | "session", token: string) {
  return env.AUTH_SESSIONS.getByName(`${kind}:${await digest(token)}`);
}
async function providerJSON(url: string, init: RequestInit) {
  // Workers supports manual/follow only. Reject 3xx below without forwarding credentials.
  const response = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(10_000) });
  if (!response.ok || !response.body) throw new Error("Provider request failed.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32_000) { await reader.cancel(); throw new Error("Provider response too large."); }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}
async function identity(provider: Provider, code: string, verifier: string, callback: string, env: Env): Promise<User> {
  const config = providers[provider], client = credentials(env, provider);
  const tokens = await providerJSON(config.token, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client.id, client_secret: client.secret, code,
      redirect_uri: callback, grant_type: "authorization_code", code_verifier: verifier }),
  });
  if (typeof tokens.access_token !== "string" || tokens.error) throw new Error("No access token.");
  const profile = await providerJSON(config.profile, { headers: {
    accept: "application/json", authorization: `Bearer ${tokens.access_token}`, "user-agent": "Diggy",
  } });
  const subject = provider === "google" ? profile.sub : profile.id;
  if (provider === "google" ? typeof subject !== "string" || !subject : !Number.isSafeInteger(subject) || subject <= 0)
    throw new Error("Invalid profile.");
  const name = profile.name || (provider === "github" ? profile.login : "Google user");
  if (typeof name !== "string") throw new Error("Invalid profile name.");
  // Provider tokens are used only for this lookup and are never persisted or sent to the browser.
  const picture = provider === "github" ? profile.avatar_url : profile.picture;
  let avatarUrl: string | undefined;
  if (typeof picture === "string" && picture.length < 2048) {
    try {
      const avatar = new URL(picture);
      if (avatar.protocol === "https:" && !avatar.username && !avatar.password &&
        (provider === "github" ? avatar.hostname === "avatars.githubusercontent.com" : avatar.hostname.endsWith(".googleusercontent.com"))) avatarUrl = avatar.href;
    } catch { /* Initials work when the provider has no usable photo. */ }
  }
  return { id: `${provider}:${subject}`, name: name.slice(0, 120), provider, ...(avatarUrl ? { avatarUrl } : {}) };
}

export async function handleAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    const token = readCookie(request, "diggy_account");
    const user = await sessionUser(env, await accountSessionKey(request));
    const response = json({ user, providers: Object.fromEntries((Object.keys(providers) as Provider[]).map((provider) => {
      const client = credentials(env, provider);
      return [provider, Boolean(client.id && client.secret)];
    })) });
    // Upgrade existing sessions so the account cookie also reaches project APIs.
    response.headers.append("set-cookie", clearLegacyAccount(request));
    if (user && token) response.headers.append("set-cookie", cookie(request, "diggy_account", token, SESSION_AGE));
    return response;
  }
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const token = readCookie(request, "diggy_account");
    if (token && TOKEN_PATTERN.test(token)) await (await object(env, "session", token)).revoke();
    const response = json({ ok: true }, 200, { "set-cookie": cookie(request, "diggy_account", "", 0) });
    response.headers.append("set-cookie", clearLegacyAccount(request));
    return response;
  }
  const route = url.pathname.match(/^\/api\/auth\/(google|github)\/(start|callback)$/);
  if (!route || request.method !== "GET") return json({ error: "Not found." }, 404);
  const provider = route[1] as Provider, flowCookie = `diggy_oauth_${provider}`;
  const clearFlow = cookie(request, flowCookie, "", 0);
  if (route[2] === "start") {
    const returnTo = returnPath(url.searchParams.get("returnTo"));
    const unavailable = (reason: string) => {
      const destination = new URL(returnTo, url.origin);
      destination.searchParams.set("authError", reason);
      return redirect(destination.pathname + destination.search);
    };
    const client = credentials(env, provider);
    if (!client.id || !client.secret) return unavailable("unavailable");
    const { success } = await env.CREATE_LIMITER.limit({ key: `auth:${request.headers.get("CF-Connecting-IP") ?? "local"}` });
    if (!success) return unavailable("rate_limited");
    const state = randomToken(), verifier = randomToken();
    await (await object(env, "flow", state)).initialize({ kind: "flow", provider, origin: url.origin,
      returnTo, verifier }, FLOW_AGE);
    const authorization = new URL(providers[provider].authorization);
    const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const challenge = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    authorization.search = new URLSearchParams({ client_id: client.id, redirect_uri: `${url.origin}/api/auth/${provider}/callback`,
      response_type: "code", scope: providers[provider].scope, state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
    return redirect(authorization.href, [cookie(request, flowCookie, state, FLOW_AGE)]);
  }
  const state = url.searchParams.get("state"), saved = readCookie(request, flowCookie);
  if (!state || !saved || !TOKEN_PATTERN.test(state) || !equalSecrets(state, saved))
    return redirect("/?authError=invalid_state", [clearFlow]);
  const flow = await (await object(env, "flow", state)).consume(provider, url.origin);
  if (!flow) return redirect("/?authError=expired", [clearFlow]);
  const failed = (reason: string) => {
    const destination = new URL(flow.returnTo, url.origin);
    destination.searchParams.set("authError", reason);
    return redirect(destination.pathname + destination.search, [clearFlow]);
  };
  if (url.searchParams.has("error")) return failed("cancelled");
  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) return failed("failed");
  try {
    const user = await identity(provider, code, flow.verifier, `${url.origin}/api/auth/${provider}/callback`, env);
    const token = randomToken();
    await (await object(env, "session", token)).initialize({ kind: "session", user }, SESSION_AGE);
    const previous = readCookie(request, "diggy_account");
    if (previous && TOKEN_PATTERN.test(previous)) await (await object(env, "session", previous)).revoke();
    return redirect(flow.returnTo, [clearFlow, cookie(request, "diggy_account", token, SESSION_AGE), clearLegacyAccount(request)]);
  } catch {
    return failed("failed");
  }
}
