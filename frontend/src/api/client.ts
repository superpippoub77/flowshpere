import axios from "axios";
import { useAuthStore } from "../store/authStore";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const { token, currentCompanyId } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (currentCompanyId) config.headers["X-Company-Id"] = currentCompanyId;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
