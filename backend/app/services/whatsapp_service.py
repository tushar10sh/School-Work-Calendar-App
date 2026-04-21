import httpx
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)


def _url(path: str) -> str:
    return get_settings().whatsapp.service_url.rstrip("/") + path


async def get_status() -> dict:
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(_url("/status"))
        resp.raise_for_status()
        return resp.json()


async def get_qr() -> dict:
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(_url("/qr"))
        resp.raise_for_status()
        return resp.json()


async def list_groups() -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(_url("/groups"))
        resp.raise_for_status()
        return resp.json()


async def get_group_messages(group_id: str, since: int | None = None) -> list[dict]:
    params = {"limit": 100}
    if since:
        params["since"] = since
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(_url(f"/groups/{group_id}/messages"), params=params)
        resp.raise_for_status()
        return resp.json()


async def get_all_group_messages(group_id: str, since: int | None = None) -> list[dict]:
    params = {"limit": 100, "no_filter": "true"}
    if since:
        params["since"] = since
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(_url(f"/groups/{group_id}/messages"), params=params)
        resp.raise_for_status()
        return resp.json()


async def reconnect() -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(_url("/reconnect"))
        resp.raise_for_status()
        return resp.json()


async def disconnect() -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(_url("/disconnect"))
        resp.raise_for_status()
        return resp.json()
