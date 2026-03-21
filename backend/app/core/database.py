"""
Inicialização do banco SQLite.
Cria engine, session factory, e gerencia versão do schema.
"""

import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.models import Base, SchemaInfo, SCHEMA_VERSION

log = logging.getLogger("televault.db")

engine = create_engine(
    f"sqlite:///{settings.DB_PATH}",
    echo=False,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db():
    """Cria tabelas. Se schema mudou, dropa e recria (safe em dev — sem dados críticos)."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version FROM schema_info LIMIT 1"))
            row = result.fetchone()
            current_version = row[0] if row else 0
    except Exception:
        current_version = 0

    if current_version < SCHEMA_VERSION:
        if current_version > 0:
            log.warning(f"⚠️  Schema v{current_version} → v{SCHEMA_VERSION}: recriando tabelas")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        # grava versão
        with SessionLocal() as db:
            db.execute(text("DELETE FROM schema_info"))
            db.execute(text(f"INSERT INTO schema_info (version) VALUES ({SCHEMA_VERSION})"))
            db.commit()
        log.info(f"✅ Banco SQLite inicializado (schema v{SCHEMA_VERSION})")
    else:
        log.info(f"✅ Banco SQLite OK (schema v{current_version})")


def get_db():
    """Dependency para FastAPI — yield session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
