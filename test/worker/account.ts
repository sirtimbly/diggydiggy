import { env } from "cloudflare:test";
import { digest, randomToken } from "../../worker/security";

export async function accountSession(age = 3600) {
  const token = randomToken(), key = await digest(token);
  await env.AUTH_SESSIONS.getByName(`session:${key}`).initialize({
    kind: "session", user: { id: "github:42", name: "Digger", provider: "github" },
  }, age);
  return { cookie: `diggy_account=${token}`, key };
}
