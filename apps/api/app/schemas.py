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


class StudentJoinIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)
    nickname: str | None = Field(default=None, max_length=16)
    recovery_code: str | None = Field(default=None, max_length=32)

    @field_validator("code")
    @classmethod
    def _code(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.fullmatch(r"[A-HJKMNP-Z2-9]{6}", v):
            raise ValueError("PIN: informe os 6 caracteres da sala.")
        return v

    @field_validator("nickname")
    @classmethod
    def _nick(cls, v: str | None) -> str | None:
        return RegisterIn._nick(v) if v else None

    @field_validator("recovery_code")
    @classmethod
    def _recovery(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = re.sub(r"[\s-]", "", v).upper()
        if not re.fullmatch(r"[A-Z2-7]{16}", v):
            raise ValueError("Código pessoal: informe os 16 caracteres do seu cartão.")
        return v
