import type { Catalog, Me } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = "Algo deu errado. Tente de novo.";
    if (typeof data.detail === "string") msg = data.detail;
    else if (Array.isArray(data.detail) && data.detail[0]?.msg) msg = String(data.detail[0].msg).replace(/^Value error, /, "");
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  me: () => call<Me>("GET", "/api/me"),
  catalog: () => call<Catalog>("GET", "/api/catalog"),
  register: (b: { email: string; password: string; nickname: string; code: string }) =>
    call<{ id: number; role: string }>("POST", "/api/auth/register", b),
  login: (b: { email: string; password: string }) => call<{ id: number; role: string }>("POST", "/api/auth/login", b),
  logout: () => call<void>("POST", "/api/auth/logout"),
  saveCharacter: (b: unknown) => call<{ ok: boolean }>("PUT", "/api/me/character", b),
  createSession: () => call<{ code: string }>("POST", "/api/sessions"),
  checkSession: (code: string) => call<{ code: string }>("GET", `/api/sessions/${encodeURIComponent(code)}`),
};
