# 📦 TeleVault — Handoff v0.2.0

---

## Contexto

App de backup pessoal que envia arquivos para canais privados do Telegram como armazenamento ilimitado. Fork de TGDrive. Interface moderna para RegataOS (distro Linux brasileira, openSUSE-based).

**Status: funcional, rodando localmente, push no GitHub.**

**Repo:** `git@github.com:marquimRcc/backup-with-telegram.git`

---

## O que funciona

### Backend (FastAPI + Telethon)
- Auth completo (send-code, sign-in, sign-out, session detection)
- Upload 2 fases: streaming chunked pro disco (10MB chunks) → Telethon em background com SSE
- Download com streaming + cleanup via BackgroundTasks
- Delete de arquivos (Telegram + SQLite)
- Backup de pastas: seletor visual (tree picker via GET /api/fs/browse) ou input manual, rglob recursivo, upload sequencial com SSE, deduplicação MD5 cross-session, pause/resume
- Stats com cache SQLite (TTL 5min, invalidação automática)
- Histórico de backups: GET /api/backup/jobs
- Speed test: POST /api/speed-test (download 25MB Cloudflare + upload 10MB Cloudflare + upload 5MB Telegram)
- Browse filesystem: GET /api/fs/browse?path=/home (restrito a /home, /tmp, /mnt, /media)
- Autostart: GET/POST /api/system/autostart — cria/remove systemd user service
- Segurança: SECRET_KEY auto-gerada, rate limiting, channel validation, chmod 600 .session, bind 127.0.0.1
- DB: SQLite com migração aditiva (cria tabelas novas sem dropar existentes)

### Frontend (React 18 + Vite)
- 14 arquivos em src/, state centralizado via Context + useReducer
- Wizard 2 etapas (phone → code → done)
- Dashboard: stats reais, breakdown por tipo, log de atividade
- Arquivos: fila multi-arquivo com pause/cancel individual, upload queue sobrevive navegação, download com progresso dentro da UI, lista colapsável
- Backup: tree picker visual para selecionar pastas, progress SSE com pause/resume
- Ferramentas: speed test com gauge canvas animado (ponteiro needle), widgets CPU/bateria/armazenamento/Telegram
- Atividade: sessão atual + histórico do SQLite
- Settings: autostart toggle funcional (systemd), conta real, canal real, versão dinâmica
- Logo SVG + favicon

---

## Ambiente

- **OS:** RegataOS (openSUSE-based)
- **Python:** 3.11
- **Canal:** TELEVAULT_CHANNEL_ID=3824740593
- **Backend:** http://localhost:8001
- **Frontend:** http://localhost:5173
- **Sessão:** ~/.televault/sessions/televault.session
- **Banco:** ~/.televault/televault.db

---

## Estrutura

```
backend/app/
├── main.py                    ← FastAPI + lifespan + 8 routers
├── core/
│   ├── config.py              ← Settings, SECRET_KEY auto, chmod .session
│   ├── database.py            ← SQLite, migração aditiva
│   ├── telegram.py            ← Wrapper Telethon
│   └── security.py            ← Rate limiter + channel validation
├── api/
│   ├── auth.py                ← rate limited
│   ├── files.py               ← upload 2 fases, download, delete
│   ├── backup.py              ← start/cancel/pause/resume/progress/jobs
│   ├── channels.py
│   ├── stats.py               ← cache SQLite 5min
│   ├── speedtest.py           ← 3 testes (cloudflare + telegram)
│   ├── browse.py              ← filesystem tree picker
│   └── system.py              ← systemd autostart
├── models/models.py           ← TelegramFile, BackupJobRecord, StatsCache
└── services/backup_service.py ← dedup MD5, pause/resume

frontend/src/
├── App.jsx              (48 linhas — shell)
├── context.jsx          (~240 linhas — state + upload queue)
├── styles.jsx           (~298 linhas — CSS)
├── api.js               (~148 linhas — HTTP + SSE + download + browse)
├── components/
│   ├── common.jsx       (Icon [25 ícones], Spinner, Toggle, splitName, fmtSize)
│   ├── Layout.jsx       (Sidebar 6 itens + Topbar)
│   └── Wizard.jsx
└── pages/
    ├── Dashboard.jsx    (stats, backup status, folders, activity)
    ├── Files.jsx        (upload queue, download progress, list)
    ├── Backup.jsx       (tree picker, progress, schedules)
    ├── Tools.jsx        (speed gauge, CPU, battery, storage, telegram)
    ├── Activity.jsx     (session + DB history)
    └── Settings.jsx     (autostart toggle, account, channel, about)
```

---

## O que falta

### Funcional
1. **Agendamentos (cron)** — toggles na UI existem mas não fazem nada. Precisa APScheduler ou asyncio loop no backend.
2. **inotify (backup automático)** — WATCH_DIRS no config mas sem código. Usar watchdog ou inotify_simple.
3. **Empacotamento RegataOS** — .rpm ou AppImage + integrar no RegataOS Welcome.

### Nice to have
4. **Notificações desktop** — libnotify ou dbus
5. **System tray** — pystray ou equivalente KDE
6. **Testes unitários** — backend (pytest) e frontend (vitest)

---

## Observações

1. Conta tem spam report — canal criado manualmente, não via API
2. IDs Telegram: dois formatos (3824740593 vs -1003824740593), security.py normaliza
3. Upload preserva nome original: salva em uploads_tmp/{upload_id}/nome.ext
4. splitName("MarcosQueiroz") → "Marcos Queiroz"
5. Channel validation só no backup endpoint, não em files/stats
6. Banco migra sem perder dados (create_all, não drop)

---

## Convenções

- Comandos sempre em linha única
- Arquivos alterados enviados completos (não diffs)
- Backend: Python 3.11, async/await
- Frontend: React funcional com hooks, CSS-in-JS inline
- Dark theme: #080C12, azul Telegram #2AABEE, fontes Outfit + Syne + JetBrains Mono
