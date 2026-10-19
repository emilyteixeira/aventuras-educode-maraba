import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function TutorHome() {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const { code } = await api.createSession();
      nav(`/sala/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar a sala.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page stack" style={{ maxWidth: 640 }}>
      <h2>Painel dos tutores</h2>
      <div className="card stack">
        <div className="card-head">
          <h3 className="card-title">Nova aula</h3>
          <span className="chip teal">Era 1 · 5 missões</span>
        </div>
        <p>Crie uma sala para a aula. O código de 6 letras aparece em tela cheia para os alunos copiarem.</p>
        <p className="notice">
          ⓘ Os alunos entram em <strong>{location.host}</strong>, fazem login e digitam o código.
        </p>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn big" onClick={() => void create()} disabled={busy}>
          Criar sala da Era 1
        </button>
      </div>
      <p className="hint">O jogo não depende do projetor: cada aluno vê pergunta, tempo e ranking no próprio aparelho.</p>
    </main>
  );
}
