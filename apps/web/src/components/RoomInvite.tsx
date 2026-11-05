import { QRCodeSVG } from "qrcode.react";
import { useId, useState } from "react";

export default function RoomInvite({ code }: { code: string }) {
  const url = `${location.origin}/participar/${encodeURIComponent(code)}`;
  const id = useId();
  const [message, setMessage] = useState("");
  return (
    <section className="stack room-invite" aria-label="Convite dos alunos">
      <p>Alunos: abram o QR ou acessem <strong>{location.host}</strong> e informem o PIN. Sem e-mail nem senha.</p>
      <div className="code-big" aria-label={`PIN da sala ${code.split("").join(" ")}`}>{code}</div>
      <QRCodeSVG value={url} size={192} marginSize={4} level="M" role="img" aria-label={`QR para entrar na sala ${code}`} className="room-qr" />
      <label htmlFor={id}>Link de entrada dos alunos</label>
      <input id={id} value={url} readOnly onFocus={(e) => e.target.select()} />
      <button className="btn ghost" type="button" onClick={() => {
        void navigator.clipboard?.writeText(url).then(
          () => setMessage("Link copiado."),
          () => setMessage("Selecione o link acima e copie manualmente."),
        );
        if (!navigator.clipboard) setMessage("Selecione o link acima e copie manualmente.");
      }}>Copiar link dos alunos</button>
      <p className="hint" role="status">{message}</p>
    </section>
  );
}
