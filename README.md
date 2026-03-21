# 📦 TeleVault

> Backup pessoal direto no Telegram. Interface moderna para enviar, organizar e recuperar seus arquivos usando canais privados do Telegram como armazenamento ilimitado.

Baseado em [TGDrive](https://github.com/TechShreyash/TGDrive) · Redesenhado para RegataOS / openSUSE.

---

## Funcionalidades

- **Upload de arquivos** com progresso em 2 fases (servidor + Telegram) e velocidade em tempo real
- **Download e exclusão** de arquivos direto do canal Telegram
- **Backup de pastas** com varredura recursiva, deduplicação MD5 cross-session e progresso SSE
- **Dashboard** com estatísticas reais do canal (cache SQLite, breakdown por tipo de arquivo)
- **Histórico de backups** persistido no banco de dados local
- **Log de atividades** com eventos em tempo real (uploads, downloads, backups)
- **Wizard de setup** — conecta ao Telegram em 2 cliques
- **Segurança** — SECRET_KEY auto-gerada, rate limiting, chmod 600 no .session, bind localhost

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite |
| Backend | FastAPI + Telethon (MTProto) |
| Banco | SQLite via SQLAlchemy |
| Auth | Sessão Telethon local |
| Upload | Streaming chunked → Telethon send_file |
| Progress | Server-Sent Events (SSE) |

## Estrutura

```
televault/
├── backend/
│   ├── app/
│   │   ├── main.py                 ← FastAPI app + lifespan
│   │   ├── core/
│   │   │   ├── config.py           ← Settings (pydantic-settings)
│   │   │   ├── database.py         ← Engine SQLite + schema versioning
│   │   │   ├── telegram.py         ← Wrapper Telethon
│   │   │   └── security.py         ← Rate limiter + channel validation
│   │   ├── api/
│   │   │   ├── auth.py             ← Login, send-code, sign-out
│   │   │   ├── files.py            ← Upload 2-fases, download, delete, SSE
│   │   │   ├── backup.py           ← Start, cancel, progress SSE, histórico
│   │   │   ├── channels.py         ← Listar canais
│   │   │   └── stats.py            ← Stats com cache SQLite
│   │   ├── models/models.py        ← TelegramFile, BackupJobRecord, StatsCache
│   │   └── services/backup_service.py  ← Orquestração + deduplicação MD5
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 ← Shell (~46 linhas)
│   │   ├── context.jsx             ← State global (useReducer)
│   │   ├── styles.jsx              ← CSS global
│   │   ├── api.js                  ← Cliente HTTP + SSE
│   │   ├── components/
│   │   │   ├── common.jsx          ← Icon, Spinner, Toggle, helpers
│   │   │   ├── Layout.jsx          ← Sidebar + Topbar
│   │   │   └── Wizard.jsx          ← Fluxo de setup
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       ├── Files.jsx
│   │       ├── Backup.jsx
│   │       ├── Activity.jsx
│   │       └── Settings.jsx
│   └── package.json
│
├── televault-setup.py              ← Setup interativo
├── scripts/install.sh              ← Instalação RegataOS
├── docker-compose.yml
└── .env.example
```

## Instalação rápida

```bash
git clone https://github.com/SEU_USUARIO/televault
cd televault
python3.11 televault-setup.py
```

O script instala dependências, autentica com o Telegram, cria o canal de backup e sobe o servidor.

### Pré-requisitos

1. **Python 3.11+** e **Node.js 18+**
2. Credenciais do Telegram em [my.telegram.org/apps](https://my.telegram.org/apps)
3. Número de telefone com formato `+5534988420000`

### Dev local

```bash
# Terminal 1 — Backend
cd backend && python3.11 -m uvicorn app.main:app --reload --port 8001

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

Acesso: `http://localhost:5173`

## Roadmap

- [x] Upload/download/delete de arquivos com progresso real
- [x] Backup de pastas com deduplicação MD5
- [x] Persistência SQLite (arquivos, jobs, stats cache)
- [x] Dashboard com dados reais
- [x] Segurança (rate limiting, channel validation, session protection)
- [x] Frontend modular (11 arquivos, context centralizado)
- [ ] Agendamentos (cron) funcionais
- [ ] Monitoramento por inotify (backup automático)
- [ ] Seletor de pastas nativo (tree picker)
- [ ] Empacotamento .rpm / AppImage para RegataOS

## Licença

MIT · Baseado em [TGDrive](https://github.com/TechShreyash/TGDrive) por TechShreyash
