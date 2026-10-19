import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { sfx } from "../audio";
import type { GameState, Question } from "../types";
import Edu from "./Edu";
import { Leaderboard, Podium, SHAPES, TOOL_EMOJI, TOOL_NAME, TimerBar, useRemaining } from "./shared";

type Send = (o: Record<string, unknown>) => void;
interface Props {
  s: GameState;
  send: Send;
  receivedAt: number;
}

export default function StudentGame({ s, send, receivedAt }: Props) {
  const me = s.me!;
  const lastKey = useRef("");
  useEffect(() => {
    const key = `${s.phase}:${s.question?.id ?? ""}:${me.unlock?.ok ?? ""}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (s.phase === "reveal" && me.result) sfx(me.result.correct ? "correct" : "wrong");
    else if (s.phase === "podium" || me.unlock?.ok) sfx("fanfare");
  }, [s.phase, s.question?.id, me.result, me.unlock?.ok]);

  const group = s.groups.find((g) => g.no === me.group);
  return (
    <main className="page stack">
      <div className="hud">
        <span className="chip">Sala {s.code}</span>
        {s.mission && (
          <span className="chip teal">
            Missão {s.mission.no}/{s.era.missions}
          </span>
        )}
        {s.mission?.boss && <span className="chip mult">Chefão ×1,5</span>}
        {group && <span className="chip">Grupo {group.name}</span>}
        <span className="chip gold" aria-label={`${me.points} pontos, posição ${me.rank}`}>
          {me.points} pts · {me.rank}º
        </span>
      </div>
      {s.paused && <div className="notice" role="status">⏸ Jogo pausado pelos tutores.</div>}
      {s.phase === "lobby" && <Lobby s={s} />}
      {s.phase === "intro" && <Intro s={s} />}
      {(s.phase === "question" || s.phase === "reveal") && s.question && <QuestionBlock key={s.question.id} s={s} send={send} receivedAt={receivedAt} />}
      {s.phase === "podium" && <PodiumView s={s} />}
      {(s.phase === "unlock" || s.phase === "finished") && <Unlock s={s} send={send} />}
    </main>
  );
}

function Lobby({ s }: { s: GameState }) {
  const me = s.me!;
  const group = s.groups.find((g) => g.no === me.group);
  return (
    <section className="stack">
      <div className="card center stack">
        <Edu appearance={me.appearance} size={150} label="O seu Edu" />
        <h2>Você entrou, {me.nickname}!</h2>
        <p>
          <span className="chip teal">{s.connected} na sala</span> <span className="hint">Aguardem os tutores.</span>
        </p>
      </div>
      <div className="card center">
        {group ? (
          <>
            <h3 className="card-title">Seu grupo: {group.name}</h3>
            <div className="members">
              {group.members.map((m) => (
                <div key={m.nickname}>
                  <Edu appearance={m.appearance} size={70} label="" />
                  <div>{m.nickname}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h3 className="card-title">Seu grupo</h3>
            <p className="hint">O grupo de 3 será sorteado pelos tutores.</p>
          </>
        )}
      </div>
      <p className="notice">ⓘ Dica: ouçam atentamente Hernandes e Emily. A frase do selo está escondida nas explicações.</p>
    </section>
  );
}

function Intro({ s }: { s: GameState }) {
  const m = s.mission!;
  return (
    <section className="card mission-banner stack">
      <p className="row" style={{ justifyContent: "center" }}>
        <span className="chip teal">Missão {m.no} de {s.era.missions}</span>
        <span className="chip gold">{m.pillar}</span>
        {m.boss && <span className="chip mult">Chefão ×1,5</span>}
      </p>
      <h2 className="big">{m.name}</h2>
      <Edu appearance={s.me!.appearance} size={110} label="" />
      <p>{m.intro}</p>
      <p className="notice">ⓘ Os tutores vão explicar o tema. Anotem as palavras importantes: elas voltam no final.</p>
    </section>
  );
}

function QuestionBlock({ s, send, receivedAt }: Props) {
  const q = s.question!;
  const me = s.me!;
  const reveal = s.phase === "reveal";
  const remaining = useRemaining(s, receivedAt);
  return (
    <section className="stack">
      {!reveal && (
        <div className="hud">
          <span className="row">
            <span className="chip">
              Pergunta {s.qindex + 1}/{s.mission!.questions}
            </span>
            {(s.mult_now ?? 1) > 1 && <span className="chip mult">×{s.mult_now}</span>}
          </span>
          <span className="chip" aria-live="off">
            ⏱ {Math.ceil(remaining / 1000)} s
          </span>
        </div>
      )}
      {!reveal && <TimerBar remaining={remaining} total={s.total_ms ?? q.seconds * 1000} />}
      <p className="qprompt" id="qprompt">{q.prompt}</p>
      {!reveal && <Tools s={s} send={send} />}
      {q.type === "mc" ? <Options s={s} q={q} send={send} /> : <OrderQ s={s} q={q} send={send} />}
      {!reveal && !me.answered && q.type === "mc" && (
        <p className="hint desk-only">
          Atalho: teclas <kbd>1</kbd> a <kbd>{q.options?.length ?? 4}</kbd> escolhem a alternativa.
        </p>
      )}
      {!reveal && me.answered && (
        <div className="notice" role="status">
          Resposta enviada! Aguardando os outros… ({s.answered}/{s.connected})
        </div>
      )}
      {reveal && <Reveal s={s} />}
    </section>
  );
}

function Tools({ s, send }: { s: GameState; send: Send }) {
  const me = s.me!;
  const fx = me.fx ?? {};
  return (
    <div>
      <div className="toolbar" role="group" aria-label="Suas armas do saber">
        {me.tools.map((t) => {
          const left = (me.tools_left ?? []).includes(t);
          return (
            <button key={t} className="btn alt small" disabled={!left || !!me.answered || s.paused} onClick={() => { sfx("tool"); send({ t: "tool", tool: t }); }}>
              {TOOL_EMOJI[t]} {TOOL_NAME[t]}
              {!left ? " (usada)" : ""}
            </button>
          );
        })}
      </div>
      {fx.hint && <div className="clue">📖 <strong>Pista:</strong> {fx.hint}</div>}
      {fx.comic && <div className="clue">💥 <strong>Gibi:</strong> <span style={{ fontSize: "1.4rem" }}>{fx.comic}</span></div>}
      {fx.difficulty && <div className="clue">🧭 Dificuldade: {"●".repeat(fx.difficulty)}{"○".repeat(3 - fx.difficulty)}</div>}
      {fx.lantern && <div className="clue">🔦 +10 segundos para você.</div>}
      {fx.shovel && <div className="clue">⛏️ Pá ativa: +150 pontos se acertar!</div>}
    </div>
  );
}

function Options({ s, q, send }: { s: GameState; q: Question; send: Send }) {
  const me = s.me!;
  const reveal = s.phase === "reveal";
  const correct = s.reveal?.correct as number | undefined;
  const mine = (reveal ? me.result?.value : me.my_value) as number | null | undefined;
  const gone = me.fx?.eliminated;

  useEffect(() => {
    if (reveal || me.answered) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= (q.options?.length ?? 0) && gone !== n - 1 && document.activeElement?.tagName !== "INPUT") {
        sfx("click");
        send({ t: "answer", qid: q.id, value: n - 1 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reveal, me.answered, q.id, q.options?.length, gone, send]);

  return (
    <div className="opts" role="group" aria-labelledby="qprompt">
      {q.options!.map((text, i) => {
        const cls = ["opt", `c${i}`];
        if (!reveal && gone === i) cls.push("gone");
        if (reveal && i === correct) cls.push("right");
        if (reveal && mine === i && i !== correct) cls.push("wrongpick");
        if (!reveal && me.answered && mine !== i) cls.push("gone");
        return (
          <button
            key={i}
            className={cls.join(" ")}
            disabled={reveal || !!me.answered || gone === i || s.paused}
            aria-pressed={mine === i}
            onClick={() => {
              sfx("click");
              send({ t: "answer", qid: q.id, value: i });
            }}
          >
            <span className="shape" aria-hidden="true">{SHAPES[i]}</span>
            <span>{text}</span>
            {reveal && s.reveal?.counts && <span className="count" aria-label={`${s.reveal.counts[i]} escolheram`}>{s.reveal.counts[i]}</span>}
            {reveal && i === correct && <span className="sr-only">(resposta certa)</span>}
          </button>
        );
      })}
    </div>
  );
}

function OrderQ({ s, q, send }: { s: GameState; q: Question; send: Send }) {
  const me = s.me!;
  const reveal = s.phase === "reveal";
  const [picked, setPicked] = useState<number[]>([]);
  const items = q.items!;
  const mine = (reveal ? me.result?.value : me.my_value) as number[] | null | undefined;
  const correct = (s.reveal?.correct as number[] | undefined) ?? [];
  const text = (i: number) => items.find((x) => x.i === i)?.text ?? "";

  if (reveal) {
    return (
      <div>
        <p className="hint">Ordem correta:</p>
        <ol className="order-list">
          {correct.map((i, n) => (
            <li key={i} className="order-item picked">
              <span className="num">{n + 1}</span>
              {text(i)}
            </li>
          ))}
        </ol>
        {mine && <p className="hint">A sua: {mine.map((i) => text(i)).join(" → ")}</p>}
      </div>
    );
  }
  const locked = !!me.answered || s.paused;
  const shown = locked && mine ? mine : picked;
  return (
    <div>
      <p className="hint">Toque nos passos na ordem certa. Toque de novo para tirar.</p>
      <ul className="order-list">
        {items.map((it) => {
          const pos = shown.indexOf(it.i);
          return (
            <li key={it.i}>
              <button
                className={`order-item${pos >= 0 ? " picked" : ""}`}
                disabled={locked}
                aria-pressed={pos >= 0}
                onClick={() => {
                  sfx("click");
                  setPicked((p) => (p.includes(it.i) ? p.filter((x) => x !== it.i) : [...p, it.i]));
                }}
              >
                <span className="num">{pos >= 0 ? pos + 1 : ""}</span>
                {it.text}
              </button>
            </li>
          );
        })}
      </ul>
      {!locked && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={() => setPicked([])}>Limpar</button>
          <button className="btn" disabled={picked.length !== items.length} onClick={() => send({ t: "answer", qid: q.id, value: picked })}>
            Enviar ordem
          </button>
        </div>
      )}
    </div>
  );
}

function Reveal({ s }: { s: GameState }) {
  const me = s.me!;
  const r = me.result;
  return (
    <div className="stack">
      <div className={r?.correct ? "success" : "error"} role="status">
        {r?.answered ? (r.correct ? `✔ Acertou! +${r.points} pontos` : "✖ Não foi dessa vez. 0 pontos") : "– Sem resposta desta vez."}
      </div>
      <div className="card">
        <h3 className="card-title">Por quê?</h3>
        <p style={{ margin: 0 }}>{s.reveal?.explanation}</p>
      </div>
      <div className="card">
        <h3 className="card-title">Ranking</h3>
        <Leaderboard rows={s.leaderboard} meName={me.nickname} />
      </div>
      <p className="hint">Próxima pergunta em instantes…</p>
    </div>
  );
}

function PodiumView({ s }: { s: GameState }) {
  const p = s.podium!;
  const me = s.me!;
  return (
    <section className="stack center">
      <h2>Pódio da missão {p.mission}</h2>
      <Podium label="Pódio individual" rows={p.individuals.map((x) => ({ name: x.nickname, points: x.points, appearance: x.appearance }))} />
      <h3>Grupos</h3>
      <Podium label="Pódio dos grupos" rows={p.groups.map((g) => ({ name: g.name, sub: g.members.map((m) => m.nickname).join(", "), points: g.points }))} />
      <div className="card raised">
        <h3 className="card-title">Sua missão</h3>
        <p className="row" style={{ justifyContent: "center", margin: 0 }}>
          <span className="chip gold">{me.mission_points ?? 0} pts</span>
          <span className="chip mult">+{me.xp_gain ?? 0} XP</span>
          <span className="chip teal">Nível {me.level}</span>
        </p>
      </div>
      <p className="notice">ⓘ Hora de ouvir os tutores. A próxima missão começa quando eles liberarem.</p>
    </section>
  );
}

function Unlock({ s, send }: { s: GameState; send: Send }) {
  const me = s.me!;
  const u = s.unlock!;
  const [words, setWords] = useState<string[]>(() => u.blanks.map(() => ""));
  const done = me.unlock?.ok;
  const fb = me.unlock?.feedback;
  const group = s.groups.find((g) => g.no === me.group);

  function submit(e: FormEvent) {
    e.preventDefault();
    sfx("click");
    send({ t: "unlock", words });
  }

  if (s.phase === "finished") {
    return (
      <section className="stack">
        <h2>Fim da Era 1!</h2>
        {done && me.unlock?.reward && <Reward r={me.unlock.reward} />}
        <div className="card">
          <h3 className="card-title">Ranking final</h3>
          <Leaderboard rows={s.leaderboard} meName={me.nickname} limit={10} />
        </div>
        <h3>Grupos</h3>
        <Podium label="Pódio final dos grupos" rows={[...s.groups].sort((a, b) => b.points - a.points).slice(0, 3).map((g) => ({ name: g.name, sub: g.members.map((m) => m.nickname).join(", "), points: g.points }))} />
        <p className="center"><Link className="btn" to="/jogar">Voltar ao início</Link></p>
      </section>
    );
  }
  return (
    <section className="stack">
      <h2>O Selo da Era 1</h2>
      {done && me.unlock?.reward ? (
        <Reward r={me.unlock.reward} />
      ) : (
        <>
          <p>
            Grupo <strong>{group?.name}</strong>: juntem o que os tutores explicaram e completem a frase. Discutam entre vocês! Qualquer um do grupo pode tentar.
          </p>
          <form className="card stack" onSubmit={submit} aria-labelledby="h-phrase">
            <h3 id="h-phrase" className="card-title">Frase secreta</h3>
            <p className="phrase">{u.template}</p>
            <div className="blanks">
              {u.blanks.map((label, i) => (
                <div key={label}>
                  <label htmlFor={`b${i}`}>{label}</label>
                  <input id={`b${i}`} value={words[i]} maxLength={24} autoComplete="off" onChange={(e) => setWords((w) => w.map((x, k) => (k === i ? e.target.value : x)))} />
                </div>
              ))}
            </div>
            {fb && !fb.ok && <div className="error" role="status">✖ {fb.by} tentou: {fb.correct} de {fb.total} lacunas certas. Continuem!</div>}
            <button className="btn big" disabled={words.some((w) => !w.trim())}>Decifrar o selo</button>
          </form>
        </>
      )}
      <div className="card">
        <h3 className="card-title">Grupos</h3>
        <ul className="lb">
          {s.groups.map((g) => (
            <li key={g.no} className={g.no === me.group ? "me" : ""}>
              <strong>{g.name}</strong> <span className="hint">{g.members.map((m) => m.nickname).join(", ")}</span>
              <span className="pts">{g.unlocked ? "🔓 selo aberto" : "🔒 fechado"}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Reward({ r }: { r: { title: string; text: string; item: string } }) {
  return (
    <div className="card raised badge-new stack center" role="status">
      <p>
        <span className="chip gold">Selo aberto</span>
      </p>
      <div style={{ fontSize: "3rem" }} aria-hidden="true">🗝️</div>
      <h2>{r.title}</h2>
      <p>{r.text}</p>
      <p className="success">✔ Sua Capa do Cartógrafo foi liberada! Equipe em “Editar meu Edu”.</p>
      <Link className="btn alt" to="/onboarding">Editar meu Edu</Link>
    </div>
  );
}
