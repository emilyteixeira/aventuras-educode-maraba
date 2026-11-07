import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import deck from "../slides/order.json";

// Slides estáticos da aula (Era 1). Notas do apresentador ficam fora do bundle público.
const files = import.meta.glob<string>("../slides/*.html", { query: "?raw", import: "default", eager: true });
const slides = deck.order.map((id) => ({ id, html: files[`../slides/${id}.html`] ?? "" }));
const W = 1920;
const H = 1080;
const PIN = /^[A-HJKMNP-Z2-9]{6}$/;

export default function Slides() {
  const [params, setParams] = useSearchParams();
  const sala = (params.get("sala") ?? "").toUpperCase();
  const pin = PIN.test(sala) ? sala : null;
  const n = slides.length;
  const initial = Math.min(Math.max(Number(location.hash.replace("#slide-", "")) || 1, 1), n) - 1;
  const [index, setIndex] = useState(initial);
  const [scale, setScale] = useState(1);
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<{ pin: Element | null; qr: Element | null }>({ pin: null, qr: null });

  const go = useCallback((i: number) => setIndex(Math.min(Math.max(i, 0), n - 1)), [n]);

  useEffect(() => {
    history.replaceState(null, "", `${location.pathname}${location.search}#slide-${index + 1}`);
  }, [index, pin]);

  useEffect(() => {
    const onHash = () => {
      const i = Number(location.hash.replace("#slide-", ""));
      if (i) go(i - 1);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [go]);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.altKey || e.ctrlKey || e.metaKey) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(index + 1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(index - 1); }
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(n - 1);
      else if (e.key.toLowerCase() === "f") void toggleFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, n]);

  // Encaixa PIN e QR reais no slide "Hora de jogar" (só quando a sala vem na URL).
  useLayoutEffect(() => {
    const root = stage.current;
    setSlots({ pin: root?.querySelector('[data-slot="pin"]') ?? null, qr: root?.querySelector('[data-slot="qr"]') ?? null });
  }, [index]);

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await frame.current?.requestFullscreen?.().catch(() => undefined);
  }

  const current = slides[index];
  const joinUrl = pin ? `${location.origin}/participar/${pin}` : `${location.origin}/entrar`;

  return (
    <main className="deck" aria-roledescription="apresentação" aria-label={deck.title}>
      <div className="deck-frame" ref={frame} onClick={(e) => go(index + (e.clientX > window.innerWidth / 3 ? 1 : -1))}>
        <div
          ref={stage}
          key={current.id}
          className="deck-stage"
          style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}
          aria-roledescription="slide"
          aria-label={`Slide ${index + 1} de ${n}`}
          dangerouslySetInnerHTML={{ __html: current.html }}
        />
        {slots.pin && createPortal(pin ?? "mostrado pelos tutores", slots.pin)}
        {slots.qr && createPortal(
          pin ? (
            <QRCodeSVG value={joinUrl} size={360} marginSize={4} level="M" role="img" aria-label={`QR para entrar na sala ${pin}`} />
          ) : (
            <p className="deck-qr-empty">Abra os slides pelo painel da sala para mostrar o QR.</p>
          ),
          slots.qr,
        )}
      </div>
      <nav className="deck-bar" aria-label="Controles dos slides">
        <button className="btn ghost small" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Slide anterior">◀</button>
        <span className="chip" aria-live="polite">{index + 1} / {n}</span>
        <button className="btn ghost small" onClick={() => go(index + 1)} disabled={index === n - 1} aria-label="Próximo slide">▶</button>
        <button className="btn ghost small" onClick={() => void toggleFullscreen()}>Tela cheia (F)</button>
        {pin ? (
          <span className="chip teal">Sala {pin}</span>
        ) : (
          <button className="btn ghost small" onClick={() => {
            const v = prompt("PIN da sala (6 caracteres)")?.trim().toUpperCase();
            if (v && PIN.test(v)) setParams({ sala: v }, { replace: true });
          }}>Informar PIN</button>
        )}
        <Link className="btn ghost small" to={pin ? `/sala/${pin}` : "/"}>Fechar</Link>
      </nav>
    </main>
  );
}
