import { Link, Navigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import StudentGame from "../components/StudentGame";
import TutorPanel from "../components/TutorPanel";
import { useGameSocket } from "../useGameSocket";
import { useSession } from "../session";

export default function Room() {
  const { code = "" } = useParams();
  const { state, online, fatal, toast, send, receivedAt } = useGameSocket(code.toUpperCase());
  const { refresh } = useSession();
  useEffect(() => {
    if (fatal === "unauth") void refresh();
  }, [fatal, refresh]);

  if (fatal === "unauth") return <Navigate to={`/participar/${code}`} replace />;
  if (fatal === "onboarding") return <Navigate to={`/onboarding?sala=${code}`} replace />;
  if (fatal === "notfound" || fatal === "forbidden")
    return (
      <main className="page center stack" style={{ maxWidth: 560 }}>
        <div className="card stack">
          <h2>{fatal === "notfound" ? "Sala não encontrada" : "Acesso negado"}</h2>
          <p className="error">✖ Confira o código com os tutores.</p>
          <p>
            <Link className="btn" to="/jogar">Voltar</Link>
          </p>
        </div>
      </main>
    );
  if (!state)
    return (
      <main className="page center">
        <p className="notice" role="status">{online ? "Entrando na sala…" : "Conectando…"}</p>
      </main>
    );
  return (
    <>
      {!online && (
        <div className="toast" role="status">
          Reconectando… seus pontos estão guardados.
        </div>
      )}
      {toast && (
        <div className="toast" role="alert">
          {toast}
        </div>
      )}
      {state.role === "tutor" ? <TutorPanel s={state} send={send} receivedAt={receivedAt} /> : <StudentGame s={state} send={send} receivedAt={receivedAt} />}
    </>
  );
}
