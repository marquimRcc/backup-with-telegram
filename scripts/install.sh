#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  TeleVault — Instalação para RegataOS / openSUSE
#  Uso: bash scripts/install.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

GREEN="\033[32m" BLUE="\033[34m" DIM="\033[2m" NC="\033[0m"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${GREEN}📦 TeleVault — Instalação${NC}"
echo -e "${DIM}   Diretório: ${DIR}${NC}\n"

# ── dependências de sistema ──
echo -e "${BLUE}[1/5] Verificando dependências de sistema...${NC}"
for cmd in python3.11 node npm; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "  ❌ $cmd não encontrado."
        if [ "$cmd" = "python3.11" ]; then
            echo "     Instale: sudo zypper install python311 python311-pip"
        else
            echo "     Instale: sudo zypper install nodejs20 npm20"
        fi
        exit 1
    fi
    echo "  ✅ $cmd: $(command -v "$cmd")"
done

# ── backend deps ──
echo -e "\n${BLUE}[2/5] Instalando dependências Python...${NC}"
cd "$DIR/backend"
pip3.11 install --break-system-packages -q -r requirements.txt 2>&1 | tail -3
echo "  ✅ Dependências Python instaladas"

# ── frontend deps ──
echo -e "\n${BLUE}[3/5] Instalando dependências Node.js...${NC}"
cd "$DIR/frontend"
npm install --silent 2>&1 | tail -3
echo "  ✅ Dependências Node.js instaladas"

# ── diretórios ──
echo -e "\n${BLUE}[4/5] Criando diretórios...${NC}"
mkdir -p ~/.televault/sessions
echo "  ✅ ~/.televault/sessions"

# ── .env ──
echo -e "\n${BLUE}[5/5] Configuração...${NC}"
if [ ! -f "$DIR/.env" ]; then
    cp "$DIR/.env.example" "$DIR/.env"
    echo "  ⚠️  .env criado a partir do .env.example"
    echo "     Edite $DIR/.env com suas credenciais do Telegram:"
    echo "     - TELEGRAM_API_ID"
    echo "     - TELEGRAM_API_HASH"
    echo "     - TELEVAULT_CHANNEL_ID"
else
    echo "  ✅ .env já existe"
fi

# ── .desktop ──
DESKTOP_DIR="$HOME/.local/share/applications"
mkdir -p "$DESKTOP_DIR"
ICON_SRC="$DIR/frontend/public/logo.svg"
ICON_DST="$HOME/.local/share/icons/televault.svg"
mkdir -p "$(dirname "$ICON_DST")"
if [ -f "$ICON_SRC" ]; then
    cp "$ICON_SRC" "$ICON_DST"
fi

cat > "$DESKTOP_DIR/televault.desktop" << DESK
[Desktop Entry]
Name=TeleVault
Comment=Backup pessoal direto no Telegram
Exec=bash -c "cd '$DIR' && bash dev.sh"
Icon=$ICON_DST
Type=Application
Categories=Utility;Archiving;Network;
Terminal=false
StartupNotify=true
DESK
chmod +x "$DESKTOP_DIR/televault.desktop"
echo "  ✅ Atalho criado no menu de apps"

echo -e "\n${GREEN}✅ Instalação concluída!${NC}"
echo -e "${DIM}   Para iniciar:  cd $DIR && bash dev.sh${NC}"
echo -e "${DIM}   Acesso:        http://localhost:5173${NC}"
echo -e "${DIM}   Backend:       http://localhost:8001${NC}"
