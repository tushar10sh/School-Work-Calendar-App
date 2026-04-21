from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.child import Child
from app.schemas.child import LoginRequest, LoginResponse, ChildResponse
from app.core.security import verify_pin, create_token
from app.config import get_settings
from app.dependencies import get_current_child

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Child).where(Child.id == body.child_id))
    child = result.scalar_one_or_none()
    if not child or not verify_pin(body.pin, child.pin_hash):
        raise HTTPException(status_code=401, detail="Invalid PIN")
    token = create_token(child.id, get_settings().auth.secret_key)
    return LoginResponse(token=token, child=ChildResponse.model_validate(child))


@router.get("/me", response_model=ChildResponse)
async def me(current_child: Child = Depends(get_current_child)):
    return ChildResponse.model_validate(current_child)
