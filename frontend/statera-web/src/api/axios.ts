import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

// Dev/proxy: Vite proxies "/api" -> "http://localhost:5199".
// Keep endpoints RELATIVE to /api/v1 (e.g., "/staff", "/auth/login", etc.).
const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: false,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ---- Safe header mutation helpers (avoid reassigning typed headers) ----
function ensureHeadersObject(
  headers: InternalAxiosRequestConfig["headers"] | AxiosRequestConfig["headers"] | undefined
) {
  if (!headers) return {} as any;
  return headers as any;
}
function setHeaderMut(
  headers: InternalAxiosRequestConfig["headers"] | AxiosRequestConfig["headers"] | undefined,
  key: string,
  value: string
) {
  const h = ensureHeadersObject(headers);
  if (typeof h.set === "function") {
    // AxiosHeaders instance
    h.set(key, value);
  } else {
    // Plain object
    h[key] = value;
  }
  return h;
}

// ---------- Token attachment ----------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("statera:accessToken");
  if (token) {
    // mutate safely, don't replace the headers type
    config.headers = setHeaderMut(config.headers, "Authorization", `Bearer ${token}`);
  }

  // Optional: enable if your API expects facility scope in header
  // const facilityId = localStorage.getItem("statera:facilityId");
  // if (facilityId) {
  //   config.headers = setHeaderMut(config.headers, "X-Facility-Id", facilityId);
  // }

  return config;
});

// ---------- Refresh logic (single-flight) ----------
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
const refreshSubscribers: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}
function notifyTokenRefreshed(token: string | null) {
  while (refreshSubscribers.length) {
    const fn = refreshSubscribers.shift();
    fn?.(token);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = localStorage.getItem("statera:refreshToken");
  if (!refreshToken) return null;

  isRefreshing = true;
  refreshPromise = api
    .post("/auth/refresh", { refreshToken })
    .then((rr: AxiosResponse) => {
      const newAccess = (rr.data as any)?.accessToken as string | undefined;
      if (newAccess) {
        localStorage.setItem("statera:accessToken", newAccess);
        return newAccess;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

  const token = await refreshPromise;
  notifyTokenRefreshed(token);
  return token;
}

// Utility: detect auth endpoints to avoid loops
function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url, "http://local");
    return u.pathname.startsWith("/auth");
  } catch {
    return url.startsWith("/auth");
  }
}

// ---------- Response interceptor with retry on 401 ----------
api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const status = err?.response?.status;
    const original = (err.config || {}) as AxiosRequestConfig;

    if (status !== 401) {
      return Promise.reject(err);
    }

    // Avoid loops for auth endpoints
    if (isAuthEndpoint(original.url)) {
      localStorage.removeItem("statera:accessToken");
      localStorage.removeItem("statera:refreshToken");
      window.location.href = "/login";
      return Promise.reject(err);
    }

    // If a refresh is already in progress, wait and then retry
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          if (!newToken) {
            localStorage.removeItem("statera:accessToken");
            localStorage.removeItem("statera:refreshToken");
            window.location.href = "/login";
            reject(err);
            return;
          }
          const retryCfg: AxiosRequestConfig = { ...original };
          // ensure headers object exists, then mutate
          retryCfg.headers = ensureHeadersObject(retryCfg.headers);
          setHeaderMut(retryCfg.headers, "Authorization", `Bearer ${newToken}`);
          // Ensure baseURL present (Axios may strip it on retry)
          retryCfg.baseURL = retryCfg.baseURL ?? api.defaults.baseURL;
          resolve(api.request(retryCfg));
        });
      });
    }

    // Start refresh ourselves
    const newToken = await refreshAccessToken();

    if (!newToken) {
      localStorage.removeItem("statera:accessToken");
      localStorage.removeItem("statera:refreshToken");
      window.location.href = "/login";
      return Promise.reject(err);
    }

    const retryCfg: AxiosRequestConfig = { ...original };
    retryCfg.headers = ensureHeadersObject(retryCfg.headers);
    setHeaderMut(retryCfg.headers, "Authorization", `Bearer ${newToken}`);
    retryCfg.baseURL = retryCfg.baseURL ?? api.defaults.baseURL;

    return api.request(retryCfg);
  }
);

export default api;
