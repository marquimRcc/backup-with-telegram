import { useState, useEffect } from "react";
import { Icon, Spinner, Toggle, splitName } from "../components/common.jsx";
import { useApp } from "../context.jsx";
import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8001";

export default function SettingsPage() {
  const { logout, user, realChannels } = useApp();
  const [version, setVersion] = useState("...");
  const [autostart, setAutostart] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);

  const ch = realChannels?.[0];

  useEffect(() => {
    // version
    fetch(`${BASE}/api/health`)
      .then(r => r.json()).then(d => setVersion(d.version || "?")).catch(() => setVersion("?"));
    // autostart status
    axios.get(`${BASE}/api/system/autostart`)
      .then(r => setAutostart(r.data.enabled))
      .catch(() => {});
  }, []);

  const toggleAutostart = async () => {
    setAutostartLoading(true);
    try {
      const endpoint = autostart ? "disable" : "enable";
      const { data } = await axios.post(`${BASE}/api/system/autostart/${endpoint}`);
      setAutostart(data.enabled);
    } catch (e) {
      console.warn("Autostart toggle error:", e);
    } finally {
      setAutostartLoading(false);
    }
  };

  return (
    <div style={{ padding: 26 }}>
      <div className="anim-fu" style={{ fontFamily: "var(--display)", fontSize: 19, fontWeight: 700, marginBottom: 20 }}>Configurações</div>
      <div style={{ maxWidth: 540, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* conta */}
        <div className="card anim-fu1" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 14 }}>Conta Telegram</div>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <div className="avatar" style={{ width: 42, height: 42, fontSize: 15, borderRadius: 12 }}>{user?.first_name?.[0] || "?"}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{splitName(user?.first_name)} {user?.last_name || ""}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>+{user?.phone || "..."}</div>
              {user?.username && <div style={{ fontSize: 11, color: "var(--text3)" }}>@{user.username}</div>}
            </div>
            <span className="tag tag-green" style={{ marginLeft: "auto" }}>Conectado</span>
          </div>
          <div style={{ height: 1, background: "var(--border)", marginBottom: 14 }} />
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>Canal de backup</div>
          <div className="flex items-center gap-3" style={{ padding: "13px 14px", background: "var(--bg2)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 20 }}>📦</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{ch?.name || "Nenhum canal"}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>
                {ch ? `canal ${ch.type || "privado"} · id ${ch.id}` : "configure TELEVAULT_CHANNEL_ID no .env"}
              </div>
            </div>
            <span className={`tag ${ch ? "tag-green" : "tag-gray"}`} style={{ marginLeft: "auto" }}>{ch ? "Ativo" : "—"}</span>
          </div>
          <button className="btn btn-danger btn-sm w-full" style={{ marginTop: 14, justifyContent: "center" }} onClick={logout}>
            <Icon n="trash" size={13} />Desconectar conta
          </button>
        </div>

        {/* preferências */}
        <div className="card anim-fu2" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 14 }}>Preferências</div>

          {/* autostart — funcional */}
          <div className="sched-row">
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>Iniciar com o sistema</div>
              <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                {autostart ? "Systemd user service ativo — inicia no login" : "Desativado — inicie manualmente com dev.sh"}
              </div>
            </div>
            {autostartLoading ? <Spinner size={16} /> : <Toggle on={autostart} onToggle={toggleAutostart} />}
          </div>

          {/* notificações — em breve */}
          {[
            { label: "Notificações", sub: "Alertas ao concluir ou falhar backups" },
            { label: "Minimizar para bandeja", sub: "Fica na system tray ao fechar a janela" },
          ].map((s, i) => (
            <div key={i} className="sched-row" style={{ opacity: 0.5 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{s.sub}</div>
              </div>
              <Toggle on={false} onToggle={() => {}} />
            </div>
          ))}
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8, padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
            Notificações e bandeja serão funcionais quando empacotado como app desktop.
          </div>
        </div>

        {/* sobre */}
        <div className="card anim-fu3" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 14 }}>Sobre</div>
          {[
            ["Versão", version],
            ["Frontend", "React 18 + Vite"],
            ["Backend", "FastAPI + Telethon"],
            ["Banco", "SQLite (SQLAlchemy)"],
            ["Plataforma", "Linux · RegataOS / openSUSE"],
            ["Licença", "MIT"],
          ].map(([k, v], i, a) => (
            <div key={i} className="flex items-center justify-between" style={{ padding: "9px 0", borderBottom: i < a.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontSize: 12.5, color: "var(--text2)" }}>{k}</span>
              <span style={{ fontSize: 12.5, fontFamily: "var(--mono)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
