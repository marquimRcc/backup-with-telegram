/**
 * store.js — estado global Zustand
 */

import { create } from "zustand";
import { auth as authApi, channels as chApi, backup as bkApi } from "./api";

export const useStore = create((set, get) => ({

  // ── AUTH ───────────────────────────────────────────────────────────
  user: null,
  authorized: false,

  checkAuth: async () => {
    try {
      const { data } = await authApi.status();
      if (data.authorized) {
        const { data: me } = await authApi.me();
        set({ user: me, authorized: true });
      }
    } catch {}
  },

  sendCode: async (phone) => {
    const { data } = await authApi.sendCode(phone);
    return data;
  },

  signIn: async (code, password) => {
    const { data } = await authApi.signIn(code, password);
    set({ user: data, authorized: true });
    return data;
  },

  signOut: async () => {
    await authApi.signOut();
    set({ user: null, authorized: false, activeChannel: null });
  },

  // ── CHANNELS ───────────────────────────────────────────────────────
  channels: [],
  activeChannel: null,

  loadChannels: async () => {
    const { data } = await chApi.list();
    set({ channels: data.channels });
  },

  createChannel: async (title) => {
    const { data } = await chApi.create(title);
    await get().loadChannels();
    return data;
  },

  setActiveChannel: (ch) => set({ activeChannel: ch }),

  // ── BACKUP ─────────────────────────────────────────────────────────
  activeJob: null,
  backupProgress: null,
  backupHistory: [],

  startBackup: async (paths) => {
    const { activeChannel } = get();
    if (!activeChannel) throw new Error("Nenhum canal selecionado");

    const { data } = await bkApi.start(activeChannel.id, paths);
    set({ activeJob: data.job_id, backupProgress: { total: data.total_files, done: 0, percent: 0 } });

    // SSE
    bkApi.streamProgress(data.job_id, (payload) => {
      if (payload.status === "done") {
        set(s => ({
          activeJob: null,
          backupProgress: null,
          backupHistory: [{ ...payload, finishedAt: new Date() }, ...s.backupHistory],
        }));
      } else {
        set({ backupProgress: payload });
      }
    });

    return data.job_id;
  },

  cancelBackup: async () => {
    const { activeJob } = get();
    if (!activeJob) return;
    await bkApi.cancel(activeJob);
    set({ activeJob: null, backupProgress: null });
  },

}));
