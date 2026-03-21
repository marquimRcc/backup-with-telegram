import secrets
import os
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List, Optional


def _generate_secret_key() -> str:
    """Gera SECRET_KEY se não definida no .env. Persiste em ~/.televault/.secret_key"""
    key_file = Path.home() / ".televault" / ".secret_key"
    if key_file.exists():
        return key_file.read_text().strip()
    key_file.parent.mkdir(parents=True, exist_ok=True)
    key = secrets.token_hex(32)
    key_file.write_text(key)
    os.chmod(key_file, 0o600)
    return key


class Settings(BaseSettings):
    # ── Telegram API ─────────────────────────────────────────────────
    # Obter em https://my.telegram.org/apps
    TELEGRAM_API_ID: int = 0
    TELEGRAM_API_HASH: str = ""
    TELEGRAM_SESSION: str = "televault"      # nome do arquivo .session
    TELEVAULT_CHANNEL_ID: Optional[int] = None  # canal padrão de backup

    # ── App ──────────────────────────────────────────────────────────
    APP_NAME: str = "TeleVault"
    SECRET_KEY: str = ""           # gerado automaticamente se vazio
    DEBUG: bool = False            # True só se explícito no .env

    # ── CORS ─────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",   # vite dev
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # ── Storage ──────────────────────────────────────────────────────
    DATA_DIR: Path = Path.home() / ".televault"
    DB_PATH: Path = DATA_DIR / "televault.db"
    SESSIONS_DIR: Path = DATA_DIR / "sessions"

    # ── Upload ───────────────────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 2000        # 2 GB (limite Telegram free)
    CHUNK_SIZE_MB: int = 10             # chunks para upload em partes
    MAX_CONCURRENT_UPLOADS: int = 3

    # ── Backup ───────────────────────────────────────────────────────
    BACKUP_SCHEDULES: List[str] = ["0 12 * * *", "0 20 * * *"]  # cron
    WATCH_DIRS: List[str] = []          # dirs monitorados por inotify

    class Config:
        env_file = (".env", "../.env")  # tenta CWD primeiro, depois raiz do projeto
        env_file_encoding = "utf-8"

    def setup_dirs(self):
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        # protege .session com chmod 600
        for f in self.SESSIONS_DIR.glob("*.session"):
            try:
                os.chmod(f, 0o600)
            except OSError:
                pass


settings = Settings()
settings.setup_dirs()

# auto-gera SECRET_KEY se não definida no .env
if not settings.SECRET_KEY or settings.SECRET_KEY == "change-me-in-production":
    settings.SECRET_KEY = _generate_secret_key()
