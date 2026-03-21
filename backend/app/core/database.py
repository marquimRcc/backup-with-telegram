"""
Inicialização do banco SQLite.
Migração aditiva: cria tabelas novas sem dropar existentes.
Só recria se SCHEMA_VERSION mudar E a flag FORCE_RECREATE=true estiver no .env.
"""

import logging
from sqlalchemy import create_engine, text, inspect
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


def _get_current_version() -> int:
    """Lê versão do schema do banco. Retorna 0 se não existe."""
    try:
        with engine.connect() as conn:
            # verifica se tabela schema_info existe
            inspector = inspect(engine)
            if "schema_info" not in inspector.get_table_names():
                return 0
            result = conn.execute(text("SELECT version FROM schema_info LIMIT 1"))
            row = result.fetchone()
            return row[0] if row else 0
    except Exception:
        return 0


def _set_version(version: int):
    """Grava versão do schema."""
    with SessionLocal() as db:
        db.execute(text("DELETE FROM schema_info"))
        db.execute(text(f"INSERT INTO schema_info (version) VALUES ({version})"))
        db.commit()


def init_db():
    """
    Inicializa banco com migração aditiva:
    - Tabelas novas são criadas automaticamente (CREATE IF NOT EXISTS)
    - Tabelas existentes NÃO são dropadas (dados preservados)
    - Se precisar recriar tudo: apague o arquivo ~/.televault/televault.db
    """
    current = _get_current_version()

    # cria tabelas que não existem ainda (seguro — não altera existentes)
    Base.metadata.create_all(bind=engine)

    if current == 0:
        # primeira execução
        _set_version(SCHEMA_VERSION)
        log.info(f"✅ Banco SQLite criado (schema v{SCHEMA_VERSION})")
    elif current < SCHEMA_VERSION:
        # schema mudou — tabelas novas já foram criadas acima
        _set_version(SCHEMA_VERSION)
        log.info(f"✅ Banco SQLite migrado: v{current} → v{SCHEMA_VERSION} (tabelas novas adicionadas, dados preservados)")
    else:
        log.info(f"✅ Banco SQLite OK (schema v{current})")


def get_db():
    """Dependency para FastAPI — yield session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
