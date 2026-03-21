"""
API de autenticação Telegram
POST /api/auth/send-code   → envia SMS/código
POST /api/auth/sign-in     → autentica com código
POST /api/auth/sign-out    → encerra sessão
GET  /api/auth/me          → dados do usuário atual
"""

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel
from typing import Optional

from app.core.telegram import telegram_client
from app.core.security import check_rate_limit

router = APIRouter()


class SendCodeRequest(BaseModel):
    phone: str          # "+55 34 9 9999-0000"


class SignInRequest(BaseModel):
    code: str           # "12345"
    password: Optional[str] = None   # só se 2FA ativo


class SendCodeResponse(BaseModel):
    ok: bool
    phone_code_hash: str
    message: str


class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: str
    username: str


@router.post("/send-code", response_model=SendCodeResponse)
async def send_code(req: SendCodeRequest, request: Request):
    """Dispara envio do código de verificação."""
    # rate limit: 3 tentativas por minuto
    check_rate_limit(request, "auth:send-code", max_requests=3, window_seconds=60)
    # normaliza telefone
    phone = req.phone.replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        raise HTTPException(status_code=400, detail="Telefone deve incluir código do país (+55...)")

    try:
        hash_ = await telegram_client.send_code(phone)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao enviar código: {e}")

    return SendCodeResponse(
        ok=True,
        phone_code_hash=hash_,
        message="Código enviado via Telegram",
    )


@router.post("/sign-in", response_model=UserResponse)
async def sign_in(req: SignInRequest, request: Request):
    """Autentica com código recebido."""
    # rate limit: 5 tentativas por minuto
    check_rate_limit(request, "auth:sign-in", max_requests=5, window_seconds=60)
    try:
        user = await telegram_client.sign_in(code=req.code, password=req.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na autenticação: {e}")

    return UserResponse(**user)


@router.post("/sign-out")
async def sign_out():
    """Encerra sessão e remove arquivo .session."""
    try:
        await telegram_client.sign_out()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True, "message": "Sessão encerrada"}


@router.get("/me", response_model=UserResponse)
async def get_me():
    """Retorna dados do usuário autenticado."""
    if not telegram_client.is_authorized:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        user = await telegram_client.get_me()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return UserResponse(**user)


@router.get("/status")
async def auth_status():
    return {"authorized": telegram_client.is_authorized}
