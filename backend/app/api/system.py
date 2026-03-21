"""
app/api/system.py
GET  /api/system/autostart         → verifica se autostart está ativo
POST /api/system/autostart/enable  → cria systemd user service
POST /api/system/autostart/disable → remove systemd user service
"""

import logging
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()
log = logging.getLogger("televault.system")

SERVICE_NAME = "televault"
SERVICE_DIR = Path.home() / ".config" / "systemd" / "user"
SERVICE_PATH = SERVICE_DIR / f"{SERVICE_NAME}.service"


def _find_project_root() -> Path:
    """Encontra raiz do projeto a partir do backend."""
    # backend/app/api/system.py → backend/ → project_root/
    here = Path(__file__).resolve()
    return here.parent.parent.parent.parent


def _generate_service() -> str:
    """Gera conteúdo do .service apontando pro projeto atual."""
    root = _find_project_root()
    backend_dir = root / "backend"
    python = "python3.11"

    return f"""[Unit]
Description=TeleVault — Backup para Telegram
After=network.target

[Service]
Type=simple
WorkingDirectory={backend_dir}
ExecStart={python} -m uvicorn app.main:app --host 127.0.0.1 --port 8001
Restart=on-failure
RestartSec=5
EnvironmentFile={root}/.env

[Install]
WantedBy=default.target
"""


def _run_systemctl(*args) -> bool:
    """Roda systemctl --user com args. Retorna True se sucesso."""
    try:
        result = subprocess.run(
            ["systemctl", "--user"] + list(args),
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0
    except Exception as e:
        log.warning(f"systemctl error: {e}")
        return False


def _is_enabled() -> bool:
    """Verifica se o service está enabled."""
    return _run_systemctl("is-enabled", "--quiet", SERVICE_NAME)


def _is_active() -> bool:
    """Verifica se o service está rodando."""
    return _run_systemctl("is-active", "--quiet", SERVICE_NAME)


@router.get("/autostart")
async def autostart_status():
    """Retorna status do autostart."""
    return {
        "enabled": _is_enabled(),
        "active": _is_active(),
        "service_path": str(SERVICE_PATH),
        "service_exists": SERVICE_PATH.exists(),
    }


@router.post("/autostart/enable")
async def enable_autostart():
    """Cria e ativa o systemd user service."""
    try:
        SERVICE_DIR.mkdir(parents=True, exist_ok=True)
        SERVICE_PATH.write_text(_generate_service())
        log.info(f"✅ Service criado em {SERVICE_PATH}")

        _run_systemctl("daemon-reload")
        ok = _run_systemctl("enable", SERVICE_NAME)

        if not ok:
            raise HTTPException(status_code=500, detail="Erro ao habilitar service")

        return {
            "ok": True,
            "enabled": True,
            "message": "TeleVault será iniciado automaticamente no login.",
            "service_path": str(SERVICE_PATH),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/autostart/disable")
async def disable_autostart():
    """Desativa e remove o systemd user service."""
    try:
        _run_systemctl("stop", SERVICE_NAME)
        _run_systemctl("disable", SERVICE_NAME)

        if SERVICE_PATH.exists():
            SERVICE_PATH.unlink()
            log.info(f"🗑️ Service removido: {SERVICE_PATH}")

        _run_systemctl("daemon-reload")

        return {
            "ok": True,
            "enabled": False,
            "message": "Autostart desativado.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
