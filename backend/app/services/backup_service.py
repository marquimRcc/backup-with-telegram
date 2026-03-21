"""
BackupService — orquestra envio de arquivos para o Telegram
com deduplicação por MD5, progress SSE e suporte a cancelamento.
"""

import asyncio
import hashlib
import logging
import time
from pathlib import Path
from typing import Optional, AsyncGenerator, Callable
from datetime import datetime

from app.core.telegram import telegram_client
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.models import BackupJobRecord, TelegramFile, StatsCache

log = logging.getLogger("televault.backup")


def md5_file(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


class BackupProgress:
    def __init__(self, filename: str, total_bytes: int):
        self.filename    = filename
        self.total_bytes = total_bytes
        self.sent_bytes  = 0
        self.percent     = 0
        self.done        = False
        self.error: Optional[str] = None
        self.start_time  = time.time()

    def update(self, current: int, total: int):
        self.sent_bytes = current
        self.total_bytes = total
        self.percent = int((current / total) * 100) if total else 0

    @property
    def elapsed_s(self) -> float:
        return time.time() - self.start_time

    @property
    def speed_mbps(self) -> float:
        if self.elapsed_s < 0.1:
            return 0.0
        return (self.sent_bytes / 1024 / 1024) / self.elapsed_s


class BackupJob:
    """Representa uma execução de backup."""

    def __init__(self, channel_id: int, files: list[Path], folder_map: dict[str, int], job_id: str = ""):
        self.channel_id  = channel_id
        self.files       = files
        self.folder_map  = folder_map
        self.job_id      = job_id
        self.cancelled   = False
        self.paused      = False

        self.total       = len(files)
        self.done_count  = 0
        self.skip_count  = 0
        self.fail_count  = 0
        self.bytes_sent  = 0
        self.current: Optional[BackupProgress] = None
        self.results: list[dict] = []

    def cancel(self):
        self.cancelled = True

    def pause(self):
        self.paused = True
        log.info("⏸️  Backup pausado")

    def resume(self):
        self.paused = False
        log.info("▶️  Backup retomado")

    def _classify_folder(self, path: Path) -> Optional[int]:
        """Retorna ID da pasta com base na extensão do arquivo."""
        ext = path.suffix.lower()
        return self.folder_map.get(ext)

    async def run(self, on_progress: Optional[Callable] = None) -> dict:
        """Executa o backup. Chama on_progress(job) a cada passo."""
        # carrega checksums existentes do DB para deduplicação cross-session
        seen_md5: set[str] = set()
        try:
            with SessionLocal() as db:
                existing = db.query(TelegramFile.checksum_md5).filter(
                    TelegramFile.channel_id == self.channel_id,
                    TelegramFile.checksum_md5.isnot(None),
                ).all()
                seen_md5 = {row[0] for row in existing}
                if seen_md5:
                    log.info(f"📋 {len(seen_md5)} checksums carregados do DB para deduplicação")
        except Exception as e:
            log.warning(f"Erro ao carregar checksums do DB: {e}")

        for file_path in self.files:
            if self.cancelled:
                log.info("Backup cancelado pelo usuário")
                break

            # espera enquanto pausado
            while self.paused and not self.cancelled:
                await asyncio.sleep(0.5)

            if not file_path.exists():
                self.results.append({"file": str(file_path), "status": "skipped", "reason": "not_found"})
                self.skip_count += 1
                continue

            # deduplicação
            checksum = None
            try:
                checksum = md5_file(file_path)
                if checksum in seen_md5:
                    self.results.append({"file": str(file_path), "status": "skipped", "reason": "duplicate"})
                    self.skip_count += 1
                    continue
                seen_md5.add(checksum)
            except Exception as e:
                log.warning(f"Não conseguiu calcular MD5 de {file_path}: {e}")

            # progress tracker
            size = file_path.stat().st_size
            prog = BackupProgress(file_path.name, size)
            self.current = prog

            caption = f"#televault path={file_path}"
            try:
                t0 = time.time()
                msg_id = await telegram_client.upload_file(
                    file_path=file_path,
                    channel_id=self.channel_id,
                    caption=caption,
                    progress_callback=prog.update,
                )
                elapsed = int((time.time() - t0) * 1000)

                prog.done = True
                self.bytes_sent += size
                self.done_count += 1
                self.results.append({
                    "file": str(file_path),
                    "status": "done",
                    "message_id": msg_id,
                    "size": size,
                    "duration_ms": elapsed,
                })
                log.info(f"✅ {file_path.name} ({size/1024/1024:.1f} MB) em {elapsed}ms")
                # persiste arquivo no DB
                try:
                    with SessionLocal() as db:
                        db.add(TelegramFile(
                            channel_id=self.channel_id,
                            message_id=msg_id,
                            filename=file_path.name,
                            local_path=str(file_path),
                            size_bytes=size,
                            checksum_md5=checksum,
                            source="backup",
                        ))
                        db.commit()
                except Exception as db_err:
                    log.warning(f"Erro ao persistir arquivo no DB: {db_err}")

            except Exception as e:
                prog.error = str(e)
                self.fail_count += 1
                self.results.append({"file": str(file_path), "status": "failed", "error": str(e)})
                log.error(f"❌ {file_path.name}: {e}")

            if on_progress:
                await on_progress(self)

            # pequena pausa para não saturar a API
            await asyncio.sleep(0.3)

        self.current = None
        # persiste resultado final do job no DB
        try:
            with SessionLocal() as db:
                rec = db.query(BackupJobRecord).filter(BackupJobRecord.job_id == self.job_id).first()
                if rec:
                    rec.status = "cancelled" if self.cancelled else "done"
                    rec.files_sent = self.done_count
                    rec.files_skipped = self.skip_count
                    rec.files_failed = self.fail_count
                    rec.bytes_sent = self.bytes_sent
                    rec.finished_at = datetime.utcnow()
                # invalida cache de stats
                db.query(StatsCache).filter(StatsCache.channel_id == self.channel_id).delete()
                db.commit()
        except Exception as db_err:
            log.warning(f"Erro ao finalizar job no DB: {db_err}")

        return {
            "total":      self.total,
            "done":       self.done_count,
            "skipped":    self.skip_count,
            "failed":     self.fail_count,
            "bytes_sent": self.bytes_sent,
            "results":    self.results,
        }


# ── Registro global de jobs ativos ────────────────────────────────────────────
_active_jobs: dict[str, BackupJob] = {}


def get_active_job(job_id: str) -> Optional[BackupJob]:
    return _active_jobs.get(job_id)


def register_job(job_id: str, job: BackupJob):
    _active_jobs[job_id] = job


def finish_job(job_id: str):
    _active_jobs.pop(job_id, None)
