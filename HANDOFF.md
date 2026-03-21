# 📦 TeleVault — Handoff

> Backup pessoal direto no Telegram. Fork de [TGDrive](https://github.com/TechShreyash/TGDrive) com interface redesenhada para RegataOS / openSUSE.

---

## Contexto

App de backup pessoal que envia arquivos para canais privados do Telegram. Roda localmente na máquina do Marcos. Parte de um esforço de integração no RegataOS (distro Linux brasileira baseada em openSUSE).

**Status: protótipo funcional, rodando localmente.**

---

## O que funciona

### Backend (FastAPI + Telethon)
- Auth completo (send-code, sign-in, sign-out, session detection)
- Upload 2 fases: streaming chunked pro disco (10MB chunks, sem explodir RAM) → Telethon em background com SSE de progresso
- Download de arquivos (temp file com cleanup via BackgroundTasks)
- Delete de arquivos (Telegram + SQLite)
- Backup de pastas: input de caminhos → rglob recursivo → upload sequencial com SSE, deduplicação MD5 cross-session (lê checksums do DB)
- Stats com cache SQLite (TTL 5min, invalidado por upload/delete/backup)
- Histórico de backups persistido: `GET /api/backup/jobs`
- Segurança: SECRET_KEY auto-gerada, DEBUG=false default, rate limiting (auth 3/min, sign-in 5/min, upload 10/min), channel validation no backup, chmod 600 no .session, bind 127.0.0.1, temp cleanup no startup
- DB: SQLite com schema versioning (auto-recria se schema mudou), models: TelegramFile, BackupJobRecord, StatsCache, SchemaInfo

### Frontend (React 18 + Vite)
- Arquitetura modular: 11 arquivos em `src/`, state centralizado via Context + useReducer
- Wizard 2 etapas (phone → code → done)
- Dashboard: stats reais, breakdown por tipo de arquivo, log de atividade da sessão, storage real
- Arquivos: lista real do canal, upload 2 fases com barra contínua (30% HTTP + 70% Telegram), download, delete com confirmação, botão Atualizar
- Backup: input de caminhos locais, progresso SSE real (arquivo atual, velocidade, contadores), resumo em tempo real
- Atividade: sessão atual + histórico de backups do SQLite
- Settings: conta real (nome, phone, username), canal real (nome, tipo, id), versão do backend, preferences honestas ("em breve")

---

## Ambiente do Marcos

- **OS:** RegataOS (openSUSE-based)
- **Python:** 3.11
- **Canal de backup:** `TELEVAULT_CHANNEL_ID=3824740593`
- **Backend:** `http://localhost:8001` (porta 8000 ocupada)
- **Frontend:** `http://localhost:5173`
- **Sessão:** `~/.televault/sessions/televault.session`
- **Banco:** `~/.televault/televault.db`

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite (sem TypeScript, sem router, sem Zustand) |
| Backend | FastAPI + Telethon (MTProto) |
| Banco | SQLite via SQLAlchemy |
| Auth | Sessão Telethon local |
| Upload | Streaming chunked → Telethon send_file |
| Progress | Server-Sent Events (SSE) |

---

## Estrutura

```
televault/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py        ← Settings + SECRET_KEY auto + chmod .session
│   │   │   ├── database.py      ← Engine + schema versioning
│   │   │   ├── telegram.py      ← Wrapper Telethon
│   │   │   └── security.py      ← Rate limiter + channel validation
│   │   ├── api/
│   │   │   ├── auth.py          ← rate limited
│   │   │   ├── files.py         ← upload 2 fases + SSE + DB persist
│   │   │   ├── backup.py        ← start/cancel/progress/jobs
│   │   │   ├── channels.py
│   │   │   └── stats.py         ← cache SQLite 5min
│   │   ├── models/models.py     ← TelegramFile, BackupJobRecord, StatsCache
│   │   └── services/backup_service.py  ← dedup MD5 cross-session
│   └── requirements.txt
│
├── frontend/src/
│   ├── App.jsx              (46 linhas — shell)
│   ├── context.jsx          (118 linhas — state global)
│   ├── styles.jsx           (298 linhas — CSS)
│   ├── api.js               (110 linhas)
│   ├── components/
│   │   ├── common.jsx       (Icon, Spinner, Toggle, splitName, fmtSize)
│   │   ├── Layout.jsx       (Sidebar + Topbar)
│   │   └── Wizard.jsx
│   └── pages/
│       ├── Dashboard.jsx
│       ├── Files.jsx
│       ├── Backup.jsx
│       ├── Activity.jsx
│       └── Settings.jsx
│
├── televault-setup.py
├── scripts/install.sh
├── docker-compose.yml
└── .env.example
```

---

## Como rodar

```bash
# Backend (terminal 1)
cd backend && python3.11 -m uvicorn app.main:app --reload --port 8001

# Frontend (terminal 2)
cd frontend && npm install && npm run dev
```

---

## O que falta

### Funcional
1. **Agendamentos (cron)** — toggles na UI marcados "em breve", sem scheduler no backend. Precisa APScheduler ou asyncio loop.
2. **inotify (backup automático)** — `WATCH_DIRS` no config mas sem código.
3. **Seletor de pastas nativo** — hoje é input de texto. Endpoint `GET /api/fs/browse` resolveria.
4. **Download com progresso** — funciona via nova aba mas sem barra de progresso dentro da UI.

### Empacotamento RegataOS
5. `.rpm` ou AppImage
6. Integrar no RegataOS Welcome
7. Ícone real (`.desktop` aponta pra logo que não existe)

### Nice to have
8. Frontend: separar `styles.jsx` em CSS modules ou Tailwind
9. Testes unitários backend
10. Alembic migrations (hoje dropa e recria o schema)

---

## Observações importantes

1. **Conta com spam report:** conta principal do Marcos tem spam report, não cria canais via API. Canal foi criado manualmente.
2. **IDs do Telegram:** canais têm dois formatos — `3824740593` (puro) e `-1003824740593` (marked com -100). `security.py` normaliza ambos.
3. **python-multipart** necessário para upload: `pip3.11 install python-multipart --break-system-packages`
4. **Nome concatenado:** `first_name="MarcosQueiroz"` vem sem espaço do Telegram. `splitName()` separa via regex.
5. **Channel validation:** só se aplica no endpoint de backup. Upload/download/list aceitam qualquer canal dos dialogs do usuário.

---

## Convenções

- Backend: Python 3.11, async/await, Telethon para tudo Telegram
- Frontend: React funcional com hooks, sem TypeScript, CSS-in-JS inline
- Estilo visual: dark theme (`#080C12`), azul Telegram (`#2AABEE`), fontes Outfit + Syne + JetBrains Mono
- Comandos sempre em linha única (preferência do Marcos)
- Arquivos atualizados são disponibilizados para download antes de pedir para substituir
