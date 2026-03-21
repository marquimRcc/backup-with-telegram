/**
 * context.jsx — estado global + upload queue com controle por arquivo
 */

import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from "react";
import { auth as authApi, channels as chApi, stats as statsApi, backup as backupApi, files as filesApi } from "./api.js";

const AppCtx = createContext(null);
const MAX_UPLOAD_MB = 2000;

const initialState = {
  setup: true, checking: true, page: "dashboard",
  user: null, realChannels: [], realStats: null,
  backupRunning: false, backupProgress: null, activeJobId: null,
  activityLog: [],
  // upload
  uploading: false,
  uploadQueue: [],        // [{id,name,size,status,phase,httpProg,tgProg,tgSpeed,error}]
  uploadChannelId: null,
  uploadCurrentId: null,  // id do arquivo sendo enviado agora
};

function reducer(state, action) {
  switch (action.type) {
    case "SET": return { ...state, ...action.payload };
    case "SET_QUEUE": return { ...state, uploadQueue: action.queue };
    case "UPDATE_QUEUE_ITEM": return {
      ...state,
      uploadQueue: state.uploadQueue.map(f =>
        f.id === action.id ? { ...f, ...action.payload } : f
      ),
    };
    case "ADD_LOG": {
      const now = new Date();
      const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return { ...state, activityLog: [{ e: action.emoji, text: action.text, time }, ...state.activityLog].slice(0, 50) };
    }
    case "RESET_UPLOAD": return {
      ...state, uploading: false, uploadQueue: [], uploadChannelId: null, uploadCurrentId: null,
    };
    case "RESET_SESSION": return { ...initialState, setup: true, checking: false };
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const sseRef = useRef(null);
  const uploadSseRef = useRef(null);
  const queueRef = useRef([]);  // mutable mirror for async loop

  const set = useCallback((p) => dispatch({ type: "SET", payload: p }), []);
  const addLog = useCallback((emoji, text) => dispatch({ type: "ADD_LOG", emoji, text }), []);
  const updateItem = useCallback((id, payload) => {
    dispatch({ type: "UPDATE_QUEUE_ITEM", id, payload });
    // sync ref
    const item = queueRef.current.find(f => f.id === id);
    if (item) Object.assign(item, payload);
  }, []);
  const resetUpload = useCallback(() => {
    if (uploadSseRef.current) { uploadSseRef.current.close(); uploadSseRef.current = null; }
    queueRef.current = [];
    dispatch({ type: "RESET_UPLOAD" });
  }, []);

  const channelId = state.realChannels[0]?.id || null;

  // ── auth ──
  useEffect(() => {
    authApi.status().then(async (r) => {
      if (r.data.authorized) {
        set({ setup: false });
        try {
          const [meRes, chRes] = await Promise.all([authApi.me(), chApi.list()]);
          const chs = chRes.data.channels || [];
          set({ user: meRes.data, realChannels: chs });
          if (chs.length > 0) {
            try { const sRes = await statsApi.get(chs[0].id); set({ realStats: sRes.data }); }
            catch (e) { console.warn("stats:", e); }
          }
        } catch (e) { console.warn(e); }
      }
    }).catch(() => {}).finally(() => set({ checking: false }));
  }, []);

  // ── upload one file (returns promise) ──
  const uploadOneFile = useCallback((chId, item) => new Promise((resolve, reject) => {
    const sizeMB = item.size / 1048576;
    updateItem(item.id, { status: "uploading", phase: "sending", httpProg: 0, tgProg: 0, tgSpeed: 0 });
    set({ uploadCurrentId: item.id });

    filesApi.upload(chId, item.file, (ev) => {
      if (ev.total) updateItem(item.id, { httpProg: Math.round((ev.loaded / ev.total) * 100) });
    }).then(res => {
      const uploadId = res.data?.upload_id;
      if (!uploadId) { reject(new Error("Sem upload_id")); return; }

      updateItem(item.id, { phase: "telegram", httpProg: 100 });

      const es = filesApi.streamUploadProgress(uploadId, (data) => {
        if (data.error) {
          updateItem(item.id, { status: "error", error: data.error });
          es.close();
          reject(new Error(data.error));
          return;
        }
        updateItem(item.id, { tgProg: data.tg_percent || 0, tgSpeed: data.speed_mbps || 0 });
        if (data.done) {
          updateItem(item.id, { status: "done", phase: "done", tgProg: 100 });
          addLog("📤", `Upload: ${item.name} (${sizeMB.toFixed(1)} MB)`);
          resolve();
        }
      });
      uploadSseRef.current = es;
    }).catch(reject);
  }), [addLog, updateItem, set]);

  // ── start upload queue ──
  const startUpload = useCallback(async (chId, fileList) => {
    if (!fileList.length || !chId) return;
    const tooBig = fileList.find(f => f.size / 1048576 > MAX_UPLOAD_MB);
    if (tooBig) { alert(`"${tooBig.name}" excede ${MAX_UPLOAD_MB} MB.`); return; }

    const queue = fileList.map((f, i) => ({
      id: i, name: f.name, size: f.size, file: f,
      status: "pending", phase: "", httpProg: 0, tgProg: 0, tgSpeed: 0, error: "",
    }));
    queueRef.current = queue;
    dispatch({ type: "SET_QUEUE", queue });
    set({ uploading: true, uploadChannelId: chId });

    for (let i = 0; i < queue.length; i++) {
      const item = queueRef.current[i];
      if (!item) break;

      // skip cancelled
      if (item.status === "cancelled") {
        dispatch({ type: "UPDATE_QUEUE_ITEM", id: item.id, payload: { status: "cancelled" } });
        continue;
      }

      // wait while paused
      while (item.status === "paused") {
        await new Promise(r => setTimeout(r, 300));
        // re-check: might have been cancelled while paused
        if (queueRef.current[i]?.status === "cancelled") break;
      }
      if (queueRef.current[i]?.status === "cancelled") continue;

      try {
        await uploadOneFile(chId, item);
      } catch (err) {
        const msg = err?.response?.data?.detail || err.message || "Erro";
        updateItem(item.id, { status: "error", error: msg });
      }
    }

    set({ uploading: false, uploadCurrentId: null });
  }, [set, uploadOneFile, updateItem]);

  // ── per-file controls ──
  const pauseQueueItem = useCallback((id) => {
    const item = queueRef.current.find(f => f.id === id);
    if (item && item.status === "pending") {
      item.status = "paused";
      dispatch({ type: "UPDATE_QUEUE_ITEM", id, payload: { status: "paused" } });
    }
  }, []);

  const resumeQueueItem = useCallback((id) => {
    const item = queueRef.current.find(f => f.id === id);
    if (item && item.status === "paused") {
      item.status = "pending";
      dispatch({ type: "UPDATE_QUEUE_ITEM", id, payload: { status: "pending" } });
    }
  }, []);

  const cancelQueueItem = useCallback((id) => {
    const item = queueRef.current.find(f => f.id === id);
    if (item && (item.status === "pending" || item.status === "paused")) {
      item.status = "cancelled";
      dispatch({ type: "UPDATE_QUEUE_ITEM", id, payload: { status: "cancelled" } });
    }
  }, []);

  // ── backup ──
  const runBackup = useCallback(async (paths) => {
    if (state.backupRunning || !channelId) return;
    if (!paths || paths.length === 0) { set({ page: "backup" }); return; }
    set({ backupRunning: true, page: "backup", backupProgress: null });
    try {
      const { data } = await backupApi.start(channelId, paths);
      set({ activeJobId: data.job_id, backupProgress: { status: "running", total: data.total_files, done: 0, skipped: 0, failed: 0, bytes: 0, current: null } });
      addLog("⚡", `Backup iniciado — ${data.total_files} arquivo${data.total_files > 1 ? "s" : ""}`);
      const BASE = import.meta.env.VITE_API_URL || "http://localhost:8001";
      const es = new EventSource(`${BASE}/api/backup/progress/${data.job_id}`);
      sseRef.current = es;
      es.onmessage = (e) => {
        const payload = JSON.parse(e.data);
        if (payload.status === "done") {
          es.close(); sseRef.current = null;
          set({ backupRunning: false, activeJobId: null, backupProgress: { ...payload, status: "done" } });
          addLog("✅", `Backup concluído — ${payload.done || 0} enviado${(payload.done || 0) > 1 ? "s" : ""}, ${((payload.bytes || 0) / 1048576).toFixed(1)} MB`);
          statsApi.get(channelId).then((r) => set({ realStats: r.data })).catch(() => {});
        } else { set({ backupProgress: payload }); }
      };
      es.onerror = () => { es.close(); sseRef.current = null; set({ backupRunning: false, activeJobId: null }); };
    } catch (err) {
      set({ backupRunning: false });
      alert("Erro ao iniciar backup: " + (err?.response?.data?.detail || err.message));
    }
  }, [state.backupRunning, channelId, addLog]);

  const pauseBackup = useCallback(async () => {
    if (state.activeJobId) try { await backupApi.pause(state.activeJobId); } catch (e) { console.warn(e); }
  }, [state.activeJobId]);
  const resumeBackup = useCallback(async () => {
    if (state.activeJobId) try { await backupApi.resume(state.activeJobId); } catch (e) { console.warn(e); }
  }, [state.activeJobId]);

  // ── logout ──
  const logout = useCallback(async () => {
    try { await authApi.signOut(); } catch (e) { console.warn(e); }
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    if (uploadSseRef.current) { uploadSseRef.current.close(); uploadSseRef.current = null; }
    dispatch({ type: "RESET_SESSION" });
  }, []);

  const ctx = {
    ...state, set, addLog, channelId,
    runBackup, pauseBackup, resumeBackup,
    startUpload, resetUpload, pauseQueueItem, resumeQueueItem, cancelQueueItem,
    logout,
  };
  return <AppCtx.Provider value={ctx}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
