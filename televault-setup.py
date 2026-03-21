#!/usr/bin/env python3
"""
televault-setup.py
Configura e testa o backend TeleVault em um único script.
Rode: python3 televault-setup.py
"""

import sys
import os
import asyncio
import subprocess
from pathlib import Path

# ── cores no terminal ─────────────────────────────────────────
def blue(s):  return f"\033[34m{s}\033[0m"
def green(s): return f"\033[32m{s}\033[0m"
def red(s):   return f"\033[31m{s}\033[0m"
def bold(s):  return f"\033[1m{s}\033[0m"
def dim(s):   return f"\033[2m{s}\033[0m"

def hr(): print(dim("─" * 50))

# ── flags de linha de comando ─────────────────────────────────
import argparse
parser = argparse.ArgumentParser(add_help=False)
parser.add_argument("--reset", action="store_true", help="Apaga sessão e .env para trocar de conta")
parser.add_argument("--port",  type=int, default=8000)
args, _ = parser.parse_known_args()

if args.reset:
    targets = [
        Path.home() / ".televault/sessions/televault.session",
        Path.home() / ".televault/sessions/televault.session-journal",
        Path(".env"),
    ]
    removed = []
    for t in targets:
        if t.exists():
            t.unlink()
            removed.append(str(t))
    if removed:
        for r in removed: print(green(f"✓ Removido: {r}"))
    else:
        print(dim("  Nada para remover (já estava limpo)."))
    print(green("\n✓ Reset completo. Rode: python3 televault-setup.py"))
    sys.exit(0)

PORT = args.port

print()
print(bold("📦 TeleVault — Setup Interativo"))
print(dim("   Configura backend + testa conexão Telegram"))
print(dim(f"   Dica: use --reset para trocar de conta"))
hr()

# ── 1. verificar Python ───────────────────────────────────────
if sys.version_info < (3, 10):
    print(red("✗ Python 3.10+ é necessário."))
    print(f"  Versão atual: {sys.version}")
    sys.exit(1)
print(green(f"✓ Python {sys.version.split()[0]}"))

# ── 2. instalar dependências ──────────────────────────────────
print("\nInstalando dependências...")
deps = ["telethon", "fastapi", "uvicorn[standard]", "pydantic-settings", "python-dotenv", "cryptg"]
result = subprocess.run(
    [sys.executable, "-m", "pip", "install", "--quiet"] + deps,
    capture_output=True, text=True
)
if result.returncode != 0:
    print(red("✗ Erro ao instalar:"))
    print(result.stderr)
    sys.exit(1)
print(green("✓ Dependências instaladas"))

# ── 3. coletar credenciais ────────────────────────────────────
hr()
print(bold("\n🔑 Credenciais do Telegram"))
print(dim("   Obtenha em: https://my.telegram.org/apps\n"))

env_file = Path(".env")
api_id   = None
api_hash = None

# tenta ler .env existente
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if line.startswith("TELEGRAM_API_ID="):
            val = line.split("=", 1)[1].strip()
            if val and val != "0":
                api_id = int(val)
        if line.startswith("TELEGRAM_API_HASH="):
            val = line.split("=", 1)[1].strip()
            if val:
                api_hash = val

if api_id and api_hash:
    print(green(f"✓ Credenciais encontradas no .env (api_id={api_id})"))
else:
    print("Cole suas credenciais abaixo:\n")
    while not api_id:
        try:
            api_id = int(input("  TELEGRAM_API_ID  : ").strip())
        except ValueError:
            print(red("  → Precisa ser um número inteiro"))

    while not api_hash:
        api_hash = input("  TELEGRAM_API_HASH : ").strip()

    # salva no .env
    content = f"""TELEGRAM_API_ID={api_id}
TELEGRAM_API_HASH={api_hash}
DEBUG=true
SECRET_KEY=dev-only-change-in-production
"""
    env_file.write_text(content)
    print(green("\n✓ Salvo em .env"))

# ── 4. testar autenticação ────────────────────────────────────
hr()
print(bold("\n📱 Autenticação Telegram"))
print(dim("   Será criada uma sessão local em televault.session\n"))

from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError

DATA_DIR = Path.home() / ".televault" / "sessions"
DATA_DIR.mkdir(parents=True, exist_ok=True)
SESSION = str(DATA_DIR / "televault")

async def authenticate():
    client = TelegramClient(SESSION, api_id, api_hash)
    await client.connect()

    if await client.is_user_authorized():
        me = await client.get_me()
        print(green(f"✓ Já autenticado como {me.first_name} (+{me.phone})"))
        await client.disconnect()
        return True

    # ── coleta número com retry ───────────────────────────────
    MAX_TRIES = 3
    result = None
    phone  = None

    for attempt in range(1, MAX_TRIES + 1):
        raw = input(f"  Seu número (+55...) [{attempt}/{MAX_TRIES}]: ").strip()

        # normaliza: remove espaços e hífens, garante "+"
        raw = raw.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if not raw.startswith("+"):
            raw = "+" + raw

        # validação básica antes de chamar a API
        digits = raw[1:]  # remove o "+"
        if not digits.isdigit() or len(digits) < 8:
            print(red(f"  → Número inválido. Use o formato +5534988420000\n"))
            continue

        phone = raw
        try:
            result = await client.send_code_request(phone)
            break  # sucesso
        except Exception as e:
            msg = str(e)
            if "invalid" in msg.lower() or "phone" in msg.lower():
                print(red(f"  → Telegram recusou: {msg}"))
                print(dim("     Verifique o DDI e DDD (ex: +5534988420000)\n"))
            else:
                print(red(f"  → Erro: {msg}\n"))

            if attempt == MAX_TRIES:
                print(red("\n✗ Número inválido após 3 tentativas. Verifique e rode novamente."))
                await client.disconnect()
                sys.exit(1)

    code = input("  Código recebido no Telegram: ").strip()

    try:
        user = await client.sign_in(
            phone=phone,
            code=code,
            phone_code_hash=result.phone_code_hash,
        )
    except SessionPasswordNeededError:
        import getpass
        print(dim("  → 2FA ativo. A senha nao ficara visivel ao digitar."))
        user = None
        for attempt in range(1, 4):
            pwd = getpass.getpass(f"  Senha 2FA [{attempt}/3]: ")
            if not pwd:
                print(red("  → Senha nao pode ser vazia.\n"))
                continue
            try:
                user = await client.sign_in(password=pwd)
                break
            except Exception as e:
                msg = str(e).lower()
                if "password" in msg or "invalid" in msg:
                    sufx = " Tente novamente." if attempt < 3 else ""
                    print(red(f"  → Senha incorreta.{sufx}\n"))
                else:
                    print(red(f"  → Erro: {e}\n"))
        if user is None:
            print(red("\n✗ Senha 2FA incorreta apos 3 tentativas."))
            await client.disconnect()
            sys.exit(1)

    print(green(f"\n✓ Login bem-sucedido! Olá, {user.first_name}!"))

    # ── listar canais existentes (criação pode falhar em contas novas) ──
    print("\nBuscando seus canais no Telegram...\n")
    canais = []
    async for d in client.iter_dialogs():
        if d.is_channel or d.is_group:
            canais.append((d.id, d.name))

    # tenta criar canal automaticamente
    canal_id = None
    try:
        from telethon.tl.functions.channels import CreateChannelRequest
        r = await client(CreateChannelRequest(
            title="📦 TeleVault — Backups",
            about="Criado pelo TeleVault automaticamente",
            megagroup=False,
        ))
        ch = r.chats[0]
        canal_id = ch.id
        print(green(f"✓ Canal criado: '{ch.title}' (id={ch.id})"))
    except Exception as e:
        print(red(f"  ✗ Não foi possível criar canal automaticamente: {e}"))
        print(dim("  → Crie um canal privado manualmente no Telegram e selecione abaixo.\n"))

        if canais:
            print("  Seus canais/grupos disponíveis:\n")
            for i, (cid, cname) in enumerate(canais[:15]):
                print(f"    [{i+1}] {cname}  (id={cid})")
            print()
            for attempt in range(1, 4):
                try:
                    escolha = input(f"  Número do canal para usar [{attempt}/3]: ").strip()
                    idx = int(escolha) - 1
                    if 0 <= idx < len(canais):
                        canal_id, cname = canais[idx]
                        print(green(f"  ✓ Selecionado: {cname} (id={canal_id})"))
                        break
                    else:
                        print(red("  → Número fora da lista.\n"))
                except ValueError:
                    print(red("  → Digite apenas o número.\n"))
        else:
            print(red("  Nenhum canal encontrado. Crie um no Telegram e rode o setup novamente."))
            await client.disconnect()
            sys.exit(1)

    if canal_id:
        with open(".env", "a") as f:
            f.write(f"\nTELEVAULT_CHANNEL_ID={canal_id}\n")
        print(green("✓ Channel ID salvo no .env"))

    await client.disconnect()
    return True

try:
    asyncio.run(authenticate())
except KeyboardInterrupt:
    print(red("\n✗ Cancelado"))
    sys.exit(0)
except Exception as e:
    print(red(f"\n✗ Erro: {e}"))
    sys.exit(1)

# ── 5. iniciar servidor ───────────────────────────────────────
hr()
print(bold("\n🚀 Iniciando servidor FastAPI...\n"))
print(dim("   Ctrl+C para parar\n"))
print(f"   API Docs → {blue(f'http://localhost:{PORT}/docs')}")
print(f"   Frontend → {blue('http://localhost:5173')}\n")
hr()

os.environ["TELEGRAM_API_ID"]   = str(api_id)
os.environ["TELEGRAM_API_HASH"] = api_hash

import socket
def port_free(p):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", p)) != 0

if not port_free(PORT):
    print(red(f"\n✗ Porta {PORT} já está em uso."))
    print(dim(f"  Para liberar: kill -9 $(lsof -t -i :{PORT})"))
    print(dim(f"  Ou use outra porta: python3 televault-setup.py --port 8001"))
    sys.exit(1)

backend_dir = Path(__file__).parent / "backend"
if not backend_dir.exists():
    print(red(f"✗ Pasta backend/ não encontrada em {backend_dir}"))
    print(dim("  Certifique-se de rodar o setup dentro da pasta do projeto."))
    sys.exit(1)

try:
    subprocess.run([
        sys.executable, "-m", "uvicorn",
        "app.main:app",
        "--reload",
        "--host", "127.0.0.1",
        "--port", str(PORT),
    ], cwd=str(backend_dir))
except KeyboardInterrupt:
    print(f"\n{dim('Servidor parado.')}")
