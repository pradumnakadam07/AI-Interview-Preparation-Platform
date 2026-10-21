import axios from "axios";

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? "", timeout: 45_000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("interviewlab_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function messageFromError(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (axios.isAxiosError(error)) return error.response?.data?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}
