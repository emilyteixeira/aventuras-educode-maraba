// Vitrine do design system (só em desenvolvimento: rota /design). Regras em docs/DESIGN-SYSTEM.md.
import { useState } from "react";
import Edu from "../components/Edu";
import { Leaderboard, Podium, SHAPES, TimerBar, TOOL_EMOJI, TOOL_NAME } from "../components/shared";
import type { Appearance } from "../types";

const COLORS: [string, string, string][] = [
  ["--bg", "#0c0b10", "Fundo"],
  ["--surface", "#141320", "Painel"],
  ["--surface-2", "#1b1929", "Painel elevado"],
  ["--surface-3", "#262338", "Chip / trilho"],
  ["--line-2", "#3b3757", "Borda"],
  ["--ink", "#f1e9d6", "Texto 15,2:1"],
  ["--ink-2", "#c8bfa9", "Texto 2 · 10,0:1"],
  ["--muted", "#8b84a3", "Dica · 5,2:1"],
  ["--teal", "#4fd1c5", "Turquesa · ação alt."],
  ["--gold", "#ffd23f", "Ouro · ação principal, pontos"],
  ["--coral", "#ff7f9e", "Coral · multiplicador, festa"],
  ["--ok", "#64d98b", "Acerto"],
  ["--danger", "#ff6159", "Erro"],
  ["--info", "#5b9bff", "Aviso"],
];

const EDUS: Appearance[] = [
  { cls: "robo", color: "turquesa", accessories: [] },
  { cls: "robo", color: "coral", accessories: ["oculos", "capa"] },
  { cls: "heroi", color: "pele3", hair_style: "curto", hair_color: "castanho", accessories: [] },
  { cls: "paladino", color: "pele9", hair_style: "longo", hair_color: "preto", accessories: ["capa"] },
  { cls: "mago", color: "pele6", hair_style: "cacheado", hair_color: "ruivo", accessories: ["oculos"] },
  { cls: "exploradora", color: "pele11", hair_style: "coque", hair_color: "preto", accessories: ["mochila"] },
  { cls: "exploradora", color: "pele1", hair_style: "moicano", hair_color: "rosa", accessories: ["coroa"] },
  { cls: "heroi", color: "pele7", hair_style: "cacheado", hair_color: "azul", accessories: ["chapeu", "capa_cartografo"] },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card stack" aria-labelledby={`ds-${title}`}>
      <h2 className="card-title" id={`ds-${title}`}>{title}</h2>
      {children}
    </section>
  );
}

export default function Design() {
  const [picked, setPicked] = useState(1);
  return (
    <main className="page stack">
      <h1>Design system</h1>
      <p className="hint">Aventuras v0.3 · pixel híbrido · turquesa, ouro e coral. Página só de desenvolvimento.</p>

      <Section title="Cores">
        <div className="grid auto">
          {COLORS.map(([v, hex, use]) => (
            <div key={v} className="stack" style={{ gap: 0 }}>
              <div style={{ background: `var(${v})`, height: 56, border: "2px solid var(--outline)", boxShadow: "var(--shadow-sm)" }} />
              <code>{v}</code>
              <span className="hint">{hex} · {use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografia">
        <h1 style={{ margin: 0 }}>Título H1 pixel</h1>
        <h2 style={{ margin: 0 }}>Título H2 pixel</h2>
        <h3 style={{ margin: 0 }}>Título H3 pixel</h3>
        <p className="qprompt" style={{ margin: 0 }}>Pergunta: qual passo vem antes de “escovar os dentes”?</p>
        <p style={{ margin: 0 }}>Texto corrido em Atkinson Hyperlegible, feita para leitura fácil (letras como I, l e 1 são diferentes).</p>
        <p className="hint" style={{ margin: 0 }}>Dica em --muted. Fonte pixel só em títulos e números (peso 400, a partir de 20 px).</p>
        <p className="stats-line" style={{ margin: 0 }}>5 missões · 20 desafios</p>
      </Section>

      <Section title="Botões">
        <div className="row">
          <button className="btn">Principal</button>
          <button className="btn alt">Turquesa</button>
          <button className="btn coral">Coral</button>
          <button className="btn ghost">Fantasma</button>
          <button className="btn ghost" aria-pressed="true">Ligado</button>
          <button className="btn" disabled>Desativado</button>
        </div>
        <div className="row">
          <button className="btn small">Pequeno</button>
          <button className="btn big"><span className="caret blink" aria-hidden="true">▶</span> Começar</button>
        </div>
        <p className="hint">Atalhos no desktop: <kbd>Enter</kbd> confirmar · <kbd>Esc</kbd> voltar</p>
      </Section>

      <Section title="Formulário e avisos">
        <div>
          <label htmlFor="ds-nick">Apelido de aventureiro</label>
          <input id="ds-nick" placeholder="ex.: Raio Azul" />
          <p className="hint">3 a 16 caracteres. Não use seu nome completo.</p>
        </div>
        <div className="success" role="status">✔ Resposta certa! +920 pontos</div>
        <div className="error">✖ Não foi dessa vez. A certa era “Padrão”.</div>
        <div className="notice">ⓘ Os tutores vão explicar o tema agora.</div>
      </Section>

      <Section title="Etiquetas e escolhas">
        <div className="row">
          <span className="chip">Sala KXT4PB</span>
          <span className="chip gold">1.240 pts · 2º</span>
          <span className="chip teal">Nível 3</span>
          <span className="mult">×1,5</span>
          <span className="pill ok">Respondeu</span>
          <span className="pill off">Saiu</span>
        </div>
        <div className="grid auto">
          {Object.keys(TOOL_NAME).map((t, i) => (
            <button key={t} className="choice tool-card" aria-pressed={i === picked} onClick={() => setPicked(i)}>
              <span className="emoji" aria-hidden="true">{TOOL_EMOJI[t]}</span> {TOOL_NAME[t]}
            </button>
          ))}
        </div>
        <div className="row">
          {["#fde3cf", "#d39565", "#74421f", "#391e0d"].map((c, i) => (
            <button key={c} className="swatch" style={{ background: c }} aria-label={`Tom ${i + 1}`} aria-pressed={i === 1} />
          ))}
        </div>
        <div className="steps" aria-hidden="true"><span className="done" /><span className="done" /><span className="cur" /><span /><span /></div>
      </Section>

      <Section title="Quiz">
        <div className="hud">
          <span className="chip">Missão 2 · Padrões</span>
          <span className="chip gold">980 pts</span>
        </div>
        <TimerBar remaining={18000} total={30000} />
        <p className="qprompt">Qual figura continua a sequência ▲ ● ▲ ● ▲ … ?</p>
        <div className="opts">
          {["Triângulo", "Círculo", "Quadrado", "Estrela"].map((t, i) => (
            <button key={t} className={`opt c${i}${i === 1 ? " right" : ""}${i === 0 ? " wrongpick" : ""}`}>
              <span className="shape" aria-hidden="true">{SHAPES[i]}</span>
              {t}
              <span className="count">{[3, 9, 1, 0][i]}</span>
            </button>
          ))}
        </div>
        <div className="clue">📖 <strong>Pista:</strong> repare no que se repete.</div>
        <ol className="order-list">
          <li><button className="order-item picked"><span className="num">1</span> Pegar a escova</button></li>
          <li><button className="order-item"><span className="num" /> Colocar a pasta</button></li>
        </ol>
      </Section>

      <Section title="Placar">
        <Podium
          label="Pódio de exemplo"
          rows={[
            { name: "Os Decifradores", points: 4120, appearance: EDUS[4] },
            { name: "Trio Faísca", points: 3880, appearance: EDUS[2] },
            { name: "Runas", points: 3500, appearance: EDUS[0] },
          ]}
        />
        <Leaderboard
          meName="Raio Azul"
          rows={[
            { nickname: "Nebulosa", points: 2010, appearance: EDUS[5] },
            { nickname: "Raio Azul", points: 1940, appearance: EDUS[1] },
            { nickname: "Pixel", points: 1500, appearance: EDUS[6] },
          ]}
        />
        <div className="code-big" aria-label="Código da sala KXT4PB">KXT4PB</div>
      </Section>

      <Section title="Edu (pixel art)">
        <div className="grid auto">
          {EDUS.map((a, i) => (
            <div key={i} className="center stack">
              <div className={`stage ${["scn-floresta", "scn-deserto", "scn-ilha"][i % 3]}`} style={{ minHeight: 190 }}>
                <Edu appearance={a} size={96} label={`Edu ${a.cls}`} />
              </div>
              <span className="hint">{a.cls} · {a.hair_style ?? a.color}</span>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
