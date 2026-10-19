# Design system — Aventuras do Edu (v0.3, 19/10/2026)

Direção **pixel híbrido**: a estética de jogo retrô do EvoluAI (palis.dev/epoch), com raio 0, sombra dura, bisel e Edu em pixel art, usando a paleta própria do Aventuras (turquesa, ouro e coral). Objetivo: ficar mais atraente para adolescentes sem mudar o jogo (Kahoot + RPG) e sem perder legibilidade nem acessibilidade.

- Tokens: `apps/web/src/tokens.css` · estilos: `apps/web/src/styles.css`
- Vitrine viva: `/design` (só em `pnpm dev`; fica fora do build de produção)

## Decisões (Emily, 19/10/2026)

| Tema | Escolha | Alternativas descartadas |
|---|---|---|
| Intensidade | Híbrido: pixel em títulos, logotipo, números e Edu; texto legível no resto | Pixel total; só tokens |
| Paleta | Base escura do EvoluAI + turquesa/ouro/coral (continuidade com a v1 e o PRD §11) | Verde-limão do EvoluAI |
| Entrega | Código no repo + página `/design` | Artefato externo; só protótipo |

Inspiração não é cópia: não usamos o verde-limão, o logotipo, o mapa de ilhas nem os sprites do EvoluAI.

## Cores

| Token | Valor | Uso | Contraste em `--surface` |
|---|---|---|---|
| `--bg` / `--surface` / `--surface-2` / `--surface-3` | `#0c0b10` / `#141320` / `#1b1929` / `#262338` | Fundo, painel, painel elevado, chip | — |
| `--ink` | `#f1e9d6` | Texto | 15,2:1 |
| `--ink-2` | `#c8bfa9` | Texto secundário | 10,0:1 |
| `--muted` | `#8b84a3` | Dicas. **Menor cor permitida para texto** | 5,2:1 |
| `--gold` | `#ffd23f` | Ação principal, pontos, foco | 12,7:1 |
| `--teal` | `#4fd1c5` | Ação alternativa, progresso, ligado | 9,8:1 |
| `--coral` | `#ff7f9e` | Multiplicador, celebração | 7,7:1 |
| `--ok` / `--danger` / `--info` | `#64d98b` / `#ff6159` / `#5b9bff` | Estados, sempre com ícone + texto | ≥ 6,2:1 |
| `--opt-0…5` | Iguais à v0.2 | Alternativas do quiz (contraste validado; **não clarear**) | — |

Texto sobre ouro, turquesa ou coral: `--ink-dark` (`#12101c`).

## Tipografia

| Papel | Fonte | Regra |
|---|---|---|
| Títulos, logotipo, código da sala, número do pódio | **Pixelify Sans** (OFL) | **Só peso 400 e a partir de 20 px.** No 700, "C" vira "O" em qualquer tamanho |
| Dígitos dentro da fonte pixel | **Atkinson Hyperlegible** 700 (face `Pixel Digits`, `unicode-range` 0–9) | Na Pixelify o "5" parece "S", o que é grave no código da sala |
| Perguntas, botões, chips, textos | **Atkinson Hyperlegible** 400/700 (OFL) | Feita para baixa visão; distingue I/l/1 |

As fontes são servidas pelo próprio app (`@fontsource`, subconjunto latin, cerca de 50 KB em woff2). Sem CDN de terceiros (PRD §9).

## Forma, espaço e movimento

- Raio **0** em tudo. Borda de 2 px. Sombra dura `4px 4px 0 #000a` (`--shadow`), ou `2px` (`--shadow-sm`).
- Botões e alternativas: `--bevel` (luz no canto superior esquerdo, sombra no inferior direito). Ao apertar, deslocam 2 px.
- Grade de 4 px (`--s-1…--s-12`). O Edu usa a mesma grade (30×40 "pixels" de 4 unidades).
- Alvos de toque de 48 px (mínimo 44 px).
- Animações em `steps()`, com cara de sprite. Todas desligam no **modo calmo** e em `prefers-reduced-motion`. O efeito de scanline no palco é estático.

## Componentes (classes)

`btn` (+ `alt`, `coral`, `ghost`, `small`, `big`) · `card` (+ `raised`, `card-title`) · `chip` (+ `gold`, `teal`) · `mult` · `pill` · `choice` · `swatch` · `steps` · `stage` + `scn-*`/`wld-*` · `timer` (em blocos) · `opt c0…c5` (+ `right`, `wrongpick`, `gone`) · `order-item` · `clue` · `lb` · `podium` · `code-big` · `error`/`success`/`notice` · `kbd` · `title-logo`, `tagline`, `stats-line`, `blink`.

Erro e acerto nunca só por cor: a alternativa errada usa contorno **tracejado** e a certa, contorno **contínuo**, além do texto.

## Edu

`apps/web/src/components/Edu.tsx`: SVG com `shape-rendering: crispEdges`, blocos com contorno de 1 pixel e cantos "mordidos". Mantém os mesmos ids do catálogo do servidor (`catalog.py`): classes, 12 tons de pele, 6 cores, 5 cabelos e 6 acessórios. Arte própria do projeto (ver `CREDITS.md`).

## Verificado em 19/10/2026

- `pnpm build`: JS 96,9 KB gzip (igual à v0.2). CSS 4,5 KB gzip. `/design` fora do bundle.
- E2E `apps/web/e2e/run.mjs` (1 tutor + 3 alunos, celular 390 px e desktop): aula completa, 0 erro de console, **0 violação axe** (WCAG 2.2 AA).
- Landing em 375 px sem rolagem horizontal.
- **Não verificado:** celulares reais, Firefox do laboratório, Orca/TalkBack.

## Próximos passos possíveis

1. Telas de onboarding, sala e painel do tutor ainda usam o layout antigo, só com os tokens novos. Dá para revisá-las peça por peça.
2. Tela de título com "Pressione Enter" e dicas de teclado (`kbd`) para os desktops do laboratório.
3. Ícones em pixel art próprios no lugar dos emojis (hoje variam entre Ubuntu e iOS).
