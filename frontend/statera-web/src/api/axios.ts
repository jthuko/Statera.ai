import axios from "axios";

// Dev/proxy approach: always use relative base so Vite proxies to the API.
// Your vite.config.ts already proxies "/api" -> "http://localhost:5199".
const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("statera:accessToken");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error?.response?.status === 401) {
      const refresh = localStorage.getItem("statera:refreshToken");
      if (refresh) {
        try {
          // Use the same instance so it respects baseURL/proxy
          const rr = await api.post("/auth/refresh", { refreshToken: refresh });

          const newAccess = rr.data?.accessToken;
          if (typeof newAccess === "string" && newAccess) {
            localStorage.setItem("statera:accessToken", newAccess);
            const cfg = error.config ?? {};
            cfg.headers = cfg.headers ?? {};
            (cfg.headers as Record<string, string>)["Authorization"] = `Bearer ${newAccess}`;
            return api(cfg);
          }
        } catch {
          // fall through to logout below
        }
      }
      localStorage.removeItem("statera:accessToken");
      localStorage.removeItem("statera:refreshToken");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
