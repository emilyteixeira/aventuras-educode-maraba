import { lazy, Suspense, type ReactElement } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SessionProvider, useSession } from "./session";
import Auth from "./pages/Auth";
import Join from "./pages/Join";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Room from "./pages/Room";
import TutorHome from "./pages/TutorHome";

// Vitrine do design system: só existe em desenvolvimento (fora do build de produção).
const Design = import.meta.env.DEV ? lazy(() => import("./pages/Design")) : null;

function TopBar() {
  const { me, logout, music, toggleMusic, calm, setCalm, sound, setSound } = useSession();
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        ✦ <span className="lbl">Aventuras do Edu</span>
      </Link>
      <span className="spacer" />
      <button className="btn ghost small" aria-pressed={music} aria-label="Música ambiente" onClick={toggleMusic} title="Música ambiente">
        🎵<span className="lbl"> {music ? "Música ligada" : "Música"}</span>
      </button>
      <button className="btn ghost small" aria-pressed={sound} aria-label="Efeitos sonoros" onClick={() => setSound(!sound)} title="Efeitos sonoros">
        {sound ? "🔊" : "🔇"}<span className="lbl"> Sons</span>
      </button>
      <button className="btn ghost small" aria-pressed={calm} aria-label="Modo calmo (menos animações)" onClick={() => setCalm(!calm)} title="Reduz animações">
        🌙<span className="lbl"> {calm ? "Modo calmo" : "Calmo"}</span>
      </button>
      {me && (
        <>
          <span className="chip nick">
            {me.nickname} · nv {me.level}
          </span>
          <button className="btn ghost small" onClick={() => void logout()}>
            Sair
          </button>
        </>
      )}
    </header>
  );
}

function Guard({ children, tutor }: { children: ReactElement; tutor?: boolean }) {
  const { me, loading } = useSession();
  const loc = useLocation();
  if (loading) return <main className="page center">Carregando…</main>;
  if (!me) return <Navigate to="/entrar" state={{ from: loc.pathname }} replace />;
  if (tutor && me.role !== "tutor") return <Navigate to="/jogar" replace />;
  return children;
}

export default function App() {
  return (
    <SessionProvider>
      <div className="app">
        <a href="#main" className="sr-only">
          Ir para o conteúdo
        </a>
        <TopBar />
        <div id="main">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/entrar" element={<Auth />} />
            <Route path="/onboarding" element={<Guard><Onboarding /></Guard>} />
            <Route path="/jogar" element={<Guard><Join /></Guard>} />
            <Route path="/tutor" element={<Guard tutor><TutorHome /></Guard>} />
            <Route path="/sala/:code" element={<Guard><Room /></Guard>} />
            {Design && <Route path="/design" element={<Suspense fallback={null}><Design /></Suspense>} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </SessionProvider>
  );
}
