"""
TeleVault — Backend
Fork de TGDrive (TechShreyash/TGDrive)
Adaptado para RegataOS / openSUSE por Marcos
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api import auth, files, backup, channels, stats
from app.api import speedtest as speedtest_api
from app.api import browse as browse_api
from app.api import system as system_api
from app.api import schedules as schedules_api
from app.core.config import settings
from app.core.telegram import telegram_client
from app.core.database import init_db
from app.services import scheduler

log = logging.getLogger("televault")


def cleanup_orphan_temp_files():
    """Remove arquivos temporários órfãos de uploads interrompidos."""
    data_dir = settings.DATA_DIR
    count = 0
    for f in data_dir.glob("tmp*"):
        if f.is_file():
            try: f.unlink(); count += 1
            except OSError: pass
    tmp_dir = data_dir / "uploads_tmp"
    if tmp_dir.exists():
        for sub in tmp_dir.iterdir():
            if sub.is_dir():
                for f in sub.iterdir():
                    if f.is_file():
                        try: f.unlink(); count += 1
                        except OSError: pass
                try: sub.rmdir()
                except OSError: pass
            elif sub.is_file():
                try: sub.unlink(); count += 1
                except OSError: pass
    if count:
        log.info(f"🧹 {count} arquivo(s) temporário(s) órfão(s) removido(s)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    cleanup_orphan_temp_files()
    await telegram_client.start_if_authorized()
    scheduler.start()
    log.info(f"🔒 DEBUG={'ON' if settings.DEBUG else 'OFF'} | SECRET_KEY={'custom' if settings.SECRET_KEY else 'auto'}")
    if settings.TELEVAULT_CHANNEL_ID:
        log.info(f"📦 Canal autorizado: {settings.TELEVAULT_CHANNEL_ID}")
    else:
        log.warning("⚠️  TELEVAULT_CHANNEL_ID não definido — qualquer canal é aceito (modo dev)")
    yield
    scheduler.stop()
    await telegram_client.disconnect()


app = FastAPI(
    title="TeleVault API",
    version="0.2.0",
    description="Backup pessoal direto no Telegram",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,           prefix="/api/auth",       tags=["auth"])
app.include_router(files.router,          prefix="/api/files",      tags=["files"])
app.include_router(backup.router,         prefix="/api/backup",     tags=["backup"])
app.include_router(channels.router,       prefix="/api/channels",   tags=["channels"])
app.include_router(stats.router,          prefix="/api/stats",      tags=["stats"])
app.include_router(speedtest_api.router,  prefix="/api/speed-test", tags=["speedtest"])
app.include_router(browse_api.router,     prefix="/api/fs",         tags=["browse"])
app.include_router(system_api.router,     prefix="/api/system",     tags=["system"])
app.include_router(schedules_api.router,  prefix="/api/schedules",  tags=["schedules"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.2.0"}
