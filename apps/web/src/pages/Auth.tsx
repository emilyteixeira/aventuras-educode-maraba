import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { sfx, unlockAudioOnGesture } from "../audio";
import { useSession } from "../session";

export default function Auth() {
  const { me, refresh } = useSession();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (me) return <Navigate to={me.role === "tutor" ? "/tutor" : me.onboarding_done ? "/jogar" : "/onboarding"} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    unlockAudioOnGesture();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await api.login({ email, password });
      else await api.register({ email, password, nickname, code });
      sfx("click");
      const m = await refresh();
      if (m) nav(m.role === "tutor" ? "/tutor" : m.onboarding_done ? "/jogar" : "/onboarding", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 520 }}>
      <div className="card stack">
        <h2>{mode === "login" ? "Entrar" : "Criar conta"}</h2>
        <div className="row" role="tablist" aria-label="Entrar ou criar conta">
          <button className="choice" role="tab" aria-selected={mode === "login"} aria-pressed={mode === "login"} onClick={() => setMode("login")} type="button">
            Já tenho conta
          </button>
          <button className="choice" role="tab" aria-selected={mode === "register"} aria-pressed={mode === "register"} onClick={() => setMode("register")} type="button">
            Criar conta
          </button>
        </div>
        <form className="stack" onSubmit={submit}>
          {mode === "register" && (
            <div>
              <label htmlFor="nick">Apelido de aventureiro</label>
              <input id="nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={16} autoComplete="nickname" required />
              <p className="hint">Esse nome aparece no ranking. Não use seu nome completo.</p>
            </div>
          )}
          <div>
            <label htmlFor="email">E-mail (Gmail)</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            {mode === "register" && <p className="hint">Seu e-mail nunca aparece para os colegas.</p>}
          </div>
          <div>
            <label htmlFor="pw">Senha</label>
            <input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 8 : undefined}
              required
            />
            {mode === "register" && <p className="hint">Mínimo de 8 caracteres. Anote em lugar seguro.</p>}
          </div>
          {mode === "register" && (
            <div>
              <label htmlFor="code">Código da turma</label>
              <input id="code" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" required />
              <p className="hint">Os tutores (Hernandes e Emily) dão o código na aula.</p>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="btn big" disabled={busy}>
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar e começar"}
          </button>
        </form>
      </div>
    </main>
  );
}
