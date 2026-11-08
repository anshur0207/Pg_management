export const SESSION_COOKIE = "pgm_session_started";
export const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;
export const SESSION_DURATION_SECONDS = SESSION_DURATION_MS / 1000;
const REMEMBER_ME_KEY = "pgm_remember_me";

export function isSessionExpired(startedAt: string | undefined, now = Date.now()) {
  const timestamp = Number(startedAt);
  return !Number.isFinite(timestamp) || timestamp <= 0 || now < timestamp || now - timestamp >= SESSION_DURATION_MS;
}

export function getRememberMePreference() {
  return typeof window !== "undefined" && window.localStorage.getItem(REMEMBER_ME_KEY) === "true";
}

export function setRememberMePreference(rememberMe: boolean) {
  if (typeof window === "undefined") return;
  if (rememberMe) window.localStorage.setItem(REMEMBER_ME_KEY, "true");
  else window.localStorage.removeItem(REMEMBER_ME_KEY);
}

export function clearRememberMePreference() {
  if (typeof window !== "undefined") window.localStorage.removeItem(REMEMBER_ME_KEY);
}

export function setSessionStartCookie(rememberMe = false) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const maxAge = rememberMe ? `; Max-Age=${SESSION_DURATION_SECONDS}` : "";
  document.cookie = `${SESSION_COOKIE}=${Date.now()}; Path=/; SameSite=Lax${maxAge}${secure}`;
}

export function clearSessionStartCookie() {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getSessionStartFromDocument() {
  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${SESSION_COOKIE}=`));

  return cookie?.slice(SESSION_COOKIE.length + 1);
}