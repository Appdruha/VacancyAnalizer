import type { AuthSession, SessionUser } from "./types.js";

const TOKEN_STORAGE_KEY = "edagent_auth_token";
const USER_STORAGE_KEY = "edagent_auth_user";

export function saveSession(session: AuthSession): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getSavedUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}
