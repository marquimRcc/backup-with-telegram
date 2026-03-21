"""
POST /api/backup/start        → inicia backup
GET  /api/backup/progress/:id → stream SSE com progresso
POST /api/backup/cancel/:id   → cancela job ativo
GET  /api/backup/jobs         → histórico de jobs
"""

import asyncio
import json
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.backup_service import (
    BackupJob, register_job, get_active_job, finish_job
)
from app.core.telegram import telegram_client
from app.core.security import validate_channel_id
from app.core.database import SessionLocal
from app.models.models import BackupJobRecord

router = APIRouter()


class StartBackupRequest(BaseModel):
    channel_id: int
    paths: List[str]            # caminhos locais para backup
    folder_map: dict = {}       # {".pdf": folder_id, ...}


class StartBackupResponse(BaseModel):
    job_id: str
    total_files: int


@router.post("/start", response_model=StartBackupResponse)
async def start_backup(req: StartBackupRequest, background: BackgroundTasks):
    validate_channel_id(req.channel_id)
    if not telegram_client.is_authorized:
        raise HTTPException(status_code=401, detail="Não autenticado")

    files = []
    for p in req.paths:
        path = Path(p)
        if path.is_file():
            files.append(path)
        elif path.is_dir():
            files.extend(f for f in path.rglob("*") if f.is_file())

    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo encontrado nos caminhos informados")

    job_id = str(uuid.uuid4())[:8]
    job = BackupJob(
        channel_id=req.channel_id,
        files=files,
        folder_map=req.folder_map,
        job_id=job_id,
    )
    register_job(job_id, job)

    # persiste job no DB
    try:
        with SessionLocal() as db:
            db.add(BackupJobRecord(
                job_id=job_id,
                channel_id=req.channel_id,
                status="running",
                files_total=len(files),
            ))
            db.commit()
    except Exception:
        pass

    async def run_and_clean():
        await job.run()
        finish_job(job_id)

    background.add_task(run_and_clean)

    return StartBackupResponse(job_id=job_id, total_files=len(files))


@router.get("/progress/{job_id}")
async def backup_progress(job_id: str):
    """Server-Sent Events com progresso do job."""

    async def event_stream():
        while True:
            job = get_active_job(job_id)
            if job is None:
                # job encerrou
                yield f"data: {json.dumps({'status': 'done'})}\n\n"
                break

            payload = {
                "status":   "paused" if job.paused else "running",
                "paused":   job.paused,
                "total":    job.total,
                "done":     job.done_count,
                "skipped":  job.skip_count,
                "failed":   job.fail_count,
                "bytes":    job.bytes_sent,
                "current":  {
                    "filename": job.current.filename,
                    "percent":  job.current.percent,
                    "speed_mbps": round(job.current.speed_mbps, 2),
                } if job.current else None,
            }
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/cancel/{job_id}")
async def cancel_backup(job_id: str):
    job = get_active_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado ou já finalizado")
    job.cancel()
    return {"ok": True, "message": "Cancelamento solicitado"}


@router.post("/pause/{job_id}")
async def pause_backup(job_id: str):
    job = get_active_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado ou já finalizado")
    job.pause()
    return {"ok": True, "paused": True}


@router.post("/resume/{job_id}")
async def resume_backup(job_id: str):
    job = get_active_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado ou já finalizado")
    job.resume()
    return {"ok": True, "paused": False}


@router.get("/jobs")
async def list_jobs(limit: int = 20):
    """Histórico de jobs de backup (do DB)."""
    try:
        with SessionLocal() as db:
            rows = db.query(BackupJobRecord).order_by(
                BackupJobRecord.started_at.desc()
            ).limit(limit).all()
            return {"jobs": [{
                "job_id":        r.job_id,
                "channel_id":    r.channel_id,
                "status":        r.status,
                "trigger":       r.trigger,
                "files_total":   r.files_total,
                "files_sent":    r.files_sent,
                "files_skipped": r.files_skipped,
                "files_failed":  r.files_failed,
                "bytes_sent":    r.bytes_sent,
                "started_at":    r.started_at.isoformat() if r.started_at else None,
                "finished_at":   r.finished_at.isoformat() if r.finished_at else None,
            } for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
