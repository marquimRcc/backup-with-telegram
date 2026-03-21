"""
Wrapper do cliente Telethon.
Gerencia autenticação, sessão e operações no Telegram.
"""

import asyncio
import logging
from pathlib import Path
from typing import Optional, AsyncGenerator

from telethon import TelegramClient as _TelegramClient
from telethon.tl.functions.channels import CreateChannelRequest
from telethon.tl.functions.messages import CreateChatRequest
from telethon.tl.types import (
    InputMessagesFilterDocument,
    Channel, Message
)
from telethon.errors import (
    SessionPasswordNeededError,
    PhoneCodeInvalidError,
    FloodWaitError,
)

from app.core.config import settings

log = logging.getLogger("televault.telegram")


class TelegramManager:
    """Gerencia ciclo de vida do cliente Telethon."""

    def __init__(self):
        self._client: Optional[_TelegramClient] = None
        self._phone: Optional[str] = None
        self._phone_code_hash: Optional[str] = None
        self._authorized: bool = False

    @property
    def client(self) -> _TelegramClient:
        if self._client is None:
            raise RuntimeError("Telegram client não inicializado")
        return self._client

    def _make_client(self) -> _TelegramClient:
        session_path = str(settings.SESSIONS_DIR / settings.TELEGRAM_SESSION)
        return _TelegramClient(
            session_path,
            settings.TELEGRAM_API_ID,
            settings.TELEGRAM_API_HASH,
        )

    async def start_if_authorized(self):
        """Conecta se já houver sessão salva."""
        try:
            self._client = self._make_client()
            await self._client.connect()
            self._authorized = await self._client.is_user_authorized()
            if self._authorized:
                me = await self._client.get_me()
                log.info(f"✅ Telegram: conectado como {me.first_name} (+{me.phone})")
            else:
                log.info("ℹ️  Telegram: sessão não autorizada, aguardando login")
        except Exception as e:
            log.error(f"Erro ao conectar Telegram: {e}")
            self._authorized = False

    async def disconnect(self):
        if self._client:
            await self._client.disconnect()

    # ── AUTH FLOW ─────────────────────────────────────────────────────

    async def send_code(self, phone: str) -> str:
        """Envia código SMS/Telegram. Retorna phone_code_hash."""
        if not self._client:
            self._client = self._make_client()
            await self._client.connect()

        self._phone = phone
        result = await self._client.send_code_request(phone)
        self._phone_code_hash = result.phone_code_hash
        log.info(f"📱 Código enviado para {phone}")
        return result.phone_code_hash

    async def sign_in(self, code: str, password: str = None) -> dict:
        """Autentica com código. Retorna info do usuário."""
        try:
            user = await self._client.sign_in(
                phone=self._phone,
                code=code,
                phone_code_hash=self._phone_code_hash,
            )
        except SessionPasswordNeededError:
            if not password:
                raise ValueError("2FA ativado — senha necessária")
            user = await self._client.sign_in(password=password)
        except PhoneCodeInvalidError:
            raise ValueError("Código inválido")

        self._authorized = True
        log.info(f"✅ Login bem-sucedido: {user.first_name}")
        return {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name or "",
            "phone": user.phone,
            "username": user.username or "",
        }

    async def sign_out(self):
        await self._client.log_out()
        self._authorized = False
        session_file = settings.SESSIONS_DIR / f"{settings.TELEGRAM_SESSION}.session"
        if session_file.exists():
            session_file.unlink()

    @property
    def is_authorized(self) -> bool:
        return self._authorized

    # ── CHANNELS ─────────────────────────────────────────────────────

    async def create_private_channel(self, title: str) -> dict:
        """Cria canal privado para backups."""
        result = await self._client(CreateChannelRequest(
            title=title,
            about=f"Backups do TeleVault — criado automaticamente",
            megagroup=False,
        ))
        ch = result.chats[0]
        log.info(f"📦 Canal criado: {title} (id={ch.id})")
        return {"id": ch.id, "title": ch.title, "access_hash": ch.access_hash}

    async def create_folder_topic(self, channel_id: int, name: str) -> int:
        """Cria tópico/pasta dentro do canal (forum mode)."""
        # TODO: usar CreateForumTopicRequest quando disponível na versão do telethon
        return 0

    async def get_dialogs(self) -> list:
        """Lista canais/grupos disponíveis."""
        dialogs = []
        async for dialog in self._client.iter_dialogs():
            if dialog.is_channel or dialog.is_group:
                dialogs.append({
                    "id": dialog.id,
                    "name": dialog.name,
                    "type": "channel" if dialog.is_channel else "group",
                    "unread": dialog.unread_count,
                })
        return dialogs

    # ── FILES ─────────────────────────────────────────────────────────

    async def upload_file(
        self,
        file_path: Path,
        channel_id: int,
        caption: str = "",
        progress_callback=None,
    ) -> int:
        """Faz upload de arquivo para o canal. Retorna message_id."""
        msg = await self._client.send_file(
            entity=channel_id,
            file=str(file_path),
            caption=caption,
            progress_callback=progress_callback,
            part_size_kb=512,
        )
        return msg.id

    async def upload_bytes(
        self,
        data: bytes,
        filename: str,
        channel_id: int,
        caption: str = "",
    ) -> int:
        """Upload de bytes diretamente (sem arquivo temporário)."""
        from io import BytesIO
        buf = BytesIO(data)
        buf.name = filename
        msg = await self._client.send_file(
            entity=channel_id,
            file=buf,
            caption=caption,
        )
        return msg.id

    async def download_file(
        self,
        channel_id: int,
        message_id: int,
        dest_path: Path,
        progress_callback=None,
    ) -> Path:
        """Baixa arquivo do Telegram para dest_path."""
        msg = await self._client.get_messages(channel_id, ids=message_id)
        await self._client.download_media(
            msg,
            file=str(dest_path),
            progress_callback=progress_callback,
        )
        return dest_path

    async def iter_files(self, channel_id: int) -> AsyncGenerator[dict, None]:
        """Itera sobre todos os documentos do canal."""
        async for msg in self._client.iter_messages(
            entity=channel_id,
            filter=InputMessagesFilterDocument,
        ):
            if msg.document:
                # extrai filename de forma segura — nem todo atributo tem file_name
                filename = "unknown"
                for attr in msg.document.attributes:
                    if hasattr(attr, "file_name") and attr.file_name:
                        filename = attr.file_name
                        break
                yield {
                    "message_id": msg.id,
                    "filename": filename,
                    "size": msg.document.size,
                    "date": msg.date,
                    "caption": msg.text or "",
                    "mime_type": msg.document.mime_type,
                }

    async def delete_message(self, channel_id: int, message_id: int):
        await self._client.delete_messages(channel_id, [message_id])

    async def get_me(self) -> dict:
        me = await self._client.get_me()
        return {
            "id": me.id,
            "first_name": me.first_name,
            "last_name": me.last_name or "",
            "phone": me.phone,
            "username": me.username or "",
        }


# Instância global
telegram_client = TelegramManager()
