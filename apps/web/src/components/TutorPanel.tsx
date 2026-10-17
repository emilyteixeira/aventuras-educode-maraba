import type { GameState } from "../types";
import { Leaderboard, Podium, TimerBar, useRemaining } from "./shared";

interface Props {
  s: GameState;
  send: (o: Record<string, unknown>) => void;
  receivedAt: number;
}

const PHASE_LABEL: Record<string, string> = {
  lobby: "Sala de espera",
  intro: "Apresentação da missão",
  question: "Pergunta no ar",
  reveal: "Resposta revelada",
  podium: "Pódio",
  unlock: "Selo da Era",
  finished: "Encerrado",
};

export default function TutorPanel({ s, send, receivedAt }: Props) {
  const t = s.tutor!;
  const cmd = (c: string, extra: Record<string, unknown> = {}) => send({ t: "tutor", cmd: c, ...extra });
  const remaining = useRemaining(s, receivedAt);
  const q = s.question;
  const nextLabel: Record<string, string> = {
    intro: "Começar missão ▶",
    reveal: "Próxima ▶",
    podium: s.mission && s.mission.no === s.era.missions ? "Abrir o selo ▶" : "Próxima missão ▶",
  };
  return (
    <main className="page stack">
      <div className="card center">
        <p className="hint">Alunos: entrem em <strong>{location.host}</strong>, façam login e digitem o código</p>
        <div className="code-big" aria-label={`Código da sala ${s.code.split("").join(" ")}`}>{s.code}</div>
        <p>
          <span className="chip gold">{PHASE_LABEL[s.phase]}</span>{" "}
          <span className="chip">{s.connected} conectados / {s.players} na sala</span>{" "}
          {s.mission && <span className="chip">Missão {s.mission.no}/{s.era.missions} · {s.mission.name} · {s.mission.pillar}</span>}
          {s.paused && <span className="chip">⏸ pausado</span>}
        </p>
      </div>

      <div className="card stack">
        <h3>Controles</h3>
        <div className="row">
          {s.phase === "lobby" && (
            <>
              <button className="btn alt" onClick={() => cmd("groups")}>🎲 Sortear grupos</button>
              <button className="btn" disabled={s.players === 0} onClick={() => cmd("start")}>Iniciar Era 1 ▶</button>
            </>
          )}
          {nextLabel[s.phase] && <button className="btn big" onClick={() => cmd("next")}>{nextLabel[s.phase]}</button>}
          {s.phase === "question" && <button className="btn alt" onClick={() => cmd("reveal")}>Revelar agora</button>}
          {(s.phase === "question" || s.phase === "reveal") && (s.paused ? <button className="btn" onClick={() => cmd("resume")}>▶ Retomar</button> : <button className="btn ghost" onClick={() => cmd("pause")}>⏸ Pausar</button>)}
          {s.phase !== "finished" && s.phase !== "lobby" && <button className="btn ghost" onClick={() => cmd("finish")}>Encerrar sala</button>}
        </div>
        <div className="row">
          <span>Multiplicador das próximas perguntas:</span>
          {[1, 1.5, 2].map((m) => (
            <button key={m} className="choice" aria-pressed={s.mult === m} onClick={() => cmd("mult", { value: m })}>×{m}</button>
          ))}
          <label className="row" style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={s.auto} onChange={(e) => cmd("auto", { value: e.target.checked })} style={{ width: 24, minHeight: 24 }} />
            Avançar sozinho após a resposta (12 s)
          </label>
        </div>
      </div>

      {q && (
        <div className="card stack">
          <h3>Pergunta {s.qindex + 1}/{s.mission?.questions} · dificuldade {q.difficulty}</h3>
          {s.phase === "question" && <TimerBar remaining={remaining} total={s.total_ms ?? 30000} />}
          <p className="qprompt">{q.prompt}</p>
          <ul>
            {(q.options ?? q.items?.map((i) => i.text) ?? []).map((o, i) => (
              <li key={i} style={q.type === "mc" && q.correct === i ? { color: "var(--ok)", fontWeight: 700 } : undefined}>{o}{q.type === "mc" && q.correct === i ? "  ✓" : ""}</li>
            ))}
          </ul>
          {q.type === "order" && <p className="hint">Ordem certa: {(q.correct as number[]).map((i) => q.items!.find((x) => x.i === i)?.text).join(" → ")}</p>}
          <p className="hint">Explicação: {q.explanation}</p>
          <p>Responderam: <strong>{s.answered ?? 0}</strong> / {s.connected}</p>
        </div>
      )}

      {s.phase === "podium" && s.podium && (
        <div className="card center">
          <h3>Pódio da missão {s.podium.mission}</h3>
          <Podium label="Pódio individual" rows={s.podium.individuals.map((x) => ({ name: x.nickname, points: x.points, appearance: x.appearance }))} />
          <Podium label="Pódio dos grupos" rows={s.podium.groups.map((g) => ({ name: g.name, sub: g.members.map((m) => m.nickname).join(", "), points: g.points }))} />
        </div>
      )}

      {(s.phase === "unlock" || s.phase === "finished") && (
        <div className="card">
          <h3>Selo da Era 1 (só tutores veem)</h3>
          <p className="phrase">{s.unlock?.template}</p>
          <p>Palavras: <strong>{t.secret.join(" · ")}</strong></p>
          <ul className="lb">
            {s.groups.map((g) => (
              <li key={g.no}><strong>{g.name}</strong> <span className="hint">{g.members.map((m) => m.nickname).join(", ")}</span><span className="pts">{g.unlocked ? "🔓" : "🔒"}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>Alunos</h3>
        <div className="pill-list">
          {t.players.map((p) => (
            <span key={p.uid} className={`pill${p.answered ? " ok" : ""}${p.connected ? "" : " off"}`}>
              {p.nickname}{p.group ? ` · G${p.group}` : ""} · {p.points}
            </span>
          ))}
          {t.players.length === 0 && <span className="hint">Ninguém entrou ainda.</span>}
        </div>
      </div>

      <div className="card">
        <h3>Ranking</h3>
        <Leaderboard rows={s.leaderboard} limit={8} />
        <h3 style={{ marginTop: 12 }}>Grupos</h3>
        <ul className="lb">
          {s.groups.map((g) => (
            <li key={g.no}><strong>{g.name}</strong> <span className="hint">{g.members.map((m) => m.nickname).join(", ")}</span><span className="pts">{g.points}</span></li>
          ))}
        </ul>
      </div>
    </main>
  );
}
