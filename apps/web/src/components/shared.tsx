import { useEffect, useState } from "react";
import { sfx } from "../audio";
import type { GameState, PlayerCard } from "../types";
import Edu from "./Edu";

export const SHAPES = ["▲", "◆", "●", "■", "★", "⬟"];
export const TOOL_EMOJI: Record<string, string> = { livro: "📖", gibi: "💥", lupa: "🔍", lanterna: "🔦", pa: "⛏️", bussola: "🧭" };
export const TOOL_NAME: Record<string, string> = { livro: "Livro", gibi: "Gibi", lupa: "Lupa", lanterna: "Lanterna", pa: "Pá", bussola: "Bússola" };

/** Milissegundos restantes, contando localmente a partir do último estado do servidor. */
export function useRemaining(s: GameState, receivedAt: number, tick = true): number {
  const [, force] = useState(0);
  useEffect(() => {
    if (!tick || s.phase !== "question" || s.paused) return;
    const id = window.setInterval(() => force((x) => x + 1), 200);
    return () => window.clearInterval(id);
  }, [s.phase, s.paused, tick, s.question?.id]);
  if (s.phase !== "question" || s.remaining_ms === undefined) return 0;
  if (s.paused) return s.remaining_ms;
  return Math.max(0, s.remaining_ms - (performance.now() - receivedAt));
}

export function TimerBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  const secs = Math.ceil(remaining / 1000);
  useEffect(() => {
    if (secs > 0 && secs <= 5) sfx("tick");
  }, [secs]);
  return (
    <div>
      <div className={`timer${secs <= 5 ? " low" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={Math.ceil(total / 1000)} aria-valuenow={secs} aria-label="Tempo restante">
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="sr-only" aria-live="polite">
        {secs <= 5 ? `${secs} segundos` : ""}
      </span>
    </div>
  );
}

export function Leaderboard({ rows, meName, limit = 5 }: { rows: PlayerCard[]; meName?: string; limit?: number }) {
  return (
    <ol className="lb" aria-label="Ranking">
      {rows.slice(0, limit).map((r, i) => (
        <li key={r.nickname + i} className={r.nickname === meName ? "me" : ""}>
          <strong>{i + 1}º</strong>
          <Edu appearance={r.appearance} size={34} animate={false} label="" />
          <span>{r.nickname}</span>
          <span className="pts">{r.points}</span>
        </li>
      ))}
    </ol>
  );
}

export function Podium({ rows, label }: { rows: { name: string; sub?: string; points: number; appearance?: PlayerCard["appearance"] }[]; label: string }) {
  // ordem visual: 2º, 1º, 3º
  const order = [1, 0, 2].filter((i) => rows[i]);
  return (
    <div className="podium" role="group" aria-label={label}>
      {order.map((i) => (
        <div key={i} className={`col p${i + 1} rise`} style={{ animationDelay: `${(2 - i) * 0.25}s` }}>
          {rows[i].appearance && <Edu appearance={rows[i].appearance} size={i === 0 ? 90 : 72} label="" />}
          <div className="name">{rows[i].name}</div>
          {rows[i].sub && <div className="hint">{rows[i].sub}</div>}
          <div className="hint">{rows[i].points} pts</div>
          <div className="step">{i + 1}</div>
        </div>
      ))}
    </div>
  );
}
