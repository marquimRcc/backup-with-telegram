"""
app/api/speedtest.py
POST /api/speed-test  → roda os 3 testes e retorna resultados
GET  /api/speed-test  → último resultado salvo
"""

import logging
import os
import time
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter
from app.core.telegram import telegram_client
from app.core.config import settings

router = APIRouter()
log = logging.getLogger("televault.speedtest")

_last_result = None

# tamanhos de teste
DOWN_BYTES = 25_000_000   # 25 MB para download
UP_BYTES   = 10_000_000   # 10 MB para upload
TG_BYTES   =  5_000_000   #  5 MB para Telegram


async def _test_download() -> float:
    """Baixa 25MB do Cloudflare para medir download real."""
    import httpx
    url = f"https://speed.cloudflare.com/__down?bytes={DOWN_BYTES}"
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            t0 = time.time()
            r = await client.get(url)
            elapsed = time.time() - t0
            size = len(r.content)
        if elapsed < 0.01:
            return 0
        return round((size / 1024 / 1024) / elapsed, 2)
    except Exception as e:
        log.warning(f"Download test failed: {e}")
        return 0


async def _test_upload() -> float:
    """Envia 10MB para Cloudflare speed test para medir upload real."""
    import httpx
    url = "https://speed.cloudflare.com/__up"
    blob = os.urandom(UP_BYTES)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            t0 = time.time()
            r = await client.post(url, content=blob, headers={"Content-Type": "application/octet-stream"})
            elapsed = time.time() - t0
        if elapsed < 0.01:
            return 0
        return round((UP_BYTES / 1024 / 1024) / elapsed, 2)
    except Exception as e:
        log.warning(f"Upload test failed: {e}")
        return 0


async def _test_telegram() -> float:
    """Envia 5MB pro canal Telegram e mede velocidade real."""
    if not telegram_client.is_authorized:
        return 0

    channel_id = settings.TELEVAULT_CHANNEL_ID
    if not channel_id:
        return 0

    blob = os.urandom(TG_BYTES)
    buf = BytesIO(blob)
    buf.name = f"speedtest_{int(time.time())}.bin"

    try:
        t0 = time.time()
        msg_id = await telegram_client.client.send_file(
            entity=channel_id,
            file=buf,
            caption="#televault_speedtest (auto-delete)",
        )
        elapsed = time.time() - t0
        mbps = (TG_BYTES / 1024 / 1024) / max(elapsed, 0.001)

        # deleta o arquivo de teste
        try:
            await telegram_client.delete_message(channel_id, msg_id)
        except Exception:
            pass

        return round(mbps, 2)
    except Exception as e:
        log.error(f"Telegram speed test failed: {e}")
        return 0


@router.post("")
async def run_speed_test():
    """Roda os 3 testes sequencialmente."""
    global _last_result

    log.info("🚀 Speed test iniciado...")

    download_mbps = await _test_download()
    log.info(f"  ↓ Download: {download_mbps} MB/s")

    upload_mbps = await _test_upload()
    log.info(f"  ↑ Upload: {upload_mbps} MB/s")

    telegram_mbps = await _test_telegram()
    log.info(f"  ↑ Telegram: {telegram_mbps} MB/s")

    result = {
        "download_mbps": download_mbps,
        "upload_mbps": upload_mbps,
        "telegram_mbps": telegram_mbps,
        "tested_at": datetime.utcnow().isoformat(),
    }

    _last_result = result
    log.info(f"✅ Speed test concluído: down={download_mbps} up={upload_mbps} tg={telegram_mbps}")

    return result


@router.get("")
async def get_last_result():
    """Retorna último resultado (in-memory)."""
    if _last_result:
        return _last_result
    return {"download_mbps": None, "upload_mbps": None, "telegram_mbps": None, "tested_at": None}