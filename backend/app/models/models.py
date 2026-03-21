"""
Modelos SQLAlchemy — SQLite local em ~/.televault/televault.db
Simplificados para modo single-user.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, BigInteger, Boolean,
    DateTime, Text, Float
)
from sqlalchemy.orm import DeclarativeBase

# versão do schema — incrementar ao alterar modelos
SCHEMA_VERSION = 2


class Base(DeclarativeBase):
    pass


class SchemaInfo(Base):
    """Controle de versão do schema."""
    __tablename__ = "schema_info"
    id      = Column(Integer, primary_key=True)
    version = Column(Integer, nullable=False)


class TelegramFile(Base):
    """Registro de arquivo enviado ao Telegram."""
    __tablename__ = "telegram_files"

    id            = Column(Integer, primary_key=True)
    channel_id    = Column(BigInteger, nullable=False)    # telegram channel id
    message_id    = Column(BigInteger, nullable=False)    # telegram message id
    filename      = Column(String(512), nullable=False)
    local_path    = Column(Text, nullable=True)           # caminho original no disco
    size_bytes    = Column(BigInteger, default=0)
    mime_type     = Column(String(128), nullable=True)
    checksum_md5  = Column(String(32), nullable=True)
    source        = Column(String(32), default="upload")  # upload | backup
    uploaded_at   = Column(DateTime, default=datetime.utcnow)


class BackupJobRecord(Base):
    """Registro de execução de backup."""
    __tablename__ = "backup_jobs"

    id            = Column(Integer, primary_key=True)
    job_id        = Column(String(16), nullable=False, unique=True)  # uuid curto
    channel_id    = Column(BigInteger, nullable=False)
    status        = Column(String(16), default="running")  # running | done | failed | cancelled
    trigger       = Column(String(32), default="manual")   # manual | schedule | watch
    files_total   = Column(Integer, default=0)
    files_sent    = Column(Integer, default=0)
    files_skipped = Column(Integer, default=0)
    files_failed  = Column(Integer, default=0)
    bytes_sent    = Column(BigInteger, default=0)
    error_msg     = Column(Text, nullable=True)
    started_at    = Column(DateTime, default=datetime.utcnow)
    finished_at   = Column(DateTime, nullable=True)


class StatsCache(Base):
    """Cache de estatísticas do canal (evita iter_files a cada request)."""
    __tablename__ = "stats_cache"

    id            = Column(Integer, primary_key=True)
    channel_id    = Column(BigInteger, nullable=False, unique=True)
    total_files   = Column(Integer, default=0)
    total_bytes   = Column(BigInteger, default=0)
    last_backup   = Column(DateTime, nullable=True)
    folders_json  = Column(Text, nullable=True)   # JSON com breakdown por tipo
    updated_at    = Column(DateTime, default=datetime.utcnow)
