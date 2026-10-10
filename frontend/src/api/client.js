import axios from "axios";

export const TOKEN_KEY = "gcs-guard-token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api",
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Google ID tokens expire after an hour; send the user back to sign in.
api.interceptors.response.use(undefined, (error) => {
  if (error.response?.status === 401 && sessionStorage.getItem(TOKEN_KEY)) {
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.assign("/login");
  }
  return Promise.reject(error);
});

export const errorMessage = (err) => err.response?.data?.error || err.message;

const b = encodeURIComponent;

export const getMe = () => api.get("/me");
export const getAuditLog = () => api.get("/audit-log");

export const getBuckets = () => api.get("/buckets");
export const getBucket = (name) => api.get(`/buckets/${b(name)}`);
export const getObjects = (name) => api.get(`/buckets/${b(name)}/objects`);
export const getReport = (name) => api.get(`/buckets/${b(name)}/report`);

export const auditAcls = (name) => api.get(`/acl-audit/${b(name)}`);

export const getIamPolicy = (name) => api.get(`/iam/${b(name)}/policy`);
export const addIamBinding = (name, member, role) =>
  api.post(`/iam/${b(name)}/bindings`, { member, role });
export const removeIamBinding = (name, member, role) =>
  api.delete(`/iam/${b(name)}/bindings`, { data: { member, role } });
export const testPermissions = (name, permissions) =>
  api.post(`/iam/${b(name)}/test-permissions`, { permissions });

export const getUblaPreflight = (name) => api.get(`/ubla/${b(name)}/preflight`);
export const enableUbla = (name) => api.post(`/ubla/${b(name)}/enable`, { confirmation: "ENABLE UBLA" });

export const getTests = (name) => api.get(`/tests/${b(name)}`);
export const runAclProbe = (name) => api.post(`/tests/${b(name)}/acl-probe`);
export const runDownloadAs = (name, body) => api.post(`/tests/${b(name)}/download`, body);

export default api;
