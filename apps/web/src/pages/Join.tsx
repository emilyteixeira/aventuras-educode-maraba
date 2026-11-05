import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { unlockAudioOnGesture } from "../audio";
import { useSession } from "../session";

export default function Join() {
  const { me, refresh, loading } = useSession();
  const nav = useNavigate();
  const params = useParams();
  const [query] = useSearchParams();
  const [code, setCode] = useState(() => params.code ?? query.get("sala") ?? me?.room_code ?? "");
  const [nickname, setNickname] = useState("");
  const [recovery, setRecovery] = useState("");
  const [recover, setRecover] = useState(false);
  const [personal, setPersonal] = useState<string | null>(null);
  const [joinedRoom, setJoinedRoom] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function continueTo(room: string) {
    const profile = await refresh();
    if (!profile) throw new Error("Não foi possível abrir sua sessão. Tente novamente.");
    setPersonal(null);
    nav(profile.onboarding_done ? `/sala/${room}` : `/onboarding?sala=${room}`);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    unlockAudioOnGesture();
    setError("");
    setBusy(true);
    try {
      const pin = (code || me?.room_code || "").trim().toUpperCase();
      const result = await api.studentJoin({
        code: pin,
        ...(recover ? { recovery_code: recovery } : me ? {} : { nickname }),
      });
      setJoinedRoom(result.room_code);
      if (result.personal_code) setPersonal(result.personal_code);
      else await continueTo(result.room_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="page center">Carregando…</main>;
  if (me?.role === "tutor") return (
    <main className="page center stack">
      <h2>Você está no perfil de tutor</h2>
      <Link className="btn" to="/tutor">Abrir painel dos tutores</Link>
      <p className="hint">Para entrar como aluno neste aparelho, saia da conta de tutor.</p>
    </main>
  );

  return (
    <main className="page stack" style={{ maxWidth: 560 }}>
      <h1>Entrar na aventura</h1>
      <p>Era 1 · Pensamento Computacional</p>
      {personal ? (
        <section className="card stack" aria-labelledby="personal-title">
          <h2 id="personal-title" className="card-title">Guarde seu código pessoal</h2>
          <p>Ele recupera seu Edu e seus pontos em outro aparelho. Anote em um lugar seguro: ele só aparece agora.</p>
          <output className="personal-code" aria-label="Código pessoal">{personal}</output>
          <p className="notice">Não compartilhe com colegas. Este código é privado e não é o PIN da sala. Se perder, peça ajuda a um tutor.</p>
          <button className="btn big" disabled={busy} onClick={() => {
            setBusy(true);
            void continueTo(joinedRoom).catch((err: Error) => setError(err.message)).finally(() => setBusy(false));
          }}>Guardei meu código · continuar</button>
        </section>
      ) : (
        <form className="card stack" onSubmit={submit}>
          <h2 className="card-title">{me ? `Continuar como ${me.nickname}` : recover ? "Recuperar meu Edu" : "PIN e apelido"}</h2>
          <div>
            <label htmlFor="room-pin">PIN da sala (6 caracteres)</label>
            <input id="room-pin" className="code-input" value={code || me?.room_code || ""} onChange={(e) => setCode(e.target.value.toUpperCase())}
              minLength={6} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} required aria-describedby="pin-hint" />
            <p id="pin-hint" className="hint">Copie o PIN ou abra o QR mostrado por Emily, Hernandes ou Felipe.</p>
          </div>
          {!me && !recover && <div>
            <label htmlFor="student-nick">Apelido de aventureiro</label>
            <input id="student-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} minLength={2} maxLength={16} autoComplete="off" required />
            <p className="hint">Não use nome completo. Se você já tem um Edu, recupere-o abaixo para manter seu progresso.</p>
          </div>}
          {recover && <div>
            <label htmlFor="personal-input">Código pessoal do aluno</label>
            <input id="personal-input" type="password" value={recovery} onChange={(e) => setRecovery(e.target.value)} maxLength={32} autoComplete="off" spellCheck={false} required />
            <p className="hint">Use os 16 caracteres do seu cartão, nunca o e-mail. Sem o cartão, peça ajuda a um tutor.</p>
          </div>}
          <button className="btn big" disabled={busy}>{busy ? "Entrando…" : recover ? "Recuperar e entrar" : "Entrar na sala"}</button>
          {!me && <button className="btn ghost" type="button" onClick={() => { setRecover(!recover); setError(""); setRecovery(""); }}>
            {recover ? "Sou novo · criar meu Edu" : "Já tenho Edu · recuperar"}
          </button>}
          <p className="hint">Alunos não precisam de e-mail nem senha. As autorizações para a atividade são organizadas pelos professores fora da plataforma.</p>
        </form>
      )}
      {error && <div className="error" role="alert">{error}</div>}
      <Link className="btn ghost" to="/professor">Sou professor ou tutor</Link>
    </main>
  );
}
