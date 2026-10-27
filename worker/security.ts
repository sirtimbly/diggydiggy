import { timingSafeEqual } from "node:crypto";

export const randomToken = () =>
  [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const digest = async (value: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export function equalSecrets(a: string, b: string) {
  const left = new TextEncoder().encode(a), right = new TextEncoder().encode(b);
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

export function readCookie(request: Request, name: string) {
  return (request.headers.get("cookie") ?? "").split(";")
    .map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(data, { status, headers: {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  } });
