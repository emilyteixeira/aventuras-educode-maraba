import { Link } from "react-router-dom";
import Edu from "../components/Edu";
import { unlockAudioOnGesture } from "../audio";
import { useSession } from "../session";

export default function Landing() {
  const { me } = useSession();
  const next = me ? (me.role === "tutor" ? "/tutor" : me.onboarding_done ? "/jogar" : "/onboarding") : "/entrar";
  return (
    <main className="page center stack">
      <section className="title-screen">
        <h1 className="title-logo">
          Aventuras <span className="accent">do Edu</span>
        </h1>
        <p className="tagline">Era 1 · Pensamento Computacional</p>
      </section>
      <div className="stage scn-floresta wld-luzes" style={{ minHeight: 280 }}>
        <span className="deco" style={{ left: "8%", top: "12%" }} aria-hidden="true">✦</span>
        <span className="deco" style={{ right: "10%", top: "18%" }} aria-hidden="true">🌙</span>
        <span className="deco" style={{ left: "14%", bottom: "10%" }} aria-hidden="true">🌲</span>
        <span className="deco" style={{ right: "14%", bottom: "10%" }} aria-hidden="true">🌲</span>
        <Edu appearance={null} size={150} label="Edu, o robô explorador" />
      </div>
      <p style={{ maxWidth: 560, margin: "16px auto 0" }}>
        Um vale misterioso guarda um selo antigo. Só quem pensa como um programador consegue abrir. Monte o seu Edu, junte o seu grupo e
        descubra o segredo da Era 1.
      </p>
      <p>
        <Link className="btn big" to={next} onClick={unlockAudioOnGesture}>
          <span className="caret blink" aria-hidden="true">▶</span> {me ? "Continuar a aventura" : "Começar"}
        </Link>
      </p>
      <p className="stats-line">5 missões · 20 desafios · 1 selo secreto</p>
      <p className="hint">Curso de extensão EduCode Marabá · Tutores Hernandes e Emily</p>
    </main>
  );
}
