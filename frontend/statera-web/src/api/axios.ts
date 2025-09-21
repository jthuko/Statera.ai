import axios from "axios";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api/v1`,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("statera:accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error?.response?.status === 401) {
      const refresh = localStorage.getItem("statera:refreshToken");
      if (refresh) {
        try {
          const r = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/refresh`,
            { refreshToken: refresh }
          );
          localStorage.setItem("statera:accessToken", r.data.accessToken);
          const cfg = error.config;
          cfg.headers.Authorization = `Bearer ${r.data.accessToken}`;
          return api(cfg);
        } catch (_) {
          localStorage.removeItem("statera:accessToken");
          localStorage.removeItem("statera:refreshToken");
          window.location.href = "/login";
        }
      } else {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api; // 👈 default export
