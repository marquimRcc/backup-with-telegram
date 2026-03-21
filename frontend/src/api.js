/**
 * api.js — cliente HTTP para o backend TeleVault
 * Encapsula todas as chamadas REST + SSE
 */

import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8001";

const http = axios.create({
  baseURL: BASE,
  timeout: 30_000,
  withCredentials: true,
});

// cliente sem timeout para uploads grandes
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

  /**
   * Upload em 2 fases:
   * 1. POST envia arquivo pro servidor (streaming, sem timeout)
   * 2. Retorna upload_id → acompanhar via streamUploadProgress
   */
  upload: (channelId, file, onHttpProgress) => {
    const form = new FormData();
    form.append("file", file);
    return httpUpload.post(`/api/files/upload/${channelId}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onHttpProgress,
    });
  },

  /**
   * Abre SSE stream de progresso do upload pro Telegram.
   * @param {string} uploadId
   * @param {(data: object) => void} onMessage
   * @returns {EventSource}
   */
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
};

// ── BACKUP ────────────────────────────────────────────────────────────────────

export const backup = {
  start: (channelId, paths, folderMap = {}) =>
      http.post("/api/backup/start", { channel_id: channelId, paths, folder_map: folderMap }),

  cancel: (jobId) => http.post(`/api/backup/cancel/${jobId}`),

  pause:  (jobId) => http.post(`/api/backup/pause/${jobId}`),

  resume: (jobId) => http.post(`/api/backup/resume/${jobId}`),

  jobs: (limit = 20) => http.get("/api/backup/jobs", { params: { limit } }),

  /**
   * Abre SSE stream de progresso.
   */
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

export default { auth, channels, files, backup, stats, speedTest };