"""Carrega e valida o conteúdo de uma era (apps/api/app/content/<era>.json)."""

import json
import unicodedata
from functools import lru_cache
from pathlib import Path

from ..config import get_settings

CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"


def norm(text: str) -> str:
    """Minúsculas, sem acentos, sem espaços nas pontas."""
    t = unicodedata.normalize("NFD", str(text).strip().lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def validate_era(data: dict) -> None:
    ids: set[str] = set()
    assert data["missions"], "era sem missões"
    for m in data["missions"]:
        assert m["questions"], f"missão {m['no']} sem perguntas"
        for q in m["questions"]:
            assert q["id"] not in ids, f"id repetido {q['id']}"
            ids.add(q["id"])
            if q["type"] == "mc":
                assert 2 <= len(q["options"]) <= 6
                assert 0 <= q["answer"] < len(q["options"]), q["id"]
            elif q["type"] == "order":
                assert 2 <= len(q["items"]) <= 6, q["id"]
            else:
                raise AssertionError(f"tipo inválido em {q['id']}")
    assert data["unlock"]["blanks"]


@lru_cache
def load_era(era_id: str) -> dict:
    data = json.loads((CONTENT_DIR / f"{era_id}.json").read_text(encoding="utf-8"))
    s = get_settings()
    if s.unlock_words:
        words = [w.strip() for w in s.unlock_words.split(",") if w.strip()]
        for blank, w in zip(data["unlock"]["blanks"], words, strict=False):
            blank["accept"] = [w, *[a for a in blank["accept"] if a != w]]  # a palavra dos tutores vem primeiro
    if s.unlock_template:
        data["unlock"]["template"] = s.unlock_template
    if s.reward_title:
        data["reward"]["title"] = s.reward_title
    if s.reward_text:
        data["reward"]["text"] = s.reward_text
    validate_era(data)
    return data
