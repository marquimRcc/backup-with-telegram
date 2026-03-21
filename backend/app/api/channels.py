"""app/api/channels.py — gerenciamento de canais e pastas"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.telegram import telegram_client

router = APIRouter()


class CreateChannelRequest(BaseModel):
    title: str


@router.post("/create")
async def create_channel(req: CreateChannelRequest):
    if not telegram_client.is_authorized:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        ch = await telegram_client.create_private_channel(req.title)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return ch


@router.get("/list")
async def list_channels():
    if not telegram_client.is_authorized:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        dialogs = await telegram_client.get_dialogs()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"channels": dialogs}
