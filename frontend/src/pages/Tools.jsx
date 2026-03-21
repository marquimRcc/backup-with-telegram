import { useState, useEffect, useRef } from "react";
import { speedTest as speedTestApi } from "../api.js";
import { Icon, Spinner } from "../components/common.jsx";
import { useApp } from "../context.jsx";

/* ─── GAUGE COMPONENT ─────────────────────────────────────── */
function SpeedGauge({ value, max, testing, phase }) {
  const canvasRef = useRef(null);
  const [display, setDisplay] = useState(0);

  // animate value
  useEffect(() => {
    if (testing) return;
    let frame;
    const duration = 1200;
    const start = performance.now();
    const from = display;
    const to = value || 0;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const animate = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setDisplay(from + (to - from) * ease(t));
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, testing]);

  // needle animation during test
  useEffect(() => {
    if (!testing) return;
    let frame;
    let t = 0;
    const animate = () => {
      t += 0.02;
      const v = max * 0.3 + Math.sin(t * 2.5) * max * 0.25 + Math.sin(t * 7) * max * 0.08;
      setDisplay(Math.max(0, Math.min(max, v)));
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [testing, max]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const size = 220;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2 + 10;
    const r = 85;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const range = endAngle - startAngle;
    const pct = Math.min(display / max, 1);

    ctx.clearRect(0, 0, size, size);

    // bg arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.stroke();

    // colored arc
    if (pct > 0) {
      const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      if (pct < 0.4) {
        grad.addColorStop(0, "#FF453A");
        grad.addColorStop(1, "#FF9F0A");
      } else if (pct < 0.7) {
        grad.addColorStop(0, "#FF9F0A");
        grad.addColorStop(1, "#30D158");
      } else {
        grad.addColorStop(0, "#30D158");
        grad.addColorStop(1, "#2AABEE");
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + range * pct);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.stroke();

      // glow
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + range * pct);
      ctx.strokeStyle = pct < 0.4 ? "rgba(255,69,58,0.3)" : pct < 0.7 ? "rgba(255,159,10,0.3)" : "rgba(48,209,88,0.3)";
      ctx.lineWidth = 28;
      ctx.lineCap = "round";
      ctx.filter = "blur(8px)";
      ctx.stroke();
      ctx.filter = "none";
    }

    // tick marks
    for (let i = 0; i <= 10; i++) {
      const a = startAngle + (range * i) / 10;
      const inner = r - (i % 5 === 0 ? 22 : 18);
      const outer = r - 14;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.strokeStyle = i % 5 === 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)";
      ctx.lineWidth = i % 5 === 0 ? 2 : 1;
      ctx.stroke();
    }

    // needle
    const needleAngle = startAngle + range * pct;
    const needleLen = r - 30;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * needleLen, cy + Math.sin(needleAngle) * needleLen);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();

    // center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fill();

  }, [display, max]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
      <canvas ref={canvasRef} />
      <div style={{ position: "absolute", bottom: 45, textAlign: "center" }}>
        <div style={{ fontSize: 21, fontWeight: 800, fontFamily: "var(--display)", color: "#fff", letterSpacing: "-1px" }}>
          {testing ? display.toFixed(1) : (value != null ? value.toFixed(1) : "—")}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 500, marginTop: -2 }}>MB/s</div>
      </div>
      {phase && (
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          fontSize: 10, color: "var(--tg)", fontFamily: "var(--mono)",
          background: "rgba(42,171,238,0.1)", padding: "3px 10px", borderRadius: 20,
          border: "1px solid rgba(42,171,238,0.2)", whiteSpace: "nowrap" }}>
          {phase}
        </div>
      )}
    </div>
  );
}

/* ─── MINI RING ───────────────────────────────────────────── */
function MiniRing({ pct, color, size = 52 }) {
  const r = (size - 8) / 2;
  const c = Math.PI * 2 * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color}40)`, transition: "stroke-dasharray 1s ease" }} />
    </svg>
  );
}

/* ─── TOOLS PAGE ──────────────────────────────────────────── */
export default function ToolsPage() {
  const { realChannels, realStats } = useApp();
  const [testing, setTesting] = useState(false);
  const [phase, setPhase] = useState("");
  const [results, setResults] = useState(null);
  const [sysInfo, setSysInfo] = useState({ cpu: 0, battery: 100, batteryCharging: false, storage: 0 });

  // load last result on mount
  useEffect(() => {
    speedTestApi.last().then(r => { if (r.data?.tested_at) setResults(r.data); }).catch(() => {});
  }, []);

  // real CPU + battery via navigator APIs
  useEffect(() => {
    // battery
    if (navigator.getBattery) {
      navigator.getBattery().then(bat => {
        const update = () => setSysInfo(p => ({ ...p, battery: Math.round(bat.level * 100), batteryCharging: bat.charging }));
        update();
        bat.addEventListener("levelchange", update);
        bat.addEventListener("chargingchange", update);
      });
    }
    // CPU proxy: measure event loop lag
    let frame;
    let last = performance.now();
    const measure = () => {
      const now = performance.now();
      const lag = now - last - 16.67; // deviation from 60fps
      const cpu = Math.min(100, Math.max(2, lag * 3 + Math.random() * 10));
      setSysInfo(p => ({ ...p, cpu: p.cpu * 0.8 + cpu * 0.2 })); // smooth
      last = now;
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, []);

  // storage from realStats
  useEffect(() => {
    if (realStats?.total_bytes) {
      // show ratio vs 50GB as reference (arbitrary scale since Telegram = ∞)
      const pct = Math.min(99, Math.round((realStats.total_bytes / (50 * 1073741824)) * 100));
      setSysInfo(p => ({ ...p, storage: pct }));
    }
  }, [realStats]);

  const runTest = async () => {
    setTesting(true);
    setResults(null);
    setPhase("Testando download...");
    try {
      const { data } = await speedTestApi.run();
      setResults(data);
    } catch (e) {
      console.warn("Speed test error:", e);
    }
    setPhase("");
    setTesting(false);
  };

  const cpuColor = sysInfo.cpu > 80 ? "#FF453A" : sysInfo.cpu > 50 ? "#FF9F0A" : "#30D158";
  const batColor = sysInfo.battery > 50 ? "#30D158" : sysInfo.battery > 20 ? "#FF9F0A" : "#FF453A";

  // gauge shows the latest non-null result
  const gaugeVal = results?.telegram_mbps || results?.upload_mbps || results?.download_mbps || 0;

  return (
    <div style={{ padding: 26 }}>
      <div className="anim-fu" style={{ fontFamily: "var(--display)", fontSize: 19, fontWeight: 700, marginBottom: 20 }}>Ferramentas</div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14 }} className="anim-fu1">
        {/* speed gauge card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <SpeedGauge value={gaugeVal} max={100} testing={testing} phase={phase} />

          <button className="btn btn-primary" onClick={runTest} disabled={testing} style={{ marginTop: -6, padding: "10px 22px" }}>
            {testing ? <><Spinner size={13} /> Testando...</> : <><Icon n="zap" size={14} />Testar velocidade</>}
          </button>

          {/* result rows */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
            {[
              { label: "Download", icon: "↓", color: "#30D158", bg: "rgba(48,209,88,0.08)", value: results?.download_mbps },
              { label: "Upload", icon: "↑", color: "var(--tg)", bg: "rgba(42,171,238,0.08)", value: results?.upload_mbps },
              { label: "Telegram", icon: "⬆", color: "#BF5AF2", bg: "rgba(191,90,242,0.08)", value: results?.telegram_mbps },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-2" style={{
                padding: "8px 12px", borderRadius: 10, fontSize: 13, background: r.bg,
              }}>
                <span style={{ fontSize: 16, width: 22, textAlign: "center", color: r.color }}>{r.icon}</span>
                <span style={{ flex: 1, color: r.color, fontWeight: 500 }}>{r.label}</span>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 14,
                  color: r.value != null ? r.color : "rgba(255,255,255,0.2)" }}>
                  {r.value != null ? r.value.toFixed(1) : "—"}
                </span>
                {r.value != null && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>MB/s</span>}
              </div>
            ))}
          </div>

          {results?.tested_at && (
            <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 10, textAlign: "center", fontFamily: "var(--mono)" }}>
              Último teste: {new Date(results.tested_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>

        {/* right side widgets */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 14 }}>
          {/* CPU */}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>CPU</div>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MiniRing pct={sysInfo.cpu / 100} color={cpuColor} size={72} />
              <div style={{ position: "absolute", fontSize: 11, fontWeight: 600, fontFamily: "var(--font)" }}>
                {Math.round(sysInfo.cpu)}
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>%</span>
              </div>
            </div>
          </div>

          {/* Storage */}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Armazenamento</div>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MiniRing pct={sysInfo.storage / 100} color="var(--tg)" size={72} />
              <div style={{ position: "absolute", fontSize: 11, fontWeight: 600, fontFamily: "var(--font)" }}>
                {sysInfo.storage}
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>%</span>
              </div>
            </div>
          </div>

          {/* Battery */}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Bateria</div>
            <div style={{ fontFamily: "var(--display)", fontSize: 15, fontWeight: 600, color: batColor }}>
              {sysInfo.battery}<span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>%</span>
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 32, height: 16, borderRadius: 3, border: "2px solid rgba(255,255,255,0.25)", position: "relative" }}>
                <div style={{ height: "100%", borderRadius: 1, background: batColor, width: `${sysInfo.battery}%`, transition: "width 1s ease" }} />
                <div style={{ position: "absolute", right: -5, top: 3, width: 3, height: 8, borderRadius: "0 2px 2px 0", background: "rgba(255,255,255,0.25)" }} />
              </div>
              {sysInfo.batteryCharging && <span style={{ fontSize: 14, color: batColor, animation: "pulse 2s infinite" }}>⚡</span>}
            </div>
            <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6 }}>
              {sysInfo.batteryCharging ? "Carregando" : "Bateria"}
            </div>
          </div>

          {/* Telegram status */}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Telegram</div>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: realChannels.length > 0 ? "var(--green)" : "var(--text3)", marginBottom: 8,
              boxShadow: realChannels.length > 0 ? "0 0 12px rgba(48,209,88,0.4)" : "none" }} />
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--display)", color: realChannels.length > 0 ? "var(--green)" : "var(--text3)" }}>
              {realChannels.length > 0 ? "Online" : "Offline"}
            </div>
            <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4, fontFamily: "var(--mono)" }}>
              MTProto · Telethon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
