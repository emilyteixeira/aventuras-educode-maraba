"""Configuração via variáveis de ambiente (prefixo AVENTURAS_)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AVENTURAS_", env_file=".env", extra="ignore")

    # Banco. Em produção: postgresql+asyncpg://usuario:senha@db:5432/aventuras
    database_url: str = "postgresql+asyncpg://aventuras:aventuras@localhost:5432/aventuras"

    # Códigos de cadastro. TROQUE em produção (ver docs/DEPLOY.md).
    class_code: str = "EDU-AVENTURA"  # alunos usam para criar conta
    tutor_code: str = "TUTOR-TROQUE-ME"  # tutores usam para criar conta

    # Cookies de sessão
    cookie_name: str = "aventuras_sid"
    cookie_secure: bool = False  # True atrás de HTTPS (produção)
    session_idle_hours: int = 8
    session_max_days: int = 7

    # Front compilado (servido pela própria API)
    web_dist: Path = Path(__file__).resolve().parents[2] / "web" / "dist"

    # Limites
    login_attempts_per_minute: int = 10
    ws_max_message_bytes: int = 4096

    # Sobrescritas do conteúdo secreto (opcionais). Ex.: "dividir,padrão,essencial,passos"
    unlock_words: str | None = None
    unlock_template: str | None = None  # ex.: "Para vencer um problema grande, eu ___ em partes, ..."
    reward_title: str | None = None
    reward_text: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
