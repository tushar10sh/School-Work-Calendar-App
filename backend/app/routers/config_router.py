from fastapi import APIRouter
from pydantic import BaseModel
from app.config import get_settings

router = APIRouter()


class ConfigResponse(BaseModel):
    subject_mappings: dict[str, str]
    cw_aliases: list[str]
    pw_aliases: list[str]
    ollama_model: str
    ollama_base_url: str
    app_name: str
    timezone: str


@router.get("/", response_model=ConfigResponse)
async def get_config():
    settings = get_settings()
    return ConfigResponse(
        subject_mappings=settings.subjects.mappings,
        cw_aliases=settings.sections.cw_aliases,
        pw_aliases=settings.sections.pw_aliases,
        ollama_model=settings.ollama.model,
        ollama_base_url=settings.ollama.base_url,
        app_name=settings.app.name,
        timezone=settings.app.timezone,
    )
