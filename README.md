# 📦 TeleVault

> Backup pessoal direto no Telegram. Interface moderna para enviar, organizar e recuperar seus arquivos usando canais privados como armazenamento ilimitado.

Baseado em [TGDrive](https://github.com/TechShreyash/TGDrive) · Redesenhado para RegataOS / openSUSE.

---

## Funcionalidades

- **Upload de arquivos** com fila multi-arquivo, pause/cancel individual por arquivo, progresso em 2 fases (servidor + Telegram)
- **Download com progresso** dentro da interface (sem abrir nova aba)
- **Backup de pastas** com seletor visual (tree picker) ou input manual, deduplicação MD5 cross-session, pause/resume
- **Ferramentas** — speed test (download/upload/Telegram) com gauge animado, CPU, bateria, armazenamento
- **Dashboard** com estatísticas reais do canal, breakdown por tipo, log de atividade
- **Histórico de backups** persistido em SQLite
- **Autostart** — toggle funcional que cria/remove systemd user service
- **Segurança** — SECRET_KEY auto-gerada, rate limiting, chmod 600 no .session, bind localhost

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite |
| Backend | FastAPI + Telethon (MTProto) |
| Banco | SQLite via SQLAlchemy (migração aditiva) |
| Auth | Sessão Telethon local |
| Upload | Streaming chunked → Telethon send_file |
| Progress | Server-Sent Events (SSE) |

## Estrutura

```
televault/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py       ← migração aditiva (sem perder dados)
│   │   │   ├── telegram.py
│   │   │   └── security.py
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── files.py          ← upload 2-fases, download, delete
│   │   │   ├── backup.py         ← start/cancel/pause/resume/progress/jobs
│   │   │   ├── channels.py
│   │   │   ├── stats.py
│   │   │   ├── speedtest.py      ← download + upload + Telegram speed test
│   │   │   ├── browse.py         ← seletor de pastas do filesystem
│   │   │   └── system.py         ← autostart systemd
│   │   ├── models/models.py
│   │   └── services/backup_service.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx               ← shell (48 linhas)
│   │   ├── context.jsx           ← state global + upload queue
│   │   ├── styles.jsx            ← CSS global
│   │   ├── api.js                ← HTTP + SSE + download progress + browse
│   │   ├── components/
│   │   │   ├── common.jsx        ← Icon, Spinner, Toggle, helpers
│   │   │   ├── Layout.jsx        ← Sidebar + Topbar (6 itens nav)
│   │   │   └── Wizard.jsx
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       ├── Files.jsx          ← upload queue + download progress
│   │       ├── Backup.jsx         ← tree picker + progress
│   │       ├── Tools.jsx          ← speed gauge + CPU + bateria
│   │       ├── Activity.jsx
│   │       └── Settings.jsx       ← autostart funcional
│   ├── public/
│   │   ├── logo.svg
│   │   └── favicon.svg
│   └── package.json
│
├── scripts/install.sh
├── dev.sh
├── televault.desktop
├── .env.example
├── README.md
└── HANDOFF.md
```

## Instalação

```bash
git clone https://github.com/marquimRcc/backup-with-telegram
cd backup-with-telegram
bash scripts/install.sh
```

O script verifica dependências, instala pacotes, cria diretórios e registra o atalho no menu de apps.

### Pré-requisitos

- **Python 3.11+** e **Node.js 18+**
- Credenciais do Telegram: [my.telegram.org/apps](https://my.telegram.org/apps)
- Canal privado criado no Telegram

### Dev local

```bash
bash dev.sh
```

Backend: `http://localhost:8001` · Frontend: `http://localhost:5173`

## Roadmap

- [x] Upload/download/delete com progresso real
- [x] Fila multi-arquivo com pause/cancel individual
- [x] Download com progresso dentro da UI
- [x] Backup com seletor de pastas (tree picker)
- [x] Speed test com gauge animado
- [x] Widgets de sistema (CPU, bateria, armazenamento)
- [x] Autostart via systemd user service
- [x] Migração de banco sem perder dados
- [x] Ícone e .desktop para RegataOS
- [ ] Agendamentos (cron) funcionais
- [ ] Monitoramento inotify (backup automático)
- [ ] Empacotamento .rpm / AppImage

## Licença

MIT · Baseado em [TGDrive](https://github.com/TechShreyash/TGDrive) por TechShreyash
