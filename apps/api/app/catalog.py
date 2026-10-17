"""Catálogo de personalização do Edu. O servidor só valida ids; a arte fica no front."""

CLASSES = {
    "robo": "Robô",
    "heroi": "Herói",
    "paladino": "Paladino",
    "mago": "Mago",
    "exploradora": "Exploradora",
}

# 6 cascos de robô + 12 tons de pele (a paleta mostrada depende da classe)
ROBOT_COLORS = ["turquesa", "coral", "amarelo", "prata", "violeta", "verde"]
SKIN_TONES = [f"pele{i}" for i in range(1, 13)]
HAIR_STYLES = ["curto", "longo", "cacheado", "careca", "coque", "moicano"]
HAIR_COLORS = ["preto", "castanho", "loiro", "ruivo", "azul", "rosa"]

ACCESSORIES = {
    "oculos": "Óculos",
    "capa": "Capa",
    "mochila": "Mochila",
    "chapeu": "Chapéu de explorador",
    "coroa": "Coroa",
    "capa_cartografo": "Capa do Cartógrafo (recompensa)",
}
LOCKED_ACCESSORIES = {"capa_cartografo"}  # exigem recompensa na Era 1
MAX_ACCESSORIES = 3

TOOLS = {
    "livro": "Livro — mostra uma pista em texto",
    "gibi": "Gibi — mostra uma pista em imagem",
    "lupa": "Lupa — elimina uma alternativa errada",
    "lanterna": "Lanterna — +10 segundos na pergunta",
    "pa": "Pá — cava um tesouro: +150 pontos se acertar",
    "bussola": "Bússola — mostra a dificuldade da pergunta",
}
TOOLS_TO_PICK = 2

SCENARIOS = {"floresta": "Floresta das Runas", "deserto": "Dunas Binárias", "ilha": "Ilha Flutuante"}
WORLDS = {"luzes": "Reino das Luzes", "vale": "Vale Sombrio", "engrenagens": "Cidade das Engrenagens"}


def catalog() -> dict:
    return {
        "classes": CLASSES,
        "robot_colors": ROBOT_COLORS,
        "skin_tones": SKIN_TONES,
        "hair_styles": HAIR_STYLES,
        "hair_colors": HAIR_COLORS,
        "accessories": ACCESSORIES,
        "locked_accessories": sorted(LOCKED_ACCESSORIES),
        "max_accessories": MAX_ACCESSORIES,
        "tools": TOOLS,
        "tools_to_pick": TOOLS_TO_PICK,
        "scenarios": SCENARIOS,
        "worlds": WORLDS,
    }


def validate_character(appearance: dict, tools: list, scenario: str, world: str, unlocked: list):
    """Levanta ValueError com mensagem em português se algo estiver fora do catálogo."""
    cls = appearance.get("cls")
    if cls not in CLASSES:
        raise ValueError("Classe inválida.")
    color = appearance.get("color")
    valid_colors = ROBOT_COLORS + SKIN_TONES if cls == "robo" else SKIN_TONES
    if color not in valid_colors:
        raise ValueError("Cor inválida.")
    if cls != "robo":
        if appearance.get("hair_style") not in HAIR_STYLES:
            raise ValueError("Cabelo inválido.")
        if appearance.get("hair_color") not in HAIR_COLORS:
            raise ValueError("Cor de cabelo inválida.")
    acc = appearance.get("accessories", [])
    if not isinstance(acc, list) or len(acc) > MAX_ACCESSORIES or len(set(acc)) != len(acc):
        raise ValueError(f"Escolha até {MAX_ACCESSORIES} acessórios diferentes.")
    for a in acc:
        if a not in ACCESSORIES:
            raise ValueError("Acessório inválido.")
        if a in LOCKED_ACCESSORIES and a not in unlocked:
            raise ValueError("Esse acessório ainda está bloqueado.")
    if not isinstance(tools, list) or len(tools) != TOOLS_TO_PICK or len(set(tools)) != len(tools):
        raise ValueError(f"Escolha exatamente {TOOLS_TO_PICK} ferramentas diferentes.")
    if any(t not in TOOLS for t in tools):
        raise ValueError("Ferramenta inválida.")
    if scenario not in SCENARIOS:
        raise ValueError("Cenário inválido.")
    if world not in WORLDS:
        raise ValueError("Mundo inválido.")
