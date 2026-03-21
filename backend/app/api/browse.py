"""
app/api/browse.py
GET /api/fs/browse?path=/home/marcos → lista diretórios e arquivos
Restrito a /home e caminhos comuns. Não permite sair.
"""

import os
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()
log = logging.getLogger("televault.browse")

# diretórios raiz permitidos
ALLOWED_ROOTS = ["/home", "/tmp", "/mnt", "/media"]


def _is_safe_path(path: Path) -> bool:
    """Verifica se o caminho está dentro de diretórios permitidos."""
    resolved = path.resolve()
    return any(str(resolved).startswith(root) for root in ALLOWED_ROOTS)


@router.get("/browse")
async def browse_directory(path: str = Query(default="/home", description="Caminho para listar")):
    """Lista diretórios e arquivos de um caminho local."""
    target = Path(path).resolve()

    if not _is_safe_path(target):
        raise HTTPException(status_code=403, detail="Caminho não permitido")

    if not target.exists():
        raise HTTPException(status_code=404, detail="Caminho não encontrado")

    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Caminho não é um diretório")

    items = []
    try:
        for entry in sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
            # pula hidden files
            if entry.name.startswith("."):
                continue
            try:
                is_dir = entry.is_dir()
                size = 0
                if not is_dir:
                    try:
                        size = entry.stat().st_size
                    except OSError:
                        pass

                items.append({
                    "name": entry.name,
                    "path": str(entry),
                    "is_dir": is_dir,
                    "size": size,
                })
            except PermissionError:
                continue
    except PermissionError:
        raise HTTPException(status_code=403, detail="Sem permissão para ler este diretório")

    # info do diretório pai
    parent = str(target.parent) if _is_safe_path(target.parent) and target != target.parent else None

    return {
        "path": str(target),
        "parent": parent,
        "items": items,
        "total": len(items),
    }
