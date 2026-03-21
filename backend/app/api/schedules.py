"""
app/api/schedules.py
CRUD para agendamentos de backup.
"""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import SessionLocal
from app.models.schedule import ScheduleRecord

router = APIRouter()
log = logging.getLogger("televault.schedules")


class ScheduleCreate(BaseModel):
    label: str
    cron_type: str  # "hourly" | "twice_daily" | "daily_20h" | "on_boot"
    enabled: bool = True
    paths: list[str] = []
    channel_id: int | None = None


class ScheduleToggle(BaseModel):
    enabled: bool


def _to_dict(s: ScheduleRecord) -> dict:
    return {
        "id": s.id,
        "label": s.label,
        "cron_type": s.cron_type,
        "enabled": s.enabled,
        "paths": s.paths,
        "channel_id": s.channel_id,
        "last_run": s.last_run.isoformat() if s.last_run else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("")
async def list_schedules():
    """Lista todos os agendamentos."""
    with SessionLocal() as db:
        records = db.query(ScheduleRecord).order_by(ScheduleRecord.id).all()
        return {"schedules": [_to_dict(r) for r in records]}


@router.post("")
async def create_schedule(body: ScheduleCreate):
    """Cria um novo agendamento."""
    valid_types = ["hourly", "twice_daily", "daily_20h", "on_boot"]
    if body.cron_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"cron_type deve ser um de: {valid_types}")

    with SessionLocal() as db:
        rec = ScheduleRecord(
            label=body.label,
            cron_type=body.cron_type,
            enabled=body.enabled,
            paths_json=json.dumps(body.paths),
            channel_id=body.channel_id,
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        log.info(f"✅ Schedule criado: '{rec.label}' ({rec.cron_type})")
        return _to_dict(rec)


@router.patch("/{schedule_id}")
async def toggle_schedule(schedule_id: int, body: ScheduleToggle):
    """Ativa/desativa um agendamento."""
    with SessionLocal() as db:
        rec = db.query(ScheduleRecord).filter(ScheduleRecord.id == schedule_id).first()
        if not rec:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado")
        rec.enabled = body.enabled
        db.commit()
        db.refresh(rec)
        action = "ativado" if rec.enabled else "desativado"
        log.info(f"🔄 Schedule '{rec.label}' {action}")
        return _to_dict(rec)


@router.put("/{schedule_id}")
async def update_schedule(schedule_id: int, body: ScheduleCreate):
    """Atualiza um agendamento."""
    with SessionLocal() as db:
        rec = db.query(ScheduleRecord).filter(ScheduleRecord.id == schedule_id).first()
        if not rec:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado")
        rec.label = body.label
        rec.cron_type = body.cron_type
        rec.enabled = body.enabled
        rec.paths_json = json.dumps(body.paths)
        rec.channel_id = body.channel_id
        db.commit()
        db.refresh(rec)
        return _to_dict(rec)


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: int):
    """Remove um agendamento."""
    with SessionLocal() as db:
        rec = db.query(ScheduleRecord).filter(ScheduleRecord.id == schedule_id).first()
        if not rec:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado")
        label = rec.label
        db.delete(rec)
        db.commit()
        log.info(f"🗑️ Schedule removido: '{label}'")
        return {"ok": True}


@router.post("/init-defaults")
async def init_default_schedules(channel_id: int | None = None):
    """Cria os 4 agendamentos padrão se não existirem."""
    defaults = [
        {"label": "A cada hora",  "cron_type": "hourly",      "enabled": False},
        {"label": "2x ao dia",    "cron_type": "twice_daily",  "enabled": False},
        {"label": "Diário 20h",   "cron_type": "daily_20h",    "enabled": False},
        {"label": "Ao iniciar",   "cron_type": "on_boot",      "enabled": False},
    ]

    created = 0
    with SessionLocal() as db:
        existing = db.query(ScheduleRecord).count()
        if existing > 0:
            return {"ok": True, "created": 0, "message": "Agendamentos já existem"}

        for d in defaults:
            rec = ScheduleRecord(
                label=d["label"],
                cron_type=d["cron_type"],
                enabled=d["enabled"],
                paths_json="[]",
                channel_id=channel_id,
            )
            db.add(rec)
            created += 1

        db.commit()

    return {"ok": True, "created": created}
