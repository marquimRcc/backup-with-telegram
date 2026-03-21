import { useState, useEffect, useRef } from "react";
import { files as filesApi } from "../api.js";
import { Icon, Spinner, FILE_ICON, fmtSize } from "../components/common.jsx";
import { useApp } from "../context.jsx";

export default function FilesPage() {
  const {
    realChannels, addLog,
    uploading, uploadQueue, uploadCurrentId,
    startUpload, resetUpload, pauseQueueItem, resumeQueueItem, cancelQueueItem,
  } = useApp();

  const [selF, setSelF] = useState(realChannels[0]?.id || null);
  const [selFile, setSelFile] = useState(null);
  const [realFiles, setRealFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(true);
  const fileInput = useRef(null);

  // download state
  const [downloading, setDownloading] = useState(null); // message_id
  const [dlProg, setDlProg] = useState(0);
  const [dlName, setDlName] = useState("");
  const [dlSize, setDlSize] = useState(0);

  const loadFiles = async (chId) => {
    if (!chId) return;
    setLoadingFiles(true);
    try { const r = await filesApi.list(chId, 100); setRealFiles(r.data.files || []); }
    catch (e) { console.warn(e); }
    finally { setLoadingFiles(false); }
  };

  useEffect(() => { if (selF) loadFiles(selF); }, [selF]);

  // reload when all uploads finish
  const allDone = uploadQueue.length > 0 && uploadQueue.every(f => f.status === "done" || f.status === "error" || f.status === "cancelled");
  useEffect(() => { if (allDone && !uploading) loadFiles(selF); }, [allDone, uploading]);

  const handleUpload = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !selF) return;
    setQueueOpen(true);
    startUpload(selF, files);
  };

  const handleDownload = async (f) => {
    if (!selF || !f.message_id || downloading) return;
    setDownloading(f.message_id);
    setDlProg(0);
    setDlName(f.filename);
    setDlSize(f.size);
    try {
      await filesApi.downloadWithProgress(selF, f.message_id, f.filename, (pct, loaded, total) => {
        setDlProg(pct);
      });
      addLog?.("📥", `Download: ${f.filename}`);
    } catch (err) {
      alert("Erro no download: " + err.message);
    } finally {
      setTimeout(() => { setDownloading(null); setDlProg(0); setDlName(""); setDlSize(0); }, 1000);
    }
  };

  const handleDelete = async (f) => {
    if (!selF || !f.message_id) return;
    if (!confirm(`Apagar "${f.filename}" do Telegram?`)) return;
    setDeleting(f.message_id);
    try {
      await filesApi.delete(selF, f.message_id);
      addLog?.("🗑️", `Deletado: ${f.filename}`);
      await loadFiles(selF);
    } catch (err) { alert("Erro ao deletar: " + (err?.response?.data?.detail || err.message)); }
    finally { setDeleting(null); }
  };

  const displayFiles = realFiles.map(f => ({
    ...f, name: f.filename, size: fmtSize(f.size),
    date: new Date(f.date).toLocaleDateString("pt-BR"),
    type: f.filename.split(".").pop()?.toLowerCase() || "file",
  }));

  // queue stats
  const current = uploadQueue.find(f => f.id === uploadCurrentId);
  const doneCount = uploadQueue.filter(f => f.status === "done").length;
  const totalCount = uploadQueue.length;
  const hasQueue = uploadQueue.length > 0;
  const isFinished = hasQueue && !uploading;

  const curProg = current
    ? (current.phase === "sending" ? Math.round(current.httpProg * 0.3)
      : current.phase === "telegram" ? 30 + Math.round(current.tgProg * 0.7)
      : current.status === "done" ? 100 : 0)
    : 0;

  const curLabel = current
    ? (current.phase === "sending" ? `Recebendo ${current.name}... ${current.httpProg}%`
      : current.phase === "telegram" ? `Enviando ${current.name}... ${current.tgProg}% · ${current.tgSpeed} MB/s`
      : current.status === "done" ? `${current.name} — concluído`
      : current.status === "error" ? `Erro: ${current.error}` : "")
    : isFinished ? `${doneCount}/${totalCount} concluído${doneCount > 1 ? "s" : ""}` : "";

  const statusIcon = (s) => {
    if (s.status === "done") return <Icon n="check" size={13} color="var(--green)" />;
    if (s.status === "uploading") return <Spinner size={13} />;
    if (s.status === "error") return <Icon n="info" size={13} color="var(--red)" />;
    if (s.status === "cancelled") return <Icon n="trash" size={13} color="var(--text3)" />;
    if (s.status === "paused") return <Icon n="pause" size={13} color="var(--yellow)" />;
    return <div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid var(--border)" }} />;
  };

  const chName = realChannels.find(c => c.id === selF)?.name || "Canal";

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* channel sidebar */}
      <div style={{ width: 210, borderRight: "1px solid var(--border)", padding: 14, overflow: "auto", flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>Canais</div>
        {realChannels.length > 0 ? realChannels.map(ch => (
          <div key={ch.id} className={`file-row ${selF === ch.id ? "selected" : ""}`} onClick={() => { setSelF(ch.id); setSelFile(null); }}>
            <span style={{ fontSize: 15 }}>📦</span>
            <span style={{ flex: 1, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.name}</span>
          </div>
        )) : (
          <div style={{ padding: "20px 10px", color: "var(--text3)", fontSize: 12, textAlign: "center" }}>Nenhum canal encontrado</div>
        )}
      </div>

      {/* main area */}
      <div style={{ flex: 1, overflow: "auto", padding: 22 }}>

        {/* download progress */}
        {downloading && (
          <div style={{ padding: "12px 14px", marginBottom: 14, background: "rgba(48,209,88,0.06)", border: "1px solid rgba(48,209,88,0.15)", borderRadius: 12 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
              <Spinner size={13} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{dlName}</span>
              <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>{fmtSize(dlSize)}</span>
            </div>
            <div className="progress" style={{ height: 4 }}>
              <div className="progress-fill" style={{ width: `${dlProg}%`, background: "var(--green)" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", marginTop: 4 }}>
              Baixando... {dlProg}%
            </div>
          </div>
        )}

        {/* upload queue panel */}
        {hasQueue && (
          <div style={{ marginBottom: 16, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div className="flex items-center justify-between"
              style={{ padding: "12px 14px", cursor: "pointer", userSelect: "none" }}
              onClick={() => setQueueOpen(v => !v)}>
              <div className="flex items-center gap-2">
                {isFinished ? <Icon n="check" size={14} color="var(--green)" />
                  : current?.status === "error" ? <Icon n="info" size={14} color="var(--red)" />
                  : <Spinner size={14} />}
                <span style={{ fontSize: 13, fontWeight: 500 }}>{curLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>{doneCount}/{totalCount}</span>
                {isFinished && (
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); resetUpload(); }}
                    style={{ padding: "4px 10px", fontSize: 11 }}>Limpar</button>
                )}
                <span style={{ fontSize: 11, color: "var(--text3)", transition: "transform .2s", transform: queueOpen ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
              </div>
            </div>

            {!isFinished && current && (
              <div style={{ padding: "0 14px 10px" }}>
                <div className="progress" style={{ height: 4 }}>
                  <div className="progress-fill" style={{ width: `${curProg}%` }} />
                </div>
              </div>
            )}

            {queueOpen && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "8px 10px", maxHeight: 300, overflow: "auto" }}>
                {uploadQueue.map(item => (
                  <div key={item.id} className="flex items-center gap-2" style={{
                    padding: "7px 6px", borderRadius: 7, fontSize: 13.5,
                    background: item.id === uploadCurrentId ? "rgba(42,171,238,.06)" : "transparent",
                    opacity: item.status === "cancelled" ? 0.4 : 1,
                  }}>
                    {statusIcon(item)}
                    <span style={{
                      flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      color: item.status === "error" ? "var(--red)" : item.status === "done" ? "var(--green)" : "var(--text)",
                      textDecoration: item.status === "cancelled" ? "line-through" : "none",
                    }}>{item.name}</span>
                    <span style={{ fontSize: 11.5, color: "var(--text3)", fontFamily: "var(--mono)", flexShrink: 0 }}>{fmtSize(item.size)}</span>
                    {item.id === uploadCurrentId && item.phase === "telegram" && (
                      <span style={{ fontSize: 11.5, color: "var(--tg)", fontFamily: "var(--mono)", flexShrink: 0 }}>{item.tgSpeed} MB/s</span>
                    )}
                    {item.id !== uploadCurrentId && (item.status === "pending" || item.status === "paused") && (
                      <div className="flex gap-2" style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        {item.status === "paused" ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => resumeQueueItem(item.id)} style={{ padding: "2px 8px", fontSize: 11 }}>
                            <Icon n="play" size={11} />
                          </button>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => pauseQueueItem(item.id)} style={{ padding: "2px 8px", fontSize: 11 }}>
                            <Icon n="pause" size={11} />
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => cancelQueueItem(item.id)}
                          style={{ padding: "2px 8px", fontSize: 11, color: "var(--red)" }}>
                          <Icon n="trash" size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "var(--display)", fontSize: 17, fontWeight: 700 }}>{chName}</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{loadingFiles ? "carregando..." : `${displayFiles.length} arquivos`}</div>
          </div>
          <div className="flex gap-2">
            <input ref={fileInput} type="file" multiple style={{ display: "none" }} onChange={handleUpload} />
            <button className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <><Spinner size={12} />Enviando...</> : <><Icon n="upload" size={13} />Enviar</>}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => loadFiles(selF)} disabled={loadingFiles}>
              <Icon n="refresh" size={13} />{loadingFiles ? "..." : "Atualizar"}
            </button>
          </div>
        </div>

        {/* file list (collapsible) */}
        {displayFiles.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div className="flex items-center gap-2" style={{ cursor: "pointer", userSelect: "none", padding: "6px 0", marginBottom: 4 }}
              onClick={() => setFilesOpen(v => !v)}>
              <span style={{ fontSize: 11, color: "var(--text3)", transition: "transform .2s", transform: filesOpen ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                {chName} — {displayFiles.length} arquivo{displayFiles.length > 1 ? "s" : ""}
              </span>
            </div>

            {filesOpen && (
              <>
                <div className="flex" style={{ padding: "5px 10px", fontSize: 10.5, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4, gap: 10 }}>
                  <div style={{ flex: 1 }}>Nome</div>
                  <div style={{ width: 70, textAlign: "right" }}>Tamanho</div>
                  <div style={{ width: 110, textAlign: "right" }}>Data</div>
                  <div style={{ width: 80 }}></div>
                </div>

                {displayFiles.map((f, i) => (
                  <div key={f.message_id || i} className={`file-row ${selFile === i ? "selected" : ""}`}
                    style={{ padding: "10px 10px", gap: 10 }} onClick={() => setSelFile(i)}>
                    <span style={{ fontSize: 17, width: 26, textAlign: "center", flexShrink: 0 }}>{FILE_ICON[f.type] || "📄"}</span>
                    <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <span style={{ width: 70, textAlign: "right", fontSize: 11.5, color: "var(--text3)", fontFamily: "var(--mono)" }}>{f.size}</span>
                    <span style={{ width: 110, textAlign: "right", fontSize: 11.5, color: "var(--text2)", fontFamily: "var(--mono)" }}>{f.date}</span>
                    <div className="flex gap-2" style={{ width: 80, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Baixar"
                        onClick={() => handleDownload(f)} disabled={downloading === f.message_id}>
                        {downloading === f.message_id ? <Spinner size={12} /> : <Icon n="download" size={13} />}
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Deletar"
                        onClick={() => handleDelete(f)} disabled={deleting === f.message_id}>
                        {deleting === f.message_id ? <Spinner size={12} /> : <Icon n="trash" size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {!loadingFiles && displayFiles.length === 0 && !hasQueue && (
          <div className="empty">
            <div className="empty-icon">📭</div>
            <div className="empty-title">Canal vazio</div>
            <div className="empty-sub">Envie um arquivo ou faça um backup para popular este canal.</div>
          </div>
        )}

        {loadingFiles && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}><Spinner size={24} /></div>}
      </div>
    </div>
  );
}
