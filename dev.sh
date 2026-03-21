#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  TeleVault — dev.sh
#  Inicia backend + frontend em paralelo com um único comando.
#  Uso: bash dev.sh
#  Para parar tudo: Ctrl+C
# ─────────────────────────────────────────────────────────────
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8001}"

BLUE="\033[34m" GREEN="\033[32m" DIM="\033[2m" NC="\033[0m"

echo -e "${GREEN}📦 TeleVault — Dev Mode${NC}"
echo -e "${DIM}   Backend:  http://localhost:${PORT}  (FastAPI + Telethon)${NC}"
echo -e "${DIM}   Frontend: http://localhost:5173  (Vite)${NC}"
echo -e "${DIM}   Ctrl+C para parar tudo${NC}"
echo ""

# cleanup ao sair
cleanup() {
    echo -e "\n${DIM}Parando processos...${NC}"
    kill $PID_BACK $PID_FRONT 2>/dev/null || true
    wait $PID_BACK $PID_FRONT 2>/dev/null || true
    echo -e "${GREEN}✓ Tudo parado.${NC}"
}
trap cleanup EXIT INT TERM

# backend
cd "$DIR/backend"
python3.11 -m uvicorn app.main:app --reload --host 127.0.0.1 --port "$PORT" 2>&1 | sed "s/^/[backend]  /" &
PID_BACK=$!

# frontend
cd "$DIR/frontend"
npm run dev 2>&1 | sed "s/^/[frontend] /" &
PID_FRONT=$!

# espera qualquer um terminar
wait -n $PID_BACK $PID_FRONT 2>/dev/null || true
