"""
app/api/files.py — listagem, upload (2 fases), download e delete
Upload grande: grava em disco via streaming → envia pro Telegram em background com SSE.
"""

import asyncio
import json
import logging
import tempfile
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse

from app.core.telegram import telegram_client
from app.core.config import settings
from app.core.security import check_rate_limit
from app.core.database import SessionLocal
from app.models.models import TelegramFile, StatsCache

router = APIRouter()
log = logging.getLogger("televault.files")

MAX_FILE_SIZE = settings.MAX_FILE_SIZE_MB * 1024 * 1024  # 2 GB default
CHUNK_READ = 10 * 1024 * 1024  # 10 MB chunks para leitura do stream


# ── Registro global de uploads em andamento ──────────────────────────────────

class UploadJob:
    __slots__ = (
        "upload_id", "channel_id", "filename", "caption",
        "tmp_path", "total_bytes", "phase",
        "disk_written", "tg_sent", "tg_total", "tg_percent",
        "speed_mbps", "done", "error", "message_id", "_start",
    )

    def __init__(self, upload_id, channel_id, filename, caption, tmp_path, total_bytes):
        self.upload_id = upload_id
        self.channel_id = channel_id
        self.filename = filename
        self.caption = caption
        self.tmp_path = tmp_path
        self.total_bytes = total_bytes
        self.phase = "receiving"      # receiving → uploading → done | error
        self.disk_written = 0
        self.tg_sent = 0
        self.tg_total = total_bytes
        self.tg_percent = 0
        self.speed_mbps = 0.0
        self.done = False
        self.error = None
        self.message_id = None
        self._start = time.time()

    def tg_progress(self, current: int, total: int):
        """Callback do Telethon send_file."""
        self.tg_sent = current
        self.tg_total = total
        self.tg_percent = int((current / total) * 100) if total else 0
        elapsed = time.time() - self._start
        if elapsed > 0.1:
            self.speed_mbps = round((current / 1024 / 1024) / elapsed, 2)

    def to_dict(self) -> dict:
        return {
            "upload_id":   self.upload_id,
            "phase":       self.phase,
            "filename":    self.filename,
            "total_bytes": self.total_bytes,
            "disk_written": self.disk_written,
            "tg_sent":     self.tg_sent,
            "tg_total":    self.tg_total,
            "tg_percent":  self.tg_percent,
            "speed_mbps":  self.speed_mbps,
            "done":        self.done,
            "error":       self.error,
            "message_id":  self.message_id,
        }


_upload_jobs: dict[str, UploadJob] = {}


# ── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.get("/list/{channel_id}")
async def list_files(channel_id: int, limit: int = 100):
    if not telegram_client.is_authorized:
        raise HTTPException(status_code=401, detail="Não autenticado")
    files = []
    count = 0
    async for f in telegram_client.iter_files(channel_id):
        files.append(f)
        count += 1
        if count >= limit:
            break
    return {"files": files, "total": len(files)}


@router.get("/download/{channel_id}/{message_id}")
async def download_file(channel_id: int, message_id: int, background: BackgroundTasks):
    """Baixa arquivo do Telegram e retorna como download HTTP."""
    if not telegram_client.is_authorized:
        raise HTTPException(status_code=401, detail="Não autenticado")

    try:
        msg = await telegram_client.client.get_messages(channel_id, ids=message_id)
        if not msg or not msg.document:
            raise HTTPException(status_code=404, detail="Mensagem não encontrada ou sem arquivo")
        filename = "download"
        for attr in msg.document.attributes:
            if hasattr(attr, "file_name") and attr.file_name:
                filename = attr.file_name
                break
        mime = msg.document.mime_type or "application/octet-stream"
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    suffix = Path(filename).suffix
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.close()
    tmp_path = Path(tmp.name)

    try:
        await telegram_client.download_file(
            channel_id=channel_id,
            message_id=message_id,
            dest_path=tmp_path,
        )
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=str(e))

    # limpa temp depois que o response termina
    background.add_task(lambda: tmp_path.unlink(missing_ok=True))
    return FileResponse(path=str(tmp_path), filename=filename, media_type=mime)


@router.delete("/{channel_id}/{message_id}")
async def delete_file_msg(channel_id: int, message_id: int):
    if not telegram_client.is_authorized:
        raise HTTPException(status_code=401, detail="Não autenticado")
    await telegram_client.delete_message(channel_id, message_id)
    # remove do DB + invalida cache
    try:
        with SessionLocal() as db:
            db.query(TelegramFile).filter(TelegramFile.channel_id == channel_id, TelegramFile.message_id == message_id).delete()
            db.query(StatsCache).filter(StatsCache.channel_id == channel_id).delete()
            db.commit()
    except Exception:
        pass
    return {"ok": True}


@router.post("/upload/{channel_id}")
async def upload_file(
    channel_id: int,
    request: Request,
    file: UploadFile = File(...),
    caption: str = Form(default=""),
):
    """
    Upload em 2 fases:
    1. Grava no disco em chunks (streaming, sem explodir RAM)
    2. Retorna upload_id imediatamente → Telegram upload roda em background
    Frontend acompanha via GET /upload-progress/{upload_id}
    """
    # rate limit: 10 uploads por minuto por IP
    check_rate_limit(request, "files:upload", max_requests=10, window_seconds=60)
    if not telegram_client.is_authorized:
        raise HTTPException(status_code=401, detail="Não autenticado")

    # validação de tamanho via header (estimativa)
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo excede o limite de {settings.MAX_FILE_SIZE_MB} MB"
        )

    upload_id = str(uuid.uuid4())[:8]
    original_name = file.filename or "upload"
    # cria subdir por upload_id para preservar nome original sem colisão
    tmp_dir = settings.DATA_DIR / "uploads_tmp" / upload_id
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = tmp_dir / original_name

    # cria job antes de começar a gravar
    job = UploadJob(
        upload_id=upload_id,
        channel_id=channel_id,
        filename=file.filename or "upload",
        caption=caption or f"#televault {file.filename}",
        tmp_path=tmp_path,
        total_bytes=int(content_length) if content_length else 0,
    )
    _upload_jobs[upload_id] = job

    # ── Fase 1: streaming para disco ──
    try:
        total_written = 0
        with open(tmp_path, "wb") as tmp:
            while True:
                chunk = await file.read(CHUNK_READ)
                if not chunk:
                    break
                tmp.write(chunk)
                total_written += len(chunk)
                job.disk_written = total_written

                if total_written > MAX_FILE_SIZE:
                    tmp_path.unlink(missing_ok=True)
                    job.error = f"Arquivo excede o limite de {settings.MAX_FILE_SIZE_MB} MB"
                    job.phase = "error"
                    raise HTTPException(status_code=413, detail=job.error)

        job.total_bytes = total_written
        job.tg_total = total_written
    except HTTPException:
        raise
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        job.error = str(e)
        job.phase = "error"
        raise HTTPException(status_code=500, detail=str(e))

    # ── Fase 2: dispara upload pro Telegram em background ──
    job.phase = "uploading"
    job._start = time.time()  # reset timer para velocidade do Telegram

    async def telegram_upload():
        try:
            msg_id = await telegram_client.upload_file(
                file_path=tmp_path,
                channel_id=channel_id,
                caption=job.caption,
                progress_callback=job.tg_progress,
            )
            job.message_id = msg_id
            job.done = True
            job.phase = "done"
            job.tg_percent = 100
            # persiste no SQLite
            try:
                with SessionLocal() as db:
                    db.add(TelegramFile(
                        channel_id=channel_id,
                        message_id=msg_id,
                        filename=job.filename,
                        size_bytes=job.total_bytes,
                        source="upload",
                    ))
                    # invalida cache de stats
                    db.query(StatsCache).filter(StatsCache.channel_id == channel_id).delete()
                    db.commit()
            except Exception as db_err:
                log.warning(f"Erro ao persistir upload no DB: {db_err}")
        except Exception as e:
            job.error = str(e)
            job.phase = "error"
        finally:
            tmp_path.unlink(missing_ok=True)
            try: tmp_path.parent.rmdir()  # remove subdir se vazio
            except OSError: pass

    asyncio.create_task(telegram_upload())

    return {
        "ok": True,
        "upload_id": upload_id,
        "filename": job.filename,
        "size": total_written,
        "phase": "uploading",
    }


@router.get("/upload-progress/{upload_id}")
async def upload_progress(upload_id: str):
    """SSE stream com progresso do upload pro Telegram."""
    job = _upload_jobs.get(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload não encontrado")

    async def event_stream():
        try:
            while True:
                payload = job.to_dict()
                yield f"data: {json.dumps(payload)}\n\n"

                if job.done or job.error:
                    break

                await asyncio.sleep(0.4)
        finally:
            # limpa job depois que o SSE fecha
            await asyncio.sleep(2)
            _upload_jobs.pop(upload_id, None)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
