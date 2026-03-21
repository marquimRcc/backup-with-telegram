import { useState, useEffect } from "react";
import { fs as fsApi, schedules as schedApi } from "../api.js";
import { Icon, Spinner, Toggle } from "../components/common.jsx";
import { useApp } from "../context.jsx";

/* ─── FOLDER PICKER ────────────────────────────────────────── */
function FolderPicker({ onSelect, onClose }) {
  const [currentPath, setCurrentPath] = useState("/home");
  const [items, setItems] = useState([]);
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const browse = async (path) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await fsApi.browse(path);
      setCurrentPath(data.path);
      setParent(data.parent);
      setItems(data.items || []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Erro ao abrir pasta");
    } finally { setLoading(false); }
  };

  useEffect(() => { browse("/home"); }, []);

  const dirs = items.filter(i => i.is_dir);
  const fileCount = items.filter(i => !i.is_dir).length;

  return (
    <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
      <div className="flex items-center justify-between" style={{ padding: "10px 14px", background: "var(--bg2)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
          <Icon n="folder" size={14} color="var(--tg)" />
          <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentPath}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => { onSelect(currentPath); onClose(); }} style={{ padding: "5px 12px", fontSize: 11 }}>
            <Icon n="plus" size={11} />Selecionar esta pasta
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: "5px 10px", fontSize: 11 }}>Fechar</button>
        </div>
      </div>
      <div style={{ maxHeight: 280, overflow: "auto", padding: "6px 8px" }}>
        {error && <div style={{ padding: 12, color: "var(--red)", fontSize: 12 }}>{error}</div>}
        {loading ? <div style={{ textAlign: "center", padding: 24 }}><Spinner size={18} /></div> : (
          <>
            {parent && <div className="file-row" style={{ padding: "8px 10px", gap: 10 }} onClick={() => browse(parent)}>
              <span style={{ fontSize: 15 }}>⬆️</span><span style={{ fontSize: 13, color: "var(--text2)" }}>..</span>
            </div>}
            {dirs.map((d, i) => (
              <div key={i} className="file-row" style={{ padding: "8px 10px", gap: 10 }} onClick={() => browse(d.path)}>
                <span style={{ fontSize: 15 }}>📁</span>
                <span style={{ flex: 1, fontSize: 13 }}>{d.name}</span>
                <Icon n="arrow" size={12} color="var(--text3)" />
              </div>
            ))}
            {fileCount > 0 && <div style={{ padding: "8px 10px", fontSize: 11.5, color: "var(--text3)", fontStyle: "italic" }}>+ {fileCount} arquivo{fileCount > 1 ? "s" : ""} nesta pasta</div>}
            {dirs.length === 0 && fileCount === 0 && !loading && <div style={{ padding: 16, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>Pasta vazia</div>}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── SCHEDULE DESCRIPTION ──────────────────────────────────── */
const SCHED_DESC = {
  hourly:      "Verifica mudanças a cada hora",
  twice_daily: "Roda às 12h e 20h automaticamente",
  daily_20h:   "Backup completo diário às 20h",
  on_boot:     "Backup ao iniciar o servidor",
};

/* ─── BACKUP PAGE ──────────────────────────────────────────── */
export default function BackupPage() {
  const { runBackup, backupRunning, backupProgress, channelId, pauseBackup, resumeBackup } = useApp();
  const [paths, setPaths] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pathInput, setPathInput] = useState("");

  // schedules from API
  const [scheds, setScheds] = useState([]);
  const [schedsLoading, setSchedsLoading] = useState(true);

  useEffect(() => {
    loadSchedules();
  }, [channelId]);

  const loadSchedules = async () => {
    setSchedsLoading(true);
    try {
      const { data } = await schedApi.list();
      if (data.schedules.length === 0 && channelId) {
        // primeira vez — cria defaults
        await schedApi.initDefaults(channelId);
        const { data: d2 } = await schedApi.list();
        setScheds(d2.schedules);
      } else {
        setScheds(data.schedules);
      }
    } catch (e) { console.warn("schedules:", e); }
    finally { setSchedsLoading(false); }
  };

  const toggleSchedule = async (sched) => {
    try {
      const { data } = await schedApi.toggle(sched.id, !sched.enabled);
      setScheds(prev => prev.map(s => s.id === sched.id ? data : s));
    } catch (e) { console.warn("toggle:", e); }
  };

  const updateSchedulePaths = async (sched) => {
    if (paths.length === 0) return;
    try {
      const { data } = await schedApi.update(sched.id, {
        ...sched,
        paths,
        channel_id: channelId,
      });
      setScheds(prev => prev.map(s => s.id === sched.id ? data : s));
    } catch (e) { console.warn("update:", e); }
  };

  const addPath = (p) => {
    const clean = p.trim();
    if (clean && !paths.includes(clean)) setPaths(prev => [...prev, clean]);
  };
  const removePath = (i) => setPaths(prev => prev.filter((_, j) => j !== i));
  const handleStart = () => { if (paths.length > 0) runBackup(paths); };

  const totalPct = backupProgress ? Math.round((backupProgress.done / Math.max(backupProgress.total, 1)) * 100) : 0;
  const isDone = backupProgress?.status === "done";
  const isPaused = backupProgress?.paused === true;

  return (
    <div style={{ padding: 26 }}>
      <div className="anim-fu" style={{ fontFamily: "var(--display)", fontSize: 19, fontWeight: 700, marginBottom: 20 }}>Backup & Sincronização</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* path selector */}
          <div className="card anim-fu1" style={{ padding: 20 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <span style={{ fontWeight: 600 }}>Pastas para backup</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPickerOpen(v => !v)}>
                <Icon n="folder" size={13} />{pickerOpen ? "Fechar" : "Navegar"}
              </button>
            </div>
            {pickerOpen && <FolderPicker onSelect={addPath} onClose={() => setPickerOpen(false)} />}
            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              <input className="input" value={pathInput} onChange={e => setPathInput(e.target.value)}
                placeholder="Ou digite: /home/marcos/Documentos" style={{ fontSize: 13 }}
                onKeyDown={e => { if (e.key === "Enter" && pathInput.trim()) { addPath(pathInput); setPathInput(""); } }} />
              <button className="btn btn-ghost btn-sm" onClick={() => { if (pathInput.trim()) { addPath(pathInput); setPathInput(""); } }}
                disabled={!pathInput.trim()}><Icon n="plus" size={13} /></button>
            </div>
            {paths.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--text3)", padding: "10px 0" }}>Nenhuma pasta selecionada.</div>
            ) : paths.map((p, i) => (
              <div key={i} className="flex items-center gap-2" style={{ padding: "7px 10px", background: "var(--bg2)", borderRadius: 8, marginBottom: 4, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 14 }}>📁</span>
                <span style={{ flex: 1, fontSize: 12.5, fontFamily: "var(--mono)", color: "var(--text2)" }}>{p}</span>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removePath(i)} style={{ width: 26, height: 26 }}><Icon n="trash" size={12} /></button>
              </div>
            ))}
            <button className="btn btn-primary w-full" style={{ marginTop: 12, padding: "11px", fontSize: 14 }}
              onClick={handleStart} disabled={backupRunning || paths.length === 0 || !channelId}>
              {backupRunning ? <><Spinner size={14} />Backup em andamento...</>
                : !channelId ? <span>Sem canal configurado</span>
                : <><Icon n="play" size={13} />Iniciar backup ({paths.length} pasta{paths.length > 1 ? "s" : ""})</>}
            </button>
          </div>

          {/* live progress */}
          <div className="card anim-fu2" style={{ padding: 20 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <span style={{ fontWeight: 600 }}>Progresso do backup</span>
              <div className="flex items-center gap-2">
                {backupRunning && isPaused && <span className="tag tag-yellow">PAUSADO</span>}
                {backupRunning && !isPaused && <span className="tag tag-yellow" style={{ animation: "pulse 1.5s infinite" }}>LIVE</span>}
                {isDone && <span className="tag tag-green">CONCLUÍDO</span>}
                {!backupRunning && !isDone && <span className="tag tag-gray">IDLE</span>}
                {backupRunning && (
                  <button className="btn btn-ghost btn-sm" onClick={isPaused ? resumeBackup : pauseBackup} style={{ padding: "5px 12px" }}>
                    {isPaused ? <><Icon n="play" size={12} />Retomar</> : <><Icon n="pause" size={12} />Pausar</>}
                  </button>
                )}
              </div>
            </div>
            {backupProgress ? (
              <div>
                <div className="flex justify-between" style={{ fontSize: 12, color: "var(--text2)", marginBottom: 7 }}>
                  <span>{isDone ? "Backup finalizado" : isPaused ? `Pausado — ${backupProgress.done}/${backupProgress.total} enviados` : `Enviando ${backupProgress.done}/${backupProgress.total} arquivos...`}</span>
                  <span className="mono">{totalPct}%</span>
                </div>
                <div className="progress" style={{ marginBottom: 14 }}><div className="progress-fill" style={{ width: `${totalPct}%`, background: isDone ? "var(--green)" : undefined }} /></div>
                {backupProgress.current && (
                  <div className="bk-item">
                    <div className="bk-item-icon" style={{ background: "rgba(42,171,238,.12)" }}><Spinner size={14} /></div>
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{backupProgress.current.filename}</span>
                        <span style={{ fontSize: 11, color: "var(--tg)", fontFamily: "var(--mono)" }}>{backupProgress.current.speed_mbps} MB/s</span>
                      </div>
                      <div className="progress" style={{ height: 3 }}><div className="progress-fill" style={{ width: `${backupProgress.current.percent}%` }} /></div>
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: "var(--tg)", width: 32, textAlign: "right" }}>{backupProgress.current.percent}%</span>
                  </div>
                )}
                <div className="flex gap-4" style={{ marginTop: 12, fontSize: 12, color: "var(--text2)" }}>
                  {backupProgress.done > 0 && <span style={{ color: "var(--green)" }}>✅ {backupProgress.done} enviado{backupProgress.done > 1 ? "s" : ""}</span>}
                  {backupProgress.skipped > 0 && <span style={{ color: "var(--yellow)" }}>⏭️ {backupProgress.skipped} pulado{backupProgress.skipped > 1 ? "s" : ""}</span>}
                  {backupProgress.failed > 0 && <span style={{ color: "var(--red)" }}>❌ {backupProgress.failed} erro{backupProgress.failed > 1 ? "s" : ""}</span>}
                  {backupProgress.bytes > 0 && <span className="mono" style={{ color: "var(--text3)" }}>{(backupProgress.bytes / 1048576).toFixed(1)} MB</span>}
                </div>
              </div>
            ) : (
              <div className="empty" style={{ padding: "30px 20px" }}>
                <div className="empty-icon">📭</div>
                <div className="empty-title">Nenhum backup em execução</div>
                <div className="empty-sub">Selecione pastas acima e clique em "Iniciar backup".</div>
              </div>
            )}
          </div>
        </div>

        {/* right col — schedules */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card anim-fu1" style={{ padding: 20 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <span style={{ fontWeight: 600 }}>Agendamentos</span>
              {schedsLoading && <Spinner size={14} />}
            </div>

            {scheds.map((s) => (
              <div key={s.id} className="sched-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text2)", marginTop: 2 }}>{SCHED_DESC[s.cron_type] || s.cron_type}</div>
                  {s.paths.length > 0 ? (
                    <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--mono)", marginTop: 3 }}>
                      {s.paths.length} pasta{s.paths.length > 1 ? "s" : ""} configurada{s.paths.length > 1 ? "s" : ""}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: "var(--yellow)", marginTop: 3 }}>
                      ⚠ sem pastas — use "Aplicar pastas" abaixo
                    </div>
                  )}
                  {s.last_run && (
                    <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--mono)", marginTop: 2 }}>
                      Último: {new Date(s.last_run).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
                <Toggle on={s.enabled} onToggle={() => toggleSchedule(s)} />
              </div>
            ))}

            {scheds.length > 0 && paths.length > 0 && (
              <button className="btn btn-ghost btn-sm w-full" style={{ marginTop: 12 }}
                onClick={() => scheds.forEach(s => updateSchedulePaths(s))}>
                <Icon n="refresh" size={12} />Aplicar pastas selecionadas a todos
              </button>
            )}

            {scheds.length > 0 && paths.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 10, padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                Selecione pastas à esquerda e clique "Aplicar pastas" para configurar os agendamentos.
              </div>
            )}
          </div>

          {/* summary */}
          {backupProgress && (
            <div className="card anim-fu2" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 14 }}>Resumo</div>
              {[
                ["Total", `${backupProgress.total} arquivo${backupProgress.total > 1 ? "s" : ""}`],
                ["Enviados", `${backupProgress.done}`],
                ["Pulados", `${backupProgress.skipped}`],
                ["Falhas", `${backupProgress.failed}`],
                ["Dados env.", `${(backupProgress.bytes / 1048576).toFixed(1)} MB`],
              ].map(([k, v], i, a) => (
                <div key={i} className="flex items-center justify-between" style={{ padding: "9px 0", borderBottom: i < a.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize: 12.5, color: "var(--text2)" }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--mono)" }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
