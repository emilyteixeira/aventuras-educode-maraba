import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import StudentRecovery from "../components/StudentRecovery";

export default function TutorHome() {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState<{ code: string }[]>([]);

  function loadRooms() {
    void api.listSessions().then(setRooms).catch((err: Error) => setError(err.message));
  }
  useEffect(loadRooms, []);

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
      <h1>Painel dos tutores</h1>
      <p>Emily, Hernandes e Felipe · Pensamento Computacional</p>
      <div className="card stack">
        <div className="card-head">
          <h3 className="card-title">Nova aula</h3>
          <span className="chip teal">Era 1 · 5 missões</span>
        </div>
        <p>Crie uma sala para a aula. O PIN de 6 caracteres e o QR aparecem no painel. Os três tutores podem acompanhar a mesma sala.</p>
        <p className="notice">
          ⓘ Os alunos entram em <strong>{location.host}</strong> pelo PIN ou QR, sem e-mail nem senha.
        </p>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn big" onClick={() => void create()} disabled={busy}>
          Criar sala da Era 1
        </button>
      </div>
      <section className="card stack" aria-labelledby="open-rooms">
        <h3 className="card-title" id="open-rooms">Salas abertas</h3>
        <p className="hint">Para ajudar na aula, entre na sala que outro tutor já criou.</p>
        <button className="btn ghost" onClick={loadRooms}>Atualizar salas</button>
        {rooms.map((room) => <Link key={room.code} className="btn alt" to={`/sala/${room.code}`}>Acompanhar sala {room.code}</Link>)}
        {rooms.length === 0 && <p>Nenhuma sala aberta.</p>}
      </section>
      <StudentRecovery />
      <p className="hint">O jogo não depende do projetor: cada aluno vê pergunta, tempo e ranking no próprio aparelho.</p>
    </main>
  );
}
