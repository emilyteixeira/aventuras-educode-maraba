import type { Appearance } from "../types";

// Edu em pixel art (SVG). Grade de 30×40 "pixels" de 4 unidades (viewBox 120×160).
// Ids vêm do catálogo do servidor (apps/api/app/catalog.py).
const SKIN: Record<string, string> = {
  pele1: "#fde3cf", pele2: "#f8d2b4", pele3: "#f1bf98", pele4: "#e3a97a",
  pele5: "#d39565", pele6: "#c08052", pele7: "#a96b3f", pele8: "#8d5530",
  pele9: "#74421f", pele10: "#5f3418", pele11: "#4a2811", pele12: "#391e0d",
};
const ROBOT: Record<string, string> = {
  turquesa: "#4fd1c5", coral: "#ff7f6e", amarelo: "#f6c453", prata: "#b8c2d4", violeta: "#9f7aea", verde: "#68d391",
};
const HAIR: Record<string, string> = {
  preto: "#1c1c26", castanho: "#6b4226", loiro: "#e8c56a", ruivo: "#c4542d", azul: "#3b82f6", rosa: "#ec4899",
};
const OUTFIT: Record<string, { main: string; trim: string }> = {
  heroi: { main: "#3b82f6", trim: "#f6c453" },
  paladino: { main: "#9aa7bd", trim: "#f6c453" },
  mago: { main: "#7c3aed", trim: "#fcd34d" },
  exploradora: { main: "#2f855a", trim: "#e9d8a6" },
};
const OUTLINE = "#07060b";

export const skinHex = (id: string) => SKIN[id] ?? "#f1bf98";
export const robotHex = (id: string) => ROBOT[id] ?? "#4fd1c5";
export const hairHex = (id: string) => HAIR[id] ?? "#1c1c26";

const U = 4;

/** Retângulo com cantos "mordidos" (1 pixel), como em sprite de 16 bits. */
function notched(x: number, y: number, w: number, h: number) {
  return `M${(x + 1) * U} ${y * U}h${(w - 2) * U}v${U}h${U}v${(h - 2) * U}h${-U}v${U}h${-(w - 2) * U}v${-U}h${-U}v${-(h - 2) * U}h${U}z`;
}

/** Bloco de pixels. `o` desenha contorno escuro de 1 pixel; `n` morde os cantos. */
function B({ x, y, w, h, f, o, n, className }: { x: number; y: number; w: number; h: number; f: string; o?: boolean; n?: boolean; className?: string }) {
  const shape = (xx: number, yy: number, ww: number, hh: number, fill: string, cls?: string) =>
    n || o ? <path d={notched(xx, yy, ww, hh)} fill={fill} className={cls} /> : <rect x={xx * U} y={yy * U} width={ww * U} height={hh * U} fill={fill} className={cls} />;
  return (
    <>
      {o && shape(x - 1, y - 1, w + 2, h + 2, OUTLINE)}
      {shape(x, y, w, h, f, className)}
    </>
  );
}

function Hair({ style, color }: { style: string; color: string }) {
  const c = color;
  const cap = (
    <>
      <B x={7} y={5} w={16} h={4} f={c} n />
      <B x={7} y={8} w={2} h={4} f={c} />
      <B x={21} y={8} w={2} h={4} f={c} />
      <B x={11} y={8} w={5} h={1} f={c} />
    </>
  );
  switch (style) {
    case "curto":
      return cap;
    case "longo":
      return (
        <>
          {cap}
          <B x={6} y={9} w={3} h={13} f={c} />
          <B x={21} y={9} w={3} h={13} f={c} />
        </>
      );
    case "cacheado":
      return (
        <>
          {[7, 11, 15, 19].map((x, i) => (
            <B key={x} x={x} y={i % 3 ? 3 : 4} w={4} h={4} f={c} n />
          ))}
          <B x={7} y={6} w={16} h={3} f={c} />
          <B x={6} y={8} w={3} h={6} f={c} n />
          <B x={21} y={8} w={3} h={6} f={c} n />
        </>
      );
    case "coque":
      return (
        <>
          <B x={12} y={1} w={6} h={5} f={c} n />
          {cap}
        </>
      );
    case "moicano":
      return (
        <>
          <B x={14} y={0} w={2} h={1} f={c} />
          <B x={13} y={1} w={4} h={7} f={c} />
        </>
      );
    default:
      return null;
  }
}

function Accessory({ id, robot }: { id: string; robot: boolean }) {
  const eyeY = robot ? 10 : 11;
  switch (id) {
    case "oculos":
      return (
        <g>
          {[10, 16].map((x) => (
            <g key={x}>
              <rect x={x * U} y={eyeY * U} width={4 * U} height={5 * U} fill="#ffffff40" stroke="#1a1a22" strokeWidth={U / 2} />
            </g>
          ))}
          <B x={14} y={eyeY + 2} w={2} h={1} f="#1a1a22" />
        </g>
      );
    case "chapeu":
      return (
        <>
          <B x={9} y={1} w={12} h={5} f="#ca8a04" o n />
          <B x={9} y={4} w={12} h={1} f="#7c2d12" />
          <B x={5} y={6} w={20} h={2} f="#a16207" o />
        </>
      );
    case "coroa":
      return (
        <>
          <B x={9} y={2} w={2} h={3} f="#f6c453" />
          <B x={14} y={1} w={2} h={4} f="#f6c453" />
          <B x={19} y={2} w={2} h={3} f="#f6c453" />
          <B x={9} y={4} w={12} h={3} f="#f6c453" o />
          <B x={14} y={5} w={2} h={1} f="#ff7f9e" />
          <B x={10} y={5} w={1} h={1} f="#4fd1c5" />
          <B x={19} y={5} w={1} h={1} f="#4fd1c5" />
        </>
      );
    default:
      return null;
  }
}

function Back({ id }: { id: string }) {
  const cape = (f: string) => (
    <>
      <B x={8} y={20} w={14} h={6} f={f} />
      <B x={7} y={26} w={16} h={6} f={f} />
      <B x={6} y={32} w={18} h={6} f={f} />
    </>
  );
  if (id === "capa") return cape("#dc2626");
  if (id === "capa_cartografo")
    return (
      <>
        {cape("#5b21b6")}
        <B x={6} y={37} w={18} h={1} f="#f6c453" />
        <B x={14} y={29} w={2} h={4} f="#f6c453" />
        <B x={13} y={30} w={4} h={2} f="#f6c453" />
      </>
    );
  if (id === "mochila") return <B x={21} y={20} w={6} h={9} f="#b45309" o n />;
  return null;
}

function Robot({ body }: { body: string }) {
  return (
    <>
      <B x={14} y={3} w={2} h={4} f="#f6c453" />
      <B x={13} y={0} w={4} h={3} f="#f6c453" o n className="edu-led" />
      <B x={5} y={21} w={3} h={8} f={body} o />
      <B x={22} y={21} w={3} h={8} f={body} o />
      <B x={10} y={30} w={4} h={6} f="#475569" />
      <B x={16} y={30} w={4} h={6} f="#475569" />
      <B x={9} y={36} w={5} h={2} f="#334155" o />
      <B x={16} y={36} w={5} h={2} f="#334155" o />
      <B x={8} y={20} w={14} h={10} f={body} o />
      <B x={8} y={28} w={14} h={2} f="#0003" />
      <B x={11} y={23} w={8} h={4} f="#0f172a" />
      <B x={12} y={24} w={2} h={2} f="#4fd1c5" />
      <B x={16} y={24} w={2} h={2} f="#f6c453" />
      <B x={7} y={7} w={16} h={12} f={body} o />
      <B x={7} y={7} w={16} h={1} f="#ffffff44" />
      <B x={9} y={10} w={12} h={6} f="#0f172a" n />
      <B x={11} y={11} w={3} h={4} f="#67e8f9" className="edu-eye" />
      <B x={16} y={11} w={3} h={4} f="#67e8f9" className="edu-eye" />
      <B x={12} y={17} w={6} h={1} f="#0004" />
    </>
  );
}

function Human({ a, skin }: { a: Partial<Appearance>; skin: string }) {
  const o = OUTFIT[a.cls ?? ""] ?? OUTFIT.heroi;
  return (
    <>
      <B x={10} y={31} w={4} h={5} f="#334155" />
      <B x={16} y={31} w={4} h={5} f="#334155" />
      <B x={9} y={36} w={5} h={2} f="#1e293b" o />
      <B x={16} y={36} w={5} h={2} f="#1e293b" o />
      <B x={6} y={21} w={3} h={8} f={o.main} o />
      <B x={21} y={21} w={3} h={8} f={o.main} o />
      <B x={6} y={29} w={3} h={2} f={skin} />
      <B x={21} y={29} w={3} h={2} f={skin} />
      <B x={9} y={20} w={12} h={12} f={o.main} o />
      <B x={9} y={28} w={12} h={2} f={o.trim} />
      {a.cls === "heroi" && (
        <>
          <B x={14} y={22} w={2} h={4} f={o.trim} />
          <B x={13} y={23} w={4} h={2} f={o.trim} />
        </>
      )}
      {a.cls === "paladino" && (
        <>
          <B x={5} y={19} w={5} h={3} f="#cbd5e1" o />
          <B x={20} y={19} w={5} h={3} f="#cbd5e1" o />
          <B x={13} y={22} w={4} h={4} f="#f6c453" n />
        </>
      )}
      {a.cls === "exploradora" && <B x={10} y={19} w={10} h={2} f="#dd6b20" o />}
      <B x={8} y={7} w={14} h={13} f={skin} o />
      <B x={11} y={12} w={2} h={3} f="#1c1c26" className="edu-eye" />
      <B x={17} y={12} w={2} h={3} f="#1c1c26" className="edu-eye" />
      <B x={9} y={15} w={2} h={1} f="#ff7f6e88" />
      <B x={19} y={15} w={2} h={1} f="#ff7f6e88" />
      <B x={12} y={16} w={1} h={1} f="#7c2d12" />
      <B x={13} y={17} w={4} h={1} f="#7c2d12" />
      <B x={17} y={16} w={1} h={1} f="#7c2d12" />
      <Hair style={a.hair_style ?? "curto"} color={hairHex(a.hair_color ?? "preto")} />
      {a.cls === "mago" && (
        <>
          <B x={14} y={-5} w={2} h={2} f="#7c3aed" />
          <B x={12} y={-3} w={6} h={3} f="#7c3aed" />
          <B x={10} y={0} w={10} h={3} f="#7c3aed" />
          <B x={8} y={3} w={14} h={3} f="#7c3aed" />
          <B x={14} y={1} w={2} h={2} f="#fcd34d" />
          <B x={5} y={6} w={20} h={2} f="#5b21b6" o />
        </>
      )}
      {a.cls === "heroi" && <B x={8} y={10} w={14} h={2} f="#dc2626" />}
      {a.cls === "paladino" && (
        <>
          <B x={7} y={4} w={16} h={6} f="#cbd5e1" o n />
          <B x={7} y={8} w={16} h={1} f="#64748b" />
          <B x={14} y={2} w={2} h={2} f="#f6c453" />
        </>
      )}
      {a.cls === "exploradora" && <B x={8} y={10} w={14} h={2} f="#dd6b20" />}
    </>
  );
}

interface Props {
  appearance: Partial<Appearance> | null | undefined;
  size?: number;
  animate?: boolean;
  label?: string;
}

export default function Edu({ appearance, size = 120, animate = true, label }: Props) {
  const a: Partial<Appearance> = appearance && appearance.cls ? appearance : { cls: "robo", color: "turquesa", accessories: [] };
  const acc = a.accessories ?? [];
  const robot = a.cls === "robo";
  const front = acc.filter((x) => ["oculos", "chapeu", "coroa"].includes(x));
  const back = acc.filter((x) => ["capa", "capa_cartografo", "mochila"].includes(x));
  return (
    <svg
      className={animate ? "edu edu-idle" : "edu"}
      viewBox="0 0 120 160"
      width={size}
      height={(size * 160) / 120}
      shapeRendering="crispEdges"
      {...(label === "" ? { "aria-hidden": true } : { role: "img", "aria-label": label ?? "Edu" })}
    >
      {back.map((id) => (
        <Back key={id} id={id} />
      ))}
      {robot ? <Robot body={robotHex(a.color ?? "")} /> : <Human a={a} skin={skinHex(a.color ?? "")} />}
      {front.map((id) => (
        <Accessory key={id} id={id} robot={robot} />
      ))}
    </svg>
  );
}
