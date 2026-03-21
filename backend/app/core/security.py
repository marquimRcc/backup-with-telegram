"""
app/core/security.py — validação de canal e rate limiting
Sem dependências externas — tudo in-memory.
"""

import time
import logging
from collections import defaultdict
from functools import wraps

from fastapi import HTTPException, Request

from app.core.config import settings

log = logging.getLogger("televault.security")


# ── Channel ID Whitelist ─────────────────────────────────────────────────────

def _bare_channel_id(cid: int) -> int:
    """Normaliza channel_id: -1003824740593 → 3824740593"""
    s = str(abs(cid))
    if s.startswith("100") and len(s) > 10:
        return int(s[3:])
    return abs(cid)


def validate_channel_id(channel_id: int) -> int:
    """
    Valida se o channel_id é o canal configurado no .env.
    Aceita tanto formato puro (3824740593) quanto marked (-1003824740593).
    Se TELEVAULT_CHANNEL_ID não está definido, aceita qualquer canal (modo dev).
    """
    allowed = settings.TELEVAULT_CHANNEL_ID
    if allowed is None:
        return channel_id

    if _bare_channel_id(channel_id) != _bare_channel_id(allowed):
        log.warning(f"🚫 channel_id bloqueado: {channel_id} (permitido: {allowed})")
        raise HTTPException(
            status_code=403,
            detail=f"Canal {channel_id} não autorizado. Apenas o canal configurado é permitido."
        )
    return channel_id


# ── Rate Limiter (in-memory, por IP) ─────────────────────────────────────────

class RateLimiter:
    """
    Rate limiter simples in-memory.
    Usa sliding window por IP.
    """

    def __init__(self):
        # { "endpoint_key": { "ip": [timestamp, timestamp, ...] } }
        self._hits: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

    def check(self, key: str, ip: str, max_requests: int, window_seconds: int):
        """
        Verifica se o IP pode fazer mais uma requisição.
        Levanta HTTPException 429 se exceder.
        """
        now = time.time()
        cutoff = now - window_seconds
        hits = self._hits[key][ip]

        # limpa hits antigos
        self._hits[key][ip] = [t for t in hits if t > cutoff]
        hits = self._hits[key][ip]

        if len(hits) >= max_requests:
            retry_after = int(hits[0] + window_seconds - now) + 1
            log.warning(f"🚫 Rate limit: {ip} em {key} ({len(hits)}/{max_requests} em {window_seconds}s)")
            raise HTTPException(
                status_code=429,
                detail=f"Muitas requisições. Tente novamente em {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )

        hits.append(now)


# instância global
_limiter = RateLimiter()


def rate_limit(key: str, max_requests: int, window_seconds: int):
    """
    Chama no início do endpoint:
        rate_limit("auth:send-code", max_requests=3, window_seconds=60)(request)

    Ou use como:
        check_rate_limit(request, "upload", 5, 60)
    """
    def check(request: Request):
        ip = request.client.host if request.client else "unknown"
        _limiter.check(key, ip, max_requests, window_seconds)
    return check


def check_rate_limit(request: Request, key: str, max_requests: int, window_seconds: int):
    """Helper direto para usar dentro de endpoints."""
    ip = request.client.host if request.client else "unknown"
    _limiter.check(key, ip, max_requests, window_seconds)
