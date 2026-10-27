import { env, runInDurableObject, runDurableObjectAlarm } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../worker/index";
import { digest } from "../../worker/security";
import { demo } from "../../src/project/project.js";
import { applyMasonry } from "../../masonry.js";

const origin = "https://diggy.test";
const configured = () => ({ ...env, GOOGLE_CLIENT_ID: "google-test-id", GOOGLE_CLIENT_SECRET: "google-test-secret",
  GITHUB_CLIENT_ID: "github-test-id", GITHUB_CLIENT_SECRET: "github-test-secret" });
const request = (path: string, init: RequestInit = {}, bindings = configured()) =>
  worker.fetch(new Request(`${origin}${path}`, init), bindings);
const cookies = (response: Response) => response.headers.getSetCookie();
const cookieValue = (response: Response, name: string) => cookies(response).find((value) => value.startsWith(`${name}=`))!.split(";")[0];
async function start(provider = "google", returnTo = "/") {
  const response = await request(`/api/auth/${provider}/start?${new URLSearchParams({ returnTo })}`, {
    headers: { "cf-connecting-ip": crypto.randomUUID() },
  });
  expect(response.status).toBe(303);
  const destination = new URL(response.headers.get("location")!);
  return { destination, state: destination.searchParams.get("state")!, cookie: cookieValue(response, `diggy_oauth_${provider}`), response };
}
const callback = (provider: string, state: string, cookie: string, extra = "code=provider-code") =>
  request(`/api/auth/${provider}/callback?state=${state}&${extra}`, { headers: { cookie } });
function mockProvider(provider: string, profile: object) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    // Construct a real workerd Request so mocks retain the runtime's validation.
    const outgoing = new Request(input, init);
    const url = outgoing.url;
    if (url.includes("/token") || url.includes("/access_token")) {
      const body = await outgoing.formData();
      expect(body.get("client_secret")).toBe(`${provider}-test-secret`);
      expect(body.get("redirect_uri")).toBe(`${origin}/api/auth/${provider}/callback`);
      expect(body.get("code_verifier")).toMatch(/^[a-f0-9]{64}$/);
      return Response.json({ access_token: "provider-access-token", refresh_token: "provider-refresh-token" });
    }
    expect(outgoing.headers.get("authorization")).toBe("Bearer provider-access-token");
    return Response.json(profile);
  });
}
afterEach(() => vi.restoreAllMocks());

describe("OAuth sign-in", () => {
  it("advertises configured providers without requiring an account", async () => {
    const response = await request("/api/auth/session");
    expect(await response.json()).toEqual({ user: null, providers: { google: true, github: true } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const missing = { ...configured(), GOOGLE_CLIENT_ID: "", GITHUB_CLIENT_SECRET: "" };
    expect(await (await request("/api/auth/session", {}, missing)).json()).toEqual({ user: null, providers: { google: false, github: false } });
    expect((await request("/api/auth/google/start", {}, missing)).headers.get("location")).toBe("/?authError=unavailable");
  });
  it.each(["google", "github"])("uses random browser-bound state and PKCE for %s", async (provider) => {
    const flow = await start(provider), second = await start(provider);
    expect(flow.state).toMatch(/^[a-f0-9]{64}$/);
    expect(flow.state).not.toBe(second.state);
    expect(flow.destination.searchParams.get("code_challenge_method")).toBe("S256");
    expect(flow.destination.searchParams.get("code_challenge")).toMatch(/^[\w-]{43}$/);
    const cookie = cookies(flow.response)[0];
    expect(cookie).toContain("HttpOnly; SameSite=Lax; Max-Age=600; Secure");
    const saved = await runInDurableObject(env.AUTH_SESSIONS.getByName(`flow:${await digest(flow.state)}`), (_, state) =>
      state.storage.kv.get<any>("record").value);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(saved.verifier)));
    const challenge = btoa(String.fromCharCode(...hash)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    expect(flow.destination.searchParams.get("code_challenge")).toBe(challenge);
  });
  it.each([
    ["google", { sub: "g-123", name: "Google Digger" }, "google:g-123", "Google Digger"],
    ["github", { id: 42, login: "octodigger", name: null }, "github:42", "octodigger"],
  ])("completes %s sign-in, preserves the project, and revokes sign-out", async (provider, profile, id, name) => {
    const returnTo = "/?project=6a309a04-02cd-4569-bdbd-1c3bbdb96c4f";
    const flow = await start(provider, returnTo);
    const fetch = mockProvider(provider, profile);
    const response = await callback(provider, flow.state, flow.cookie);
    expect(response.headers.get("location")).toBe(returnTo);
    expect(fetch).toHaveBeenCalledTimes(2);
    const cookie = cookieValue(response, "diggy_account");
    expect(cookie.split("=")[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(cookies(response).find((value) => value.startsWith("diggy_account="))).toContain("HttpOnly; SameSite=Lax; Max-Age=2592000; Secure");
    expect(cookies(response)).toContainEqual(expect.stringContaining("diggy_account=; Path=/api/auth;"));
    expect(cookies(response).find((value) => value.startsWith(cookie + ";"))).toContain("Path=/api;");
    const session = await request("/api/auth/session", { headers: { cookie } });
    expect((await session.json() as any).user).toEqual({ id, name, provider });
    expect(cookies(session)).toContainEqual(expect.stringContaining(`${cookie}; Path=/api;`));
    const stored = await runInDurableObject(env.AUTH_SESSIONS.getByName(`session:${await digest(cookie.split("=")[1])}`), (_, state) =>
      JSON.stringify(state.storage.kv.get("record")));
    expect(stored).not.toContain("provider-access-token");
    expect(stored).not.toContain("provider-refresh-token");
    const replay = await callback(provider, flow.state, flow.cookie);
    expect(replay.headers.get("location")).toContain("authError=expired");
    expect(fetch).toHaveBeenCalledTimes(2);
    const logout = await request("/api/auth/logout", { method: "POST", headers: { origin, cookie } });
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(cookies(logout)).toContainEqual(expect.stringContaining("Path=/api/auth;"));
    expect(cookies(logout)).toContainEqual(expect.stringContaining("Path=/api;"));
    expect((await (await request("/api/auth/session", { headers: { cookie } })).json() as any).user).toBeNull();
  });
  it("rejects missing/mismatched browser state and swapped providers before contacting OAuth", async () => {
    const flow = await start(), fetch = vi.spyOn(globalThis, "fetch");
    for (const cookie of ["", `diggy_oauth_google=${"f".repeat(64)}`])
      expect((await callback("google", flow.state, cookie)).headers.get("location")).toContain("authError=invalid_state");
    const swapped = await callback("github", flow.state, flow.cookie.replace("google", "github"));
    expect(swapped.headers.get("location")).toContain("authError=expired");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    ["github", "https://avatars.githubusercontent.com/u/42", true],
    ["google", "https://lh3.googleusercontent.com/a/example", true],
    ["github", "https://unexpected.example/avatar", false],
  ])("keeps only a supported provider photo for %s", async (provider, url, allowed) => {
    const flow = await start(provider);
    mockProvider(provider, provider === "github" ? { id: 42, login: "digger", avatar_url: url } : { sub: "g-42", name: "Digger", picture: url });
    const response = await callback(provider, flow.state, flow.cookie);
    const cookie = cookieValue(response, "diggy_account");
    const user = (await (await request("/api/auth/session", { headers: { cookie } })).json() as any).user;
    expect(user.avatarUrl).toBe(allowed ? url : undefined);
  });
  it("rejects expired flows and clears cancelled flows", async () => {
    const expired = await start(), stub = env.AUTH_SESSIONS.getByName(`flow:${await digest(expired.state)}`);
    await runInDurableObject(stub, (_, state) => { state.storage.kv.put("record", { ...state.storage.kv.get<any>("record"), expires: 0 }); });
    expect((await callback("google", expired.state, expired.cookie)).headers.get("location")).toContain("authError=expired");
    const cancelled = await start();
    const response = await callback("google", cancelled.state, cancelled.cookie, "error=access_denied");
    expect(response.headers.get("location")).toContain("authError=cancelled");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await runDurableObjectAlarm(stub)).toBe(true);
  });
  it("handles provider failure without leaking its response or creating a session", async () => {
    const flow = await start();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "sensitive-provider-detail" }, { status: 401 }));
    const response = await callback("google", flow.state, flow.cookie);
    expect(response.headers.get("location")).toBe("/?authError=failed");
    expect(cookies(response).some((value) => value.startsWith("diggy_account="))).toBe(false);
    expect(await response.text()).not.toContain("sensitive-provider-detail");
  });
  it.each(["token", "profile"])("rejects a redirect from the %s endpoint without forwarding credentials", async (stage) => {
    const flow = await start("github");
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const outgoing = new Request(input, init);
      expect(outgoing.redirect).toBe("manual");
      if (outgoing.url.endsWith("/access_token") && stage === "profile")
        return Response.json({ access_token: "provider-access-token" });
      return new Response(null, { status: 307, headers: { location: "https://unexpected.example/" } });
    });
    const response = await callback("github", flow.state, flow.cookie);
    expect(response.headers.get("location")).toBe("/?authError=failed");
    expect(fetch).toHaveBeenCalledTimes(stage === "token" ? 1 : 2);
    expect(cookies(response).some((value) => value.startsWith("diggy_account="))).toBe(false);
  });
  it.each(["https://evil.test/", "//evil.test/", "/api/auth/logout", "/?project=1", "/#invite=secret"])("discards an unsafe return URL: %s", async (returnTo) => {
    const flow = await start("github", returnTo);
    expect((await callback("github", flow.state, flow.cookie, "error=access_denied")).headers.get("location")).toBe("/?authError=cancelled");
  });
  it("blocks cross-origin sign-out and keeps account cookies separate from project capabilities", async () => {
    const flow = await start();
    mockProvider("google", { sub: "private-account", name: "Digger" });
    const account = cookieValue(await callback("google", flow.state, flow.cookie), "diggy_account");
    expect((await request("/api/auth/logout", { method: "POST", headers: { cookie: account, origin: "https://evil.test" } })).status).toBe(403);
    const project = demo(); applyMasonry(project);
    const created = await request("/api/projects", { method: "POST", headers: { origin, cookie: account, "cf-connecting-ip": crypto.randomUUID() }, body: JSON.stringify({ project }) });
    const data: any = await created.json();
    expect(created.status).toBe(201);
    expect(data.projectId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    const token = new URL(data.inviteUrl).hash.slice("#invite=".length);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect((await request(`/api/projects/${data.projectId}`, { headers: { cookie: account } })).status).toBe(403);
    expect((await request(`/api/projects/${data.projectId}/socket`, { headers: { cookie: account, origin, upgrade: "websocket" } })).status).toBe(403);
    expect((await request(`/api/projects/${data.projectId}/session`, { method: "POST", headers: { origin }, body: JSON.stringify({ token }) })).status).toBe(200);
    expect((await request(`/api/projects/${"0".repeat(36)}`)).status).toBe(404);
    expect((await request("/api/projects" )).status).toBe(404);
    const projectCookie = cookieValue(created, `diggy_${data.projectId.replaceAll("-", "")}`);
    await request("/api/auth/logout", { method: "POST", headers: { cookie: account, origin } });
    expect((await request(`/api/projects/${data.projectId}`, { headers: { cookie: projectCookie } })).status).toBe(200);
  });
});
