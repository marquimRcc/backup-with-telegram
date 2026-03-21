"""
app/api/stats.py
GET /api/stats  → estatísticas reais do canal (com cache SQLite)
Cache válido por 5 min. Invalidado automaticamente por upload/delete/backup.
"""

import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from app.core.telegram import telegram_client
from app.core.database import SessionLocal
from app.models.models import StatsCache

router = APIRouter()
log = logging.getLogger("televault.stats")

CACHE_TTL = timedelta(minutes=5)

# mapeamento extensão → categoria
EXT_CATEGORIES = {
    ".pdf": "Documentos", ".doc": "Documentos", ".docx": "Documentos", ".odt": "Documentos",
    ".xls": "Documentos", ".xlsx": "Documentos", ".ppt": "Documentos", ".pptx": "Documentos",
    ".txt": "Documentos", ".md": "Documentos", ".csv": "Documentos", ".rtf": "Documentos",
    ".jpg": "Imagens", ".jpeg": "Imagens", ".png": "Imagens", ".gif": "Imagens",
    ".bmp": "Imagens", ".svg": "Imagens", ".webp": "Imagens", ".ico": "Imagens",
    ".mp4": "Vídeos", ".mkv": "Vídeos", ".avi": "Vídeos", ".mov": "Vídeos",
    ".wmv": "Vídeos", ".flv": "Vídeos", ".webm": "Vídeos",
    ".mp3": "Músicas", ".flac": "Músicas", ".wav": "Músicas", ".ogg": "Músicas",
    ".aac": "Músicas", ".wma": "Músicas", ".m4a": "Músicas",
    ".zip": "Compactados", ".tar": "Compactados", ".gz": "Compactados",
    ".rar": "Compactados", ".7z": "Compactados", ".bz2": "Compactados", ".xz": "Compactados",
    ".appimage": "Compactados",
    ".py": "Projetos", ".js": "Projetos", ".jsx": "Projetos", ".ts": "Projetos",
    ".java": "Projetos", ".c": "Projetos", ".cpp": "Projetos", ".h": "Projetos",
    ".rs": "Projetos", ".go": "Projetos", ".sh": "Projetos", ".json": "Projetos",
    ".yaml": "Projetos", ".yml": "Projetos", ".xml": "Projetos", ".html": "Projetos",
    ".css": "Projetos", ".sql": "Projetos", ".gradle": "Projetos",
}

CATEGORY_EMOJI = {
    "Documentos": "📄", "Imagens": "🖼️", "Vídeos": "🎬",
    "Projetos": "💾", "Músicas": "🎵", "Compactados": "🗜️", "Outros": "📦",
}


def classify_file(filename: str) -> str:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return EXT_CATEGORIES.get(ext, "Outros")


def fmt_size(b):
    if b >= 1_073_741_824: return f"{b/1_073_741_824:.1f} GB"
    if b >= 1_048_576:     return f"{b/1_048_576:.1f} MB"
    if b >= 1024:          return f"{b/1024:.1f} KB"
    return f"{b} B"


@router.get("")
async def get_stats(channel_id: int = Query(..., description="ID do canal Telegram")):
    if not telegram_client.is_authorized:
        raise HTTPException(status_code=401, detail="Não autenticado")

    # ── tenta cache ──
    try:
        with SessionLocal() as db:
            cached = db.query(StatsCache).filter(StatsCache.channel_id == channel_id).first()
            if cached and cached.updated_at and (datetime.utcnow() - cached.updated_at) < CACHE_TTL:
                folders = json.loads(cached.folders_json) if cached.folders_json else []
                log.debug(f"Stats cache hit para canal {channel_id}")
                return {
                    "total_files":  cached.total_files,
                    "total_bytes":  cached.total_bytes,
                    "total_size":   fmt_size(cached.total_bytes),
                    "last_backup":  cached.last_backup.isoformat() if cached.last_backup else None,
                    "channel_id":   channel_id,
                    "folders":      folders,
                    "cached":       True,
                }
    except Exception as e:
        log.warning(f"Erro ao ler cache: {e}")

    # ── cache miss: itera canal ──
    total_files = 0
    total_bytes = 0
    last_msg_date = None
    breakdown = defaultdict(lambda: {"count": 0, "bytes": 0})

    try:
        async for f in telegram_client.iter_files(channel_id):
            total_files += 1
            size = f.get("size", 0)
            total_bytes += size
            if last_msg_date is None:
                last_msg_date = f.get("date")
            cat = classify_file(f.get("filename", "unknown"))
            breakdown[cat]["count"] += 1
            breakdown[cat]["bytes"] += size
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    folders = []
    for cat in ["Documentos", "Imagens", "Vídeos", "Projetos", "Músicas", "Compactados", "Outros"]:
        if cat in breakdown:
            folders.append({
                "label": cat,
                "emoji": CATEGORY_EMOJI.get(cat, "📦"),
                "count": breakdown[cat]["count"],
                "size": fmt_size(breakdown[cat]["bytes"]),
                "bytes": breakdown[cat]["bytes"],
            })

    # ── salva cache ──
    try:
        with SessionLocal() as db:
            db.query(StatsCache).filter(StatsCache.channel_id == channel_id).delete()
            db.add(StatsCache(
                channel_id=channel_id,
                total_files=total_files,
                total_bytes=total_bytes,
                last_backup=last_msg_date,
                folders_json=json.dumps(folders),
                updated_at=datetime.utcnow(),
            ))
            db.commit()
        log.info(f"Stats cache atualizado: {total_files} arquivos, {fmt_size(total_bytes)}")
    except Exception as e:
        log.warning(f"Erro ao salvar cache: {e}")

    return {
        "total_files":  total_files,
        "total_bytes":  total_bytes,
        "total_size":   fmt_size(total_bytes),
        "last_backup":  last_msg_date.isoformat() if last_msg_date else None,
        "channel_id":   channel_id,
        "folders":      folders,
        "cached":       False,
    }
