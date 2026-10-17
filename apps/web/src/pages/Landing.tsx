import { Link } from "react-router-dom";
import Edu from "../components/Edu";
import { unlockAudioOnGesture } from "../audio";
import { useSession } from "../session";

export default function Landing() {
  const { me } = useSession();
  const next = me ? (me.role === "tutor" ? "/tutor" : me.onboarding_done ? "/jogar" : "/onboarding") : "/entrar";
  return (
    <main className="page center stack">
      <div className="stage scn-floresta wld-luzes" style={{ minHeight: 320 }}>
        <span className="deco" style={{ left: "8%", top: "12%" }} aria-hidden="true">✦</span>
        <span className="deco" style={{ right: "10%", top: "18%" }} aria-hidden="true">🌙</span>
        <span className="deco" style={{ left: "14%", bottom: "10%" }} aria-hidden="true">🌲</span>
        <span className="deco" style={{ right: "14%", bottom: "10%" }} aria-hidden="true">🌲</span>
        <Edu appearance={null} size={170} label="Edu, o robô explorador" />
      </div>
      <h1>Aventuras do Edu</h1>
      <p style={{ maxWidth: 560, margin: "0 auto" }}>
        Um vale misterioso guarda um selo antigo. Só quem pensa como um programador consegue abrir. Monte o seu Edu, junte o seu grupo e
        descubra o segredo da Era 1.
      </p>
      <p>
        <Link className="btn big" to={next} onClick={unlockAudioOnGesture}>
          {me ? "Continuar a aventura" : "Começar"}
        </Link>
      </p>
      <p className="hint">Curso de extensão EduCode Marabá · Tutores Hernandes e Emily</p>
    </main>
  );
}
