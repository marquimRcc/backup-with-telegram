/**
 * styles.jsx — CSS global do TeleVault
 */

const G = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:        #080C12;
      --bg1:       #0C1119;
      --bg2:       #111824;
      --bg3:       #18212E;
      --border:    #1C2736;
      --border2:   #243040;
      --text:      #D8E6F3;
      --text2:     #6B8299;
      --text3:     #3D5166;
      --tg:        #2AABEE;
      --tg2:       #1A8FD1;
      --tg3:       rgba(42,171,238,0.12);
      --tg-glow:   rgba(42,171,238,0.2);
      --green:     #30D158;
      --yellow:    #FFD60A;
      --red:       #FF453A;
      --font:      'Outfit', sans-serif;
      --mono:      'JetBrains Mono', monospace;
      --display:   'Syne', sans-serif;
    }
    html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); }
    ::-webkit-scrollbar { width: 3px; height: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
    input, button { font-family: var(--font); }

    @keyframes fadeUp   { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
    @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
    @keyframes scaleIn  { from { opacity:0; transform:scale(0.94) } to { opacity:1; transform:scale(1) } }
    @keyframes spin     { to { transform:rotate(360deg) } }
    @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes shimmer  { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
    @keyframes glowPing { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(2.2);opacity:0} }
    @keyframes countUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

    .anim-fu  { animation: fadeUp  .4s cubic-bezier(.22,1,.36,1) both }
    .anim-fu1 { animation: fadeUp  .4s .07s cubic-bezier(.22,1,.36,1) both }
    .anim-fu2 { animation: fadeUp  .4s .14s cubic-bezier(.22,1,.36,1) both }
    .anim-fu3 { animation: fadeUp  .4s .21s cubic-bezier(.22,1,.36,1) both }
    .anim-fu4 { animation: fadeUp  .4s .28s cubic-bezier(.22,1,.36,1) both }
    .anim-si  { animation: scaleIn .35s cubic-bezier(.22,1,.36,1) both }
    .anim-fi  { animation: fadeIn  .25s both }

    .card { background: var(--bg1); border: 1px solid var(--border); border-radius: 14px; }

    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 7px;
      padding: 9px 18px; border-radius: 10px; border: none;
      font-size: 13.5px; font-weight: 500; cursor: pointer;
      transition: all .15s; white-space: nowrap;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--tg), var(--tg2));
      color: #fff; box-shadow: 0 2px 12px rgba(42,171,238,.3);
    }
    .btn-primary:hover:not(:disabled) { box-shadow: 0 4px 20px rgba(42,171,238,.45); transform: translateY(-1px); }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none !important; }
    .btn-ghost  { background: transparent; color: var(--text2); border: 1px solid var(--border); }
    .btn-ghost:hover { background: var(--bg2); border-color: var(--border2); color: var(--text); }
    .btn-danger { background: rgba(255,69,58,.1); color: var(--red); border: 1px solid rgba(255,69,58,.2); }
    .btn-sm { padding: 6px 13px; font-size: 12px; border-radius: 8px; }
    .btn-icon { width:34px; height:34px; padding:0; border-radius:9px; }

    .input {
      width: 100%; padding: 11px 14px;
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 10px; color: var(--text); font-size: 14px; outline: none;
      transition: border-color .2s, box-shadow .2s;
    }
    .input:focus { border-color: var(--tg); box-shadow: 0 0 0 3px rgba(42,171,238,.1); }
    .input::placeholder { color: var(--text3); }

    .tag {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 9px; border-radius: 20px;
      font-size: 11px; font-weight: 500; font-family: var(--mono);
    }
    .tag-blue   { background: var(--tg3); color: var(--tg); border: 1px solid rgba(42,171,238,.2); }
    .tag-green  { background: rgba(48,209,88,.1); color: var(--green); border: 1px solid rgba(48,209,88,.2); }
    .tag-yellow { background: rgba(255,214,10,.1); color: var(--yellow); border: 1px solid rgba(255,214,10,.2); }
    .tag-gray   { background: var(--bg2); color: var(--text2); border: 1px solid var(--border); }

    .divider { height: 1px; background: var(--border); }

    .progress { height: 5px; background: var(--bg3); border-radius: 3px; overflow: hidden; }
    .progress-fill {
      height: 100%; border-radius: 3px;
      background: linear-gradient(90deg, var(--tg), #60CFFF);
      position: relative; overflow: hidden;
      transition: width .6s cubic-bezier(.4,0,.2,1);
    }
    .progress-fill::after {
      content:''; position:absolute; inset:0;
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.25) 50%, transparent 100%);
      animation: shimmer 1.8s infinite;
    }

    .sidebar {
      width: 210px; flex-shrink: 0;
      background: var(--bg1); border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
    }
    .sidebar-logo {
      padding: 18px 16px 14px;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 11px;
    }
    .logo-mark {
      width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
      background: linear-gradient(145deg, var(--tg) 0%, #0D6FA8 100%);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 16px rgba(42,171,238,.25);
    }
    .logo-text { font-family: var(--display); font-size: 15px; font-weight: 700; letter-spacing: -.3px; }
    .logo-text span { color: var(--tg); }

    .nav-section { padding: 12px 8px 8px; }
    .nav-section-label { font-size: 10px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: .1em; padding: 0 8px; margin-bottom: 4px; }

    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; border-radius: 9px;
      font-size: 13.5px; font-weight: 500; color: var(--text2);
      cursor: pointer; transition: all .15s; position: relative;
    }
    .nav-item:hover { background: var(--bg2); color: var(--text); }
    .nav-item.active { background: var(--tg3); color: var(--tg); }
    .nav-item.active::before {
      content:''; position:absolute; left:0; top:50%; transform:translateY(-50%);
      width: 3px; height: 55%; background: var(--tg); border-radius: 0 2px 2px 0;
    }

    .sidebar-bottom { margin-top: auto; padding: 10px 8px; border-top: 1px solid var(--border); }
    .user-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 9px; cursor: pointer; transition: background .15s;
    }
    .user-row:hover { background: var(--bg2); }
    .avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: linear-gradient(135deg, #1A8FD1, #0D5FA0);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .user-name  { font-size: 13px; font-weight: 500; }
    .user-phone { font-size: 11px; color: var(--text3); font-family: var(--mono); }

    .topbar {
      height: 50px; border-bottom: 1px solid var(--border);
      background: var(--bg1);
      display: flex; align-items: center; padding: 0 22px; gap: 14px; flex-shrink: 0;
    }
    .topbar-title { font-family: var(--display); font-size: 14px; font-weight: 600; }

    .status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; position: relative; }
    .status-dot.green  { background: var(--green); }
    .status-dot.green::after { content:''; position:absolute; inset:-2px; border-radius:50%; background:var(--green); opacity:.3; animation: glowPing 2.5s infinite; }
    .status-dot.yellow { background: var(--yellow); animation: pulse 1.2s infinite; }
    .status-dot.gray   { background: var(--text3); }

    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .stat-card {
      background: var(--bg1); border: 1px solid var(--border);
      border-radius: 14px; padding: 18px 20px;
      position: relative; overflow: hidden;
      transition: border-color .2s, transform .15s;
    }
    .stat-card:hover { border-color: var(--border2); transform: translateY(-2px); }
    .stat-card::before {
      content:''; position:absolute; top:0; left:0; right:0; height:1px;
      background: linear-gradient(90deg, transparent, rgba(42,171,238,.3), transparent);
    }
    .stat-icon { width:36px; height:36px; border-radius:9px; display:flex; align-items:center; justify-content:center; margin-bottom:14px; }
    .stat-value { font-family: var(--display); font-size: 24px; font-weight: 700; line-height: 1; margin-bottom: 4px; animation: countUp .5s both; }
    .stat-label { font-size: 12px; color: var(--text2); }
    .stat-delta { font-size: 11px; margin-top: 6px; font-family: var(--mono); }

    .file-row {
      display: flex; align-items: center; gap: 10px;
      padding: 7px 10px; border-radius: 8px; cursor: pointer;
      transition: background .12s; font-size: 13px; user-select: none;
    }
    .file-row:hover { background: var(--bg2); }
    .file-row.selected { background: var(--tg3); color: var(--tg); }

    .ch-opt {
      border: 2px solid var(--border); border-radius: 12px;
      padding: 15px 16px; cursor: pointer;
      transition: all .2s; background: var(--bg); position: relative;
    }
    .ch-opt:hover { border-color: var(--border2); background: var(--bg1); }
    .ch-opt.sel   { border-color: var(--tg); background: rgba(42,171,238,.05); }
    .ch-opt-check {
      position:absolute; top:12px; right:12px;
      width:20px; height:20px; border-radius:50%;
      background: var(--tg); display:flex; align-items:center; justify-content:center;
      opacity:0; transform:scale(.6); transition: all .2s;
    }
    .ch-opt.sel .ch-opt-check { opacity:1; transform:scale(1); }

    .fp-item {
      background:var(--bg2); border:1px solid var(--border);
      border-radius:10px; padding:11px 8px;
      text-align:center; font-size:11.5px; color:var(--text2);
      transition: all .2s; cursor:pointer;
    }
    .fp-item:hover { border-color:var(--border2); }
    .fp-item.on { border-color:rgba(42,171,238,.4); background:rgba(42,171,238,.06); color:var(--tg); }
    .fp-emoji { font-size:19px; display:block; margin-bottom:5px; }

    .log-item { display:flex; gap:12px; padding:10px 0; border-bottom:1px solid var(--border); font-size:13px; }
    .log-item:last-child { border:none; }

    .bk-item {
      display:flex; align-items:center; gap:12px;
      padding:11px 14px; border-radius:10px;
      background:var(--bg2); border:1px solid var(--border);
      font-size:13px; margin-bottom:6px; transition:border-color .2s;
    }
    .bk-item-icon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

    .sched-row {
      display:flex; align-items:center; justify-content:space-between;
      padding:13px 14px; border-radius:10px;
      background:var(--bg2); border:1px solid var(--border); margin-bottom:8px;
    }

    .toggle { width:38px; height:22px; border-radius:11px; border:none; cursor:pointer; transition:background .2s; position:relative; flex-shrink:0; }
    .toggle.on  { background:var(--tg); }
    .toggle.off { background:var(--bg3); }
    .toggle-knob { position:absolute; top:3px; width:16px; height:16px; border-radius:50%; background:white; transition:left .2s; box-shadow:0 1px 4px rgba(0,0,0,.3); }
    .toggle.on  .toggle-knob { left:19px; }
    .toggle.off .toggle-knob { left:3px; }

    .wizard-wrap {
      height:100vh; display:flex; align-items:center; justify-content:center;
      background:
        radial-gradient(ellipse 60% 50% at 20% 10%, rgba(42,171,238,.07) 0%, transparent 70%),
        radial-gradient(ellipse 50% 40% at 85% 85%, rgba(26,111,168,.05) 0%, transparent 70%),
        var(--bg);
    }
    .wizard-card {
      width:460px; background:var(--bg1);
      border:1px solid var(--border); border-radius:22px;
      padding:40px; position:relative; overflow:hidden;
    }
    .wizard-card::before {
      content:''; position:absolute; top:0; left:0; right:0; height:1px;
      background:linear-gradient(90deg, transparent 10%, rgba(42,171,238,.5) 50%, transparent 90%);
    }
    .wiz-step-bar { display:flex; gap:5px; margin-bottom:28px; }
    .wiz-dot { height:3px; flex:1; border-radius:2px; background:var(--border); transition:background .3s; }
    .wiz-dot.done   { background:rgba(42,171,238,.4); }
    .wiz-dot.active { background:var(--tg); }
    .wiz-logo {
      width:50px; height:50px; border-radius:15px;
      background:linear-gradient(145deg, var(--tg) 0%, #0A60A0 100%);
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 0 28px rgba(42,171,238,.3); margin-bottom:20px;
    }
    .wiz-title { font-family:var(--display); font-size:22px; font-weight:700; margin-bottom:6px; letter-spacing:-.3px; }
    .wiz-sub   { font-size:13.5px; color:var(--text2); margin-bottom:24px; line-height:1.6; }
    .form-lbl  { font-size:11px; font-weight:600; color:var(--text2); text-transform:uppercase; letter-spacing:.08em; display:block; margin-bottom:7px; }
    .form-grp  { margin-bottom:16px; }

    .fp-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:14px 0; }

    .empty { text-align:center; padding:50px 20px; color:var(--text2); }
    .empty-icon { font-size:42px; margin-bottom:14px; }
    .empty-title { font-size:16px; font-weight:600; color:var(--text); margin-bottom:6px; }
    .empty-sub   { font-size:13px; line-height:1.6; }

    .flex     { display:flex; }
    .flex-col { flex-direction:column; }
    .items-center { align-items:center; }
    .justify-between { justify-content:space-between; }
    .gap-2 { gap:8px; }
    .gap-3 { gap:12px; }
    .gap-4 { gap:16px; }
    .ml-auto { margin-left:auto; }
    .w-full  { width:100%; }
    .mono    { font-family:var(--mono); }
    .pointer { cursor:pointer; }
  `}</style>
);


export default G;
