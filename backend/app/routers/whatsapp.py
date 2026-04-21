from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.child import Child
from app.dependencies import get_current_child
from app.services import whatsapp_service

router = APIRouter()


class ConnectGroupRequest(BaseModel):
    group_id: str
    group_name: str


@router.get("/status")
async def wa_status():
    try:
        return await whatsapp_service.get_status()
    except Exception as e:
        return {"status": "UNREACHABLE", "error": str(e)}


@router.get("/qr")
async def wa_qr():
    try:
        return await whatsapp_service.get_qr()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/groups")
async def wa_groups(_: Child = Depends(get_current_child)):
    try:
        return await whatsapp_service.list_groups()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/connect-group")
async def connect_group(
    body: ConnectGroupRequest,
    current_child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    current_child.whatsapp_group_id = body.group_id
    current_child.whatsapp_group_name = body.group_name
    await db.commit()
    await db.refresh(current_child)
    return {"ok": True, "group_name": body.group_name}


@router.post("/reconnect")
async def wa_reconnect():
    try:
        return await whatsapp_service.reconnect()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/disconnect")
async def wa_disconnect():
    try:
        return await whatsapp_service.disconnect()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
