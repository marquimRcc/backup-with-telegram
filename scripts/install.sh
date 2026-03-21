#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  TeleVault — Instalação rápida para RegataOS / openSUSE
#  Uso: bash scripts/install.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

TV_DIR="$HOME/.local/share/televault"
TV_VENV="$TV_DIR/venv"
TV_REPO="$(cd "$(dirname "$0")/.." && pwd)"
TV_SERVICE="$HOME/.config/systemd/user/televault.service"
TV_DESKTOP="$HOME/.local/share/applications/televault.desktop"

GREEN="\033[0;32m" BLUE="\033[0;34m" YELLOW="\033[1;33m" NC="\033[0m"

log()  { echo -e "${BLUE}[TeleVault]${NC} $*"; }
ok()   { echo -e "${GREEN}✅${NC} $*"; }
warn() { echo -e "${YELLOW}⚠️${NC} $*"; }

log "Instalando TeleVault em $TV_DIR"

# ── dependências do sistema ───────────────────────────────────
log "Verificando dependências..."
if ! command -v python3.11 &>/dev/null; then
    warn "python3.11 não encontrado. Instalando via zypper..."
    sudo zypper install -y python311 python311-pip python311-virtualenv
fi

if ! command -v node &>/dev/null; then
    warn "Node.js não encontrado. Instalando..."
    sudo zypper install -y nodejs20 npm20
fi

# ── diretórios ────────────────────────────────────────────────
mkdir -p "$TV_DIR" "$HOME/.televault/sessions"

# ── Python venv ───────────────────────────────────────────────
log "Criando virtualenv Python..."
python3.11 -m venv "$TV_VENV"
source "$TV_VENV/bin/activate"
pip install --upgrade pip -q
pip install -r "$TV_REPO/backend/requirements.txt" -q
deactivate
ok "Backend Python pronto"

# ── Frontend build ────────────────────────────────────────────
log "Buildando frontend..."
cd "$TV_REPO/frontend"
npm install --silent
npm run build --silent
ok "Frontend buildado"

# ── .env ─────────────────────────────────────────────────────
if [ ! -f "$TV_REPO/.env" ]; then
    log "Criando .env — você precisará preencher API_ID e API_HASH"
    cat > "$TV_REPO/.env" <<EOF
# Obtenha em: https://my.telegram.org/apps
TELEGRAM_API_ID=0
TELEGRAM_API_HASH=

# Mude em produção!
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

DEBUG=false
EOF
    warn "⚡ Preencha TELEGRAM_API_ID e TELEGRAM_API_HASH no arquivo .env antes de usar!"
fi

# ── systemd user service ──────────────────────────────────────
mkdir -p "$(dirname "$TV_SERVICE")"
cat > "$TV_SERVICE" <<EOF
[Unit]
Description=TeleVault — Backup para Telegram
After=network.target

[Service]
Type=simple
WorkingDirectory=$TV_REPO/backend
ExecStart=$TV_VENV/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5
Environment=PYTHONPATH=$TV_REPO/backend
EnvironmentFile=$TV_REPO/.env

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable televault
ok "Serviço systemd configurado"

# ── .desktop (lançador KDE) ───────────────────────────────────
mkdir -p "$(dirname "$TV_DESKTOP")"
cat > "$TV_DESKTOP" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=TeleVault
Comment=Backup pessoal no Telegram
Exec=xdg-open http://localhost:3000
Icon=$TV_REPO/frontend/public/logo.png
Terminal=false
Categories=Utility;System;
Keywords=backup;telegram;cloud;
EOF
ok "Lançador KDE criado"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  TeleVault instalado com sucesso! 🎉${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  1. Preencha .env com TELEGRAM_API_ID e TELEGRAM_API_HASH"
echo "     → https://my.telegram.org/apps"
echo ""
echo "  2. Inicie o servidor:"
echo "     systemctl --user start televault"
echo ""
echo "  3. Abra no navegador:"
echo "     http://localhost:3000"
echo ""
