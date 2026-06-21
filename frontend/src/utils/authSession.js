const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function saveAuthTokens({ access, refresh }) {
  if (access) {
    localStorage.setItem(ACCESS_KEY, access);
  }
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  }
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem("userRole");
  localStorage.removeItem("sellerStatus");
  localStorage.removeItem("username");
  localStorage.removeItem("sellerStoreName");
}

export async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/api/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.access) {
      return null;
    }

    localStorage.setItem(ACCESS_KEY, data.access);
    return data.access;
  } catch {
    return null;
  }
}

let sessionExpiredHandler = null;

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
}

export function notifySessionExpired() {
  if (sessionExpiredHandler) {
    sessionExpiredHandler();
  }
}

export async function fetchWithAuth(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(url, { ...options, headers });

  if (response.status !== 401) {
    return response;
  }

  const newToken = await refreshAccessToken();
  if (!newToken) {
    notifySessionExpired();
    return response;
  }

  headers.set("Authorization", `Bearer ${newToken}`);
  return fetch(url, { ...options, headers });
}
