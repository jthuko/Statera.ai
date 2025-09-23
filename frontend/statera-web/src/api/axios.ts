// src/api/axios.ts
import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";

// Dev/proxy: Vite proxies "/api" -> "http://localhost:5199".
// Keep endpoints RELATIVE to /api/v1 (e.g., "/staff", "/auth/login", etc.).
const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: false,
});

// Helper to set a header safely for Axios v1 types
function setHeader(
  headers: InternalAxiosRequestConfig["headers"] | AxiosRequestConfig["headers"] | undefined,
  key: string,
  value: string
) {
  if (!headers) return { [key]: value } as Record<string, string>;
  // Axios v1: AxiosHeaders has .set()
  const maybeAxiosHeaders = headers as any;
  if (typeof maybeAxiosHeaders.set === "function") {
    maybeAxiosHeaders.set(key, value);
    return headers;
  }
  // Fallback: normal object merge
  return { ...(headers as Record<string, string>), [key]: value };
}

// Attach access token if present
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("statera:accessToken");
  if (token) {
    config.headers = setHeader(config.headers, "Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const status = err?.response?.status;

    if (status === 401) {
      const refresh = localStorage.getItem("statera:refreshToken");

      if (refresh) {
        try {
          // Refresh using same instance so baseURL/proxy apply
          const rr = await api.post("/auth/refresh", { refreshToken: refresh });
          const newAccess = (rr.data as any)?.accessToken as string | undefined;

          if (newAccess) {
            localStorage.setItem("statera:accessToken", newAccess);

            // Retry the original request with the new token
            const original = (err.config || {}) as AxiosRequestConfig;
            original.headers = setHeader(original.headers, "Authorization", `Bearer ${newAccess}`);
            return api.request(original);
          }
        } catch {
          // fall through to logout below
        }
      }

      // No refresh token or refresh failed -> clear and redirect to login
      localStorage.removeItem("statera:accessToken");
      localStorage.removeItem("statera:refreshToken");
      window.location.href = "/login";
    }

    return Promise.reject(err);
  }
);

export default api;
