import { useState, useEffect } from "react";
import { backup as backupApi } from "../api.js";
import { Spinner } from "../components/common.jsx";
import { useApp } from "../context.jsx";

export default function ActivityPage() {
  const { activityLog } = useApp();
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    backupApi.jobs(20).then(r => setJobs(r.data.jobs || []))
        .catch(() => {})
        .finally(() => setLoadingJobs(false));
  }, []);

  const statusEmoji = (s) => {
    if (s === "done") return String.fromCodePoint(0x2705);
    if (s === "failed") return String.fromCodePoint(0x274c);
    if (s === "cancelled") return String.fromCodePoint(0x26d4);
    return String.fromCodePoint(0x23f3);
  };

  return (
      <div style={{ padding: 26 }}>
        <div className="anim-fu" style={{ fontFamily: "var(--display)", fontSize: 19, fontWeight: 700, marginBottom: 20 }}>
          Hist{String.fromCharCode(243)}rico de Atividade
        </div>

        {activityLog.length > 0 && (
            <div className="card anim-fu1" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 14 }}>
                Sess{String.fromCharCode(227)}o atual
              </div>
              {activityLog.map((l, i) => (
                  <div key={i} className="log-item">
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{l.e}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{l.text}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text3)", fontFamily: "var(--mono)", marginTop: 2 }}>{l.time}</div>
                    </div>
                  </div>
              ))}
            </div>
        )}

        <div className="card anim-fu2" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 14 }}>
            Hist{String.fromCharCode(243)}rico de backups
          </div>
          {loadingJobs ? (
              <div style={{ textAlign: "center", padding: 24 }}><Spinner size={20} /></div>
          ) : jobs.length === 0 ? (
              <div className="empty" style={{ padding: "30px 20px" }}>
                <div className="empty-icon">{String.fromCodePoint(0x1F4ED)}</div>
                <div className="empty-title">Nenhum backup registrado ainda.</div>
              </div>
          ) : (
              jobs.map((j, i) => (
                  <div key={i} className="flex items-center gap-3" style={{
                    padding: "12px 10px", borderRadius: 9, marginBottom: 4,
                    background: i % 2 === 0 ? "var(--bg2)" : "transparent",
                  }}>
                    <span style={{ fontSize: 17 }}>{statusEmoji(j.status)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {j.files_sent || 0} enviado{(j.files_sent || 0) !== 1 ? "s" : ""}
                        {j.files_skipped > 0 && `, ${j.files_skipped} pulado${j.files_skipped !== 1 ? "s" : ""}`}
                        {j.files_failed > 0 && `, ${j.files_failed} erro${j.files_failed !== 1 ? "s" : ""}`}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", marginTop: 2 }}>
                        {j.started_at ? new Date(j.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "..."}
                        {j.bytes_sent > 0 && ` - ${(j.bytes_sent / 1048576).toFixed(1)} MB`}
                      </div>
                    </div>
                    <span className={`tag ${j.status === "done" ? "tag-green" : j.status === "failed" ? "tag-red" : "tag-gray"}`}>
                {j.status}
              </span>
                  </div>
              ))
          )}
        </div>
      </div>
  );
}