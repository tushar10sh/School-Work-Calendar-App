import os
import functools
import yaml
from pydantic import BaseModel


class AppConfig(BaseModel):
    name: str
    timezone: str


class DatabaseConfig(BaseModel):
    path: str


class OllamaConfig(BaseModel):
    base_url: str
    model: str
    timeout: int


class SubjectsConfig(BaseModel):
    mappings: dict[str, str]


class SectionsConfig(BaseModel):
    cw_aliases: list[str]
    pw_aliases: list[str]


class AuthConfig(BaseModel):
    secret_key: str


class SyncConfig(BaseModel):
    auto_sync: bool = True
    default_interval_minutes: int = 60


class WhatsAppConfig(BaseModel):
    service_url: str
    message_filter: str = "planner"


class Settings(BaseModel):
    app: AppConfig
    database: DatabaseConfig
    ollama: OllamaConfig
    subjects: SubjectsConfig
    sections: SectionsConfig
    auth: AuthConfig
    sync: SyncConfig
    whatsapp: WhatsAppConfig


@functools.lru_cache
def get_settings() -> Settings:
    config_path = os.getenv("CONFIG_PATH", "config.yaml")
    with open(config_path) as f:
        raw = yaml.safe_load(f)
    return Settings(**raw)
