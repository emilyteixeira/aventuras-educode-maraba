import random

import pytest

from app import catalog
from app.game.content import load_era, norm, validate_era
from app.game.engine import LEVELS, level_for, make_groups, score_answer


def test_score_wrong_is_zero():
    assert score_answer(False, 1, 30) == 0


def test_score_instant_and_last_second():
    assert score_answer(True, 0, 30) == 1000
    assert score_answer(True, 30, 30) == 800
    assert score_answer(True, 15, 30) == 900


def test_score_boss_mult_and_shovel():
    assert score_answer(True, 0, 30, boss=True) == 1500
    assert score_answer(True, 0, 30, mult=2.0) == 2000
    assert score_answer(True, 30, 30, shovel=True) == 950


@pytest.mark.parametrize(
    "xp,level", [(0, 1), (249, 1), (250, 2), (600, 3), (1050, 4), (1600, 5), (2200, 6), (9999, 6)]
)
def test_levels(xp, level):
    assert level_for(xp) == level
    assert LEVELS == (250, 600, 1050, 1600, 2200)


@pytest.mark.parametrize("n,sizes", [(1, [1]), (2, [2]), (3, [3]), (4, [4]), (5, [3, 2]), (7, [3, 4]), (20, [3] * 6 + [2])])
def test_make_groups_sizes(n, sizes):
    m = make_groups(list(range(n)), random.Random(1))
    got = sorted(sum(1 for g in m.values() if g == k) for k in set(m.values()))
    assert got == sorted(sizes)
    assert set(m) == set(range(n))


def test_era1_has_20_questions_and_valid():
    era = load_era("era1")
    validate_era(era)
    qs = [q for m in era["missions"] for q in m["questions"]]
    assert len(qs) == 20
    assert era["missions"][-1].get("boss") is True
    assert all(q.get("explanation") and q.get("hint") and q.get("comic") for q in qs)


def test_norm_accents_and_case():
    assert norm("  PADRÃO ") == "padrao"


def test_unlock_words_override(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("AVENTURAS_UNLOCK_WORDS", "fatiar,molde,nucleo,roteiro")
    get_settings.cache_clear()
    load_era.cache_clear()
    era = load_era("era1")
    assert "fatiar" in era["unlock"]["blanks"][0]["accept"]
    monkeypatch.delenv("AVENTURAS_UNLOCK_WORDS")
    get_settings.cache_clear()
    load_era.cache_clear()


def test_character_validation_rules():
    ok = {"cls": "mago", "color": "pele3", "hair_style": "curto", "hair_color": "azul", "accessories": ["capa"]}
    catalog.validate_character(ok, ["livro", "lupa"], "floresta", "luzes", [])
    robot = {"cls": "robo", "color": "coral", "accessories": []}
    catalog.validate_character(robot, ["pa", "gibi"], "ilha", "vale", [])
    with pytest.raises(ValueError):
        catalog.validate_character(ok, ["livro"], "floresta", "luzes", [])
    with pytest.raises(ValueError):
        catalog.validate_character({**ok, "accessories": ["capa_cartografo"]}, ["livro", "lupa"], "floresta", "luzes", [])
    catalog.validate_character({**ok, "accessories": ["capa_cartografo"]}, ["livro", "lupa"], "floresta", "luzes", ["capa_cartografo"])
    with pytest.raises(ValueError):
        catalog.validate_character({**ok, "cls": "dragao"}, ["livro", "lupa"], "floresta", "luzes", [])
    with pytest.raises(ValueError):
        catalog.validate_character({**ok, "accessories": ["capa", "oculos", "coroa", "mochila"]}, ["livro", "lupa"], "floresta", "luzes", [])
