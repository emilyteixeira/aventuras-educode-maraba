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
        <p>
          Crie uma sala para a aula. Os alunos entram em <strong>{location.host}</strong>, fazem login e digitam o código de 6 letras.
        </p>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn big" onClick={() => void create()} disabled={busy}>
          Criar sala da Era 1
        </button>
      </div>
    </main>
  );
}
