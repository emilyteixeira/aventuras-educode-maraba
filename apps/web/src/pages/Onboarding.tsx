import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { sfx, unlockAudioOnGesture } from "../audio";
import Edu, { hairHex, robotHex, skinHex } from "../components/Edu";
import { useSession } from "../session";
import type { Appearance, Catalog } from "../types";

const CLASS_EMOJI: Record<string, string> = { robo: "🤖", heroi: "🦸", paladino: "🛡️", mago: "🧙", exploradora: "🧭" };
const TOOL_EMOJI: Record<string, string> = { livro: "📖", gibi: "💥", lupa: "🔍", lanterna: "🔦", pa: "⛏️", bussola: "🧭" };
const SCN_EMOJI: Record<string, string[]> = { floresta: ["🌲", "🍄", "🦉"], deserto: ["🏜️", "🌵", "🐪"], ilha: ["🏝️", "☁️", "🪁"] };
const WLD_TEXT: Record<string, string> = {
  luzes: "Um reino onde tudo brilha e os enigmas parecem cantar.",
  vale: "Um vale de sombras roxas, cheio de segredos escondidos.",
  engrenagens: "Uma cidade de máquinas antigas que só funcionam com lógica.",
};
const STEPS = ["Edu", "Armas", "Cenário", "Mundo", "Tutores"];

const DEFAULT_ROBOT: Appearance = { cls: "robo", color: "turquesa", accessories: [] };

export default function Onboarding() {
  const { me, refresh } = useSession();
  const nav = useNavigate();
  const [cat, setCat] = useState<Catalog | null>(null);
  const [step, setStep] = useState(0);
  const [app, setApp] = useState<Appearance>(() => {
    const a = me?.character?.appearance;
    return a && a.cls ? ({ accessories: [], ...a } as Appearance) : DEFAULT_ROBOT;
  });
  const [tools, setTools] = useState<string[]>(me?.character?.tools ?? []);
  const [scenario, setScenario] = useState(me?.character?.scenario ?? "floresta");
  const [world, setWorld] = useState(me?.character?.world ?? "luzes");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const unlocked = me?.character?.unlocked ?? [];

  useEffect(() => {
    void api.catalog().then(setCat);
  }, []);
  if (!cat)
    return (
      <main className="page center">
        <p className="notice" role="status">Carregando o catálogo…</p>
      </main>
    );

  const robot = app.cls === "robo";
  const setClass = (cls: string) => {
    sfx("click");
    if (cls === "robo") setApp({ cls, color: "turquesa", accessories: app.accessories });
    else setApp({ ...app, cls, color: robot ? "pele4" : app.color, hair_style: app.hair_style ?? "curto", hair_color: app.hair_color ?? "castanho" });
  };
  const toggleAcc = (id: string) => {
    sfx("click");
    const has = app.accessories.includes(id);
    if (!has && app.accessories.length >= cat.max_accessories) return;
    setApp({ ...app, accessories: has ? app.accessories.filter((x) => x !== id) : [...app.accessories, id] });
  };
  const toggleTool = (id: string) => {
    sfx("tool");
    setTools((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length >= cat.tools_to_pick ? t : [...t, id]));
  };

  async function finish() {
    unlockAudioOnGesture();
    setBusy(true);
    setError("");
    try {
      await api.saveCharacter({ appearance: app, tools, scenario, world });
      await refresh();
      sfx("fanfare");
      nav("/jogar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para salvar.");
    } finally {
      setBusy(false);
    }
  }

  const canNext = step === 1 ? tools.length === cat.tools_to_pick : true;
  const skins = cat.skin_tones;

  return (
    <main className="page stack">
      <div className="row">
        <span className="chip teal">
          Etapa {step + 1} de {STEPS.length}
        </span>
        <span className="hint">{STEPS[step]}</span>
      </div>
      <div className="steps" role="list" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <span key={s} role="listitem" className={i < step ? "done" : i === step ? "cur" : ""} title={s}>
            <span className="sr-only">
              {s}
              {i < step ? " (feita)" : i === step ? " (atual)" : ""}
            </span>
          </span>
        ))}
      </div>
      <h2>
        {step + 1}. {["Crie o seu Edu", "Escolha as suas armas do saber", "Escolha o cenário", "Escolha o mundo encantado", "Prestem atenção, aventureiros!"][step]}
      </h2>

      <div className={`stage scn-${scenario} wld-${world}`} aria-hidden={step === 4}>
        {(SCN_EMOJI[scenario] ?? []).map((e, i) => (
          <span key={i} className="deco" style={[{ left: "7%", bottom: "8%" }, { right: "8%", top: "10%" }, { right: "9%", bottom: "8%" }][i]} aria-hidden="true">
            {e}
          </span>
        ))}
        <Edu appearance={app} size={step === 0 ? 150 : 120} label={`Seu Edu: ${cat.classes[app.cls]}`} />
        {step >= 1 && (
          <div style={{ position: "absolute", right: 10, top: 10, display: "flex", gap: 6, fontSize: "1.6rem" }}>
            {tools.map((t) => (
              <span key={t} title={cat.tools[t]}>
                {TOOL_EMOJI[t]}
              </span>
            ))}
          </div>
        )}
      </div>

      {step === 0 && (
        <div className="stack">
          <section className="card" aria-labelledby="h-class">
            <h3 id="h-class" className="card-title">Quem é o Edu?</h3>
            <p className="hint">Ele começa como robô, mas pode virar quem você quiser.</p>
            <div className="grid auto">
              {Object.entries(cat.classes).map(([id, name]) => (
                <button key={id} className="choice" aria-pressed={app.cls === id} onClick={() => setClass(id)}>
                  <div style={{ fontSize: "1.8rem" }}>{CLASS_EMOJI[id]}</div>
                  {name}
                </button>
              ))}
            </div>
          </section>
          <section className="card" aria-labelledby="h-color">
            <h3 id="h-color" className="card-title">{robot ? "Cor da armadura" : "Tom de pele"}</h3>
            <div className="row">
              {(robot ? cat.robot_colors : skins).map((c) => (
                <button
                  key={c}
                  className="swatch"
                  aria-pressed={app.color === c}
                  aria-label={robot ? c : `Tom ${c.replace("pele", "")}`}
                  style={{ background: robot ? robotHex(c) : skinHex(c) }}
                  onClick={() => {
                    sfx("click");
                    setApp({ ...app, color: c });
                  }}
                />
              ))}
            </div>
          </section>
          {!robot && (
            <section className="card" aria-labelledby="h-hair">
              <h3 id="h-hair" className="card-title">Cabelo</h3>
              <div className="row">
                {cat.hair_styles.map((h) => (
                  <button key={h} className="choice" aria-pressed={app.hair_style === h} onClick={() => setApp({ ...app, hair_style: h })}>
                    {h}
                  </button>
                ))}
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                {cat.hair_colors.map((h) => (
                  <button
                    key={h}
                    className="swatch"
                    aria-pressed={app.hair_color === h}
                    aria-label={`Cabelo ${h}`}
                    style={{ background: hairHex(h) }}
                    onClick={() => setApp({ ...app, hair_color: h })}
                  />
                ))}
              </div>
            </section>
          )}
          <section className="card" aria-labelledby="h-acc">
            <div className="card-head">
              <h3 id="h-acc" className="card-title">Acessórios</h3>
              <span className="chip">
                {app.accessories.length}/{cat.max_accessories}
              </span>
            </div>
            <div className="grid auto">
              {Object.entries(cat.accessories).map(([id, name]) => {
                const locked = cat.locked_accessories.includes(id) && !unlocked.includes(id);
                const full = !app.accessories.includes(id) && app.accessories.length >= cat.max_accessories;
                return (
                  <button key={id} className="choice" aria-pressed={app.accessories.includes(id)} disabled={locked || full} onClick={() => toggleAcc(id)}>
                    {locked ? "🔒 " : ""}
                    {name}
                    {locked && <div className="hint">Descubra o selo da Era 1</div>}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {step === 1 && (
        <section className="card stack" aria-labelledby="h-tools">
          <div className="card-head">
            <h3 id="h-tools" className="card-title">Armas do saber</h3>
            <span className={`chip${tools.length === cat.tools_to_pick ? " teal" : ""}`} aria-live="polite">
              {tools.length}/{cat.tools_to_pick} escolhidas
            </span>
          </div>
          <p>
            Escolha <strong>{cat.tools_to_pick} ferramentas</strong>. Cada uma pode ser usada uma vez por missão, durante uma pergunta.
          </p>
          <div className="grid cols-2">
            {Object.entries(cat.tools).map(([id, desc]) => (
              <button key={id} className="choice tool-card" aria-pressed={tools.includes(id)} onClick={() => toggleTool(id)} disabled={!tools.includes(id) && tools.length >= cat.tools_to_pick}>
                <span className="emoji">{TOOL_EMOJI[id]}</span>
                <span>{desc}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="grid auto">
          {Object.entries(cat.scenarios).map(([id, name]) => (
            <button key={id} className="choice" aria-pressed={scenario === id} onClick={() => { sfx("click"); setScenario(id); }}>
              <div style={{ fontSize: "1.8rem" }}>{SCN_EMOJI[id]?.[0]}</div>
              {name}
            </button>
          ))}
        </section>
      )}

      {step === 3 && (
        <section className="grid">
          {Object.entries(cat.worlds).map(([id, name]) => (
            <button key={id} className="choice" aria-pressed={world === id} onClick={() => { sfx("click"); setWorld(id); }}>
              <strong>{name}</strong>
              <div className="hint">{WLD_TEXT[id]}</div>
            </button>
          ))}
        </section>
      )}

      {step === 4 && (
        <section className="card stack" aria-labelledby="h-tutores">
          <h3 id="h-tutores" className="card-title">Recado dos tutores</h3>
          <p>
            Seu Edu está pronto e já entrou no mundo encantado. Agora o jogo depende de vocês: os tutores <strong>Hernandes</strong> e <strong>Emily</strong> vão explicar o
            conteúdo da aula.
          </p>
          <p>
            Prestem atenção em cada palavra. No final, o grupo precisa <strong>descobrir a frase secreta</strong> que abre a Era 1.
          </p>
          <p className="notice">ⓘ Quando os tutores abrirem a sala, você recebe um código de 6 letras.</p>
        </section>
      )}

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div className="row sticky-bottom">
        {step > 0 && (
          <button className="btn ghost" onClick={() => setStep(step - 1)}>
            Voltar
          </button>
        )}
        <span style={{ flex: 1 }} />
        {step < 4 ? (
          <button className="btn" disabled={!canNext} onClick={() => { sfx("click"); setStep(step + 1); }}>
            Próximo
          </button>
        ) : (
          <button className="btn big" disabled={busy} onClick={() => void finish()}>
            {busy ? "Salvando…" : "Entrar no mundo!"}
          </button>
        )}
      </div>
    </main>
  );
}
