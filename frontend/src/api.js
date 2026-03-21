/**
 * api.js — cliente HTTP para o backend TeleVault
 */

import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8001";

const http = axios.create({
  baseURL: BASE,
  timeout: 30_000,
  withCredentials: true,
});

const httpUpload = axios.create({
  baseURL: BASE,
  timeout: 0,
  withCredentials: true,
});

// ── AUTH ─────────────────────────────────────────────────────────────────────
export const auth = {
  status:   ()           => http.get("/api/auth/status"),
  sendCode: (phone)      => http.post("/api/auth/send-code", { phone }),
  signIn:   (code, pwd)  => http.post("/api/auth/sign-in", { code, password: pwd }),
  signOut:  ()           => http.post("/api/auth/sign-out"),
  me:       ()           => http.get("/api/auth/me"),
};

// ── CHANNELS ─────────────────────────────────────────────────────────────────
export const channels = {
  list:   ()        => http.get("/api/channels/list"),
  create: (title)   => http.post("/api/channels/create", { title }),
};

// ── FILES ─────────────────────────────────────────────────────────────────────
export const files = {
  list:   (channelId, limit = 100) => http.get(`/api/files/list/${channelId}`, { params: { limit } }),
  delete: (channelId, messageId)   => http.delete(`/api/files/${channelId}/${messageId}`),

  upload: (channelId, file, onHttpProgress) => {
    const form = new FormData();
    form.append("file", file);
    return httpUpload.post(`/api/files/upload/${channelId}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onHttpProgress,
    });
  },

  streamUploadProgress(uploadId, onMessage) {
    const es = new EventSource(`${BASE}/api/files/upload-progress/${uploadId}`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      onMessage(data);
      if (data.done || data.error) es.close();
    };
    es.onerror = () => es.close();
    return es;
  },

  downloadUrl: (channelId, messageId) => `${BASE}/api/files/download/${channelId}/${messageId}`,

  async downloadWithProgress(channelId, messageId, filename, onProgress) {
    const url = `${BASE}/api/files/download/${channelId}/${messageId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download falhou: ${response.status}`);

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      if (onProgress && total) {
        onProgress(Math.round((loaded / total) * 100), loaded, total);
      }
    }

    const blob = new Blob(chunks);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  },
};

// ── BACKUP ────────────────────────────────────────────────────────────────────
export const backup = {
  start: (channelId, paths, folderMap = {}) =>
    http.post("/api/backup/start", { channel_id: channelId, paths, folder_map: folderMap }),

  cancel: (jobId) => http.post(`/api/backup/cancel/${jobId}`),
  pause:  (jobId) => http.post(`/api/backup/pause/${jobId}`),
  resume: (jobId) => http.post(`/api/backup/resume/${jobId}`),
  jobs: (limit = 20) => http.get("/api/backup/jobs", { params: { limit } }),

  streamProgress(jobId, onMessage) {
    const es = new EventSource(`${BASE}/api/backup/progress/${jobId}`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      onMessage(data);
      if (data.status === "done") es.close();
    };
    es.onerror = () => es.close();
    return es;
  },
};

// ── STATS ────────────────────────────────────────────────────────────────────
export const stats = {
  get: (channelId) => http.get("/api/stats", { params: { channel_id: channelId } }),
};

// ── SPEED TEST ───────────────────────────────────────────────────────────────
export const speedTest = {
  run:  () => http.post("/api/speed-test", {}, { timeout: 120_000 }),
  last: () => http.get("/api/speed-test"),
};

// ── FILESYSTEM BROWSE ────────────────────────────────────────────────────────
export const fs = {
  browse: (path = "/home") => http.get("/api/fs/browse", { params: { path } }),
};

// ── SCHEDULES ────────────────────────────────────────────────────────────────
export const schedules = {
  list:         ()           => http.get("/api/schedules"),
  create:       (data)       => http.post("/api/schedules", data),
  toggle:       (id, enabled)=> http.patch(`/api/schedules/${id}`, { enabled }),
  update:       (id, data)   => http.put(`/api/schedules/${id}`, data),
  remove:       (id)         => http.delete(`/api/schedules/${id}`),
  initDefaults: (channelId)  => http.post("/api/schedules/init-defaults", null, { params: { channel_id: channelId } }),
};

export default { auth, channels, files, backup, stats, speedTest, fs, schedules };
