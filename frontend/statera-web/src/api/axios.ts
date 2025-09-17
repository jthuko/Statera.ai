// src/lib/http.ts
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: false,       // set true only if you use cookie auth
  timeout: 30000
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("accessToken");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export default api;
