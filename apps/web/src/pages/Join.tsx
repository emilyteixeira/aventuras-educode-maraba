import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { sfx, unlockAudioOnGesture } from "../audio";
import Edu from "../components/Edu";
import { useSession } from "../session";

export default function Join() {
  const { me } = useSession();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    unlockAudioOnGesture();
    setBusy(true);
    setError("");
    try {
      const c = code.trim().toUpperCase();
      await api.checkSession(c);
      sfx("fanfare");
      nav(`/sala/${c}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sala não encontrada.");
    } finally {
      setBusy(false);
    }
  }

  if (me && !me.onboarding_done && me.role === "student") {
    return (
      <main className="page center stack" style={{ maxWidth: 560 }}>
        <div className="card stack">
          <Edu appearance={null} size={120} label="" />
          <h2>Falta montar o seu Edu</h2>
          <p className="hint">Leva uns 2 minutos: aparência, armas do saber, cenário e mundo.</p>
          <p>
            <Link className="btn big" to="/onboarding">Montar agora</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page center stack" style={{ maxWidth: 560 }}>
      <Edu appearance={me?.character?.appearance} size={150} label="O seu Edu" />
      <h2>Pronto para a aventura, {me?.nickname}?</h2>
      <form className="card stack" onSubmit={submit} aria-labelledby="h-join">
        <h3 id="h-join" className="card-title">Entrar na sala</h3>
        <label htmlFor="code">Código da sala (6 letras)</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          className="code-input"
          aria-describedby="code-hint"
          required
        />
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <p id="code-hint" className="hint">
          O código aparece no painel dos tutores. <span className="desk-only">Depois de digitar, aperte <kbd>Enter</kbd>.</span>
        </p>
        <button className="btn big" disabled={busy || code.trim().length < 6}>
          Entrar na sala
        </button>
      </form>
      <p>
        <Link className="btn ghost" to="/onboarding">Editar meu Edu</Link>
      </p>
    </main>
  );
}
