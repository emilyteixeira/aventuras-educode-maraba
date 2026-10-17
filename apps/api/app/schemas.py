import re

from pydantic import BaseModel, Field, field_validator

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
NICK_RE = re.compile(r"^[\wÀ-ÿ][\wÀ-ÿ \-]{1,15}$")


class RegisterIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)
    nickname: str
    code: str = Field(max_length=64)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("E-mail inválido.")
        return v

    @field_validator("nickname")
    @classmethod
    def _nick(cls, v: str) -> str:
        v = " ".join(v.split())
        if not NICK_RE.match(v):
            raise ValueError("Apelido: 2 a 16 letras, números, espaço ou hífen.")
        return v


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return v.strip().lower()


class CharacterIn(BaseModel):
    appearance: dict
    tools: list[str]
    scenario: str
    world: str
