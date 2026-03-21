"""
app/services/scheduler.py
Scheduler que roda em background e dispara backups nos horários configurados.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from pathlib import Path

from app.core.database import SessionLocal
from app.models.schedule import ScheduleRecord
from app.services.backup_service import BackupJob
from app.core.telegram import telegram_client

log = logging.getLogger("televault.scheduler")

_running = False
_task = None


def _should_run(schedule: ScheduleRecord, now: datetime) -> bool:
    """Verifica se o agendamento deve rodar agora."""
    if not schedule.enabled:
        return False

    last = schedule.last_run
    ctype = schedule.cron_type

    if ctype == "on_boot":
        # roda uma vez ao iniciar — se nunca rodou ou rodou há mais de 1h
        return last is None or (now - last) > timedelta(hours=1)

    if ctype == "hourly":
        return last is None or (now - last) >= timedelta(minutes=58)

    if ctype == "twice_daily":
        # roda às 12h e 20h
        target_hours = [12, 20]
        if now.hour not in target_hours:
            return False
        if last and last.date() == now.date() and last.hour == now.hour:
            return False  # já rodou nesta hora hoje
        return True

    if ctype == "daily_20h":
        if now.hour != 20:
            return False
        if last and last.date() == now.date():
            return False  # já rodou hoje
        return True

    return False


async def _run_scheduled_backup(schedule: ScheduleRecord):
    """Executa backup para um agendamento."""
    paths = schedule.paths
    channel_id = schedule.channel_id

    if not paths or not channel_id:
        log.warning(f"⏭️  Schedule '{schedule.label}' sem paths ou channel_id — pulando")
        return

    if not telegram_client.is_authorized:
        log.warning(f"⏭️  Schedule '{schedule.label}' — Telegram não autorizado")
        return

    log.info(f"⏰ Executando schedule '{schedule.label}' ({schedule.cron_type}) — {len(paths)} caminhos")

    # coleta arquivos
    all_files = []
    for p in paths:
        path = Path(p)
        if path.is_file():
            all_files.append(path)
        elif path.is_dir():
            all_files.extend(f for f in path.rglob("*") if f.is_file())

    if not all_files:
        log.info(f"  ⏭️  Nenhum arquivo encontrado em {paths}")
        return

    log.info(f"  📁 {len(all_files)} arquivo(s) encontrado(s)")

    job = BackupJob(
        channel_id=channel_id,
        files=all_files,
        folder_map={},
        job_id=f"sched-{schedule.id}-{int(datetime.utcnow().timestamp())}",
    )

    result = await job.run()

    log.info(f"  ✅ Schedule '{schedule.label}' concluído: "
             f"{result.get('done', 0)} enviados, {result.get('skipped', 0)} pulados, "
             f"{result.get('failed', 0)} falhas")

    # atualiza last_run
    try:
        with SessionLocal() as db:
            rec = db.query(ScheduleRecord).filter(ScheduleRecord.id == schedule.id).first()
            if rec:
                rec.last_run = datetime.utcnow()
                db.commit()
    except Exception as e:
        log.warning(f"Erro ao atualizar last_run: {e}")


async def _scheduler_loop():
    """Loop principal — checa a cada 60s se algum schedule deve rodar."""
    global _running
    log.info("🕐 Scheduler iniciado")

    # espera 10s pro sistema estabilizar
    await asyncio.sleep(10)

    while _running:
        try:
            now = datetime.utcnow()
            with SessionLocal() as db:
                schedules = db.query(ScheduleRecord).filter(ScheduleRecord.enabled == True).all()
                # detach from session
                for s in schedules:
                    db.expunge(s)

            for schedule in schedules:
                if _should_run(schedule, now):
                    try:
                        await _run_scheduled_backup(schedule)
                    except Exception as e:
                        log.error(f"Erro no schedule '{schedule.label}': {e}")

        except Exception as e:
            log.error(f"Scheduler loop error: {e}")

        # checa a cada 60s
        await asyncio.sleep(60)

    log.info("🕐 Scheduler parado")


def start():
    """Inicia o scheduler em background."""
    global _running, _task
    if _running:
        return
    _running = True
    _task = asyncio.create_task(_scheduler_loop())
    log.info("✅ Scheduler registrado")


def stop():
    """Para o scheduler."""
    global _running, _task
    _running = False
    if _task and not _task.done():
        _task.cancel()
    _task = None
