import type { Appearance } from "../types";

// Edu em camadas SVG. Ids vêm do catálogo do servidor (apps/api/app/catalog.py).
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

export const skinHex = (id: string) => SKIN[id] ?? "#f1bf98";
export const robotHex = (id: string) => ROBOT[id] ?? "#4fd1c5";
export const hairHex = (id: string) => HAIR[id] ?? "#1c1c26";

function Hair({ style, color, top }: { style: string; color: string; top: number }) {
  const c = color;
  switch (style) {
    case "curto":
      return <path d={`M34 ${top + 24} Q34 ${top - 2} 60 ${top - 2} Q86 ${top - 2} 86 ${top + 24} Q76 ${top + 8} 60 ${top + 8} Q44 ${top + 8} 34 ${top + 24}Z`} fill={c} />;
    case "longo":
      return (
        <g fill={c}>
          <path d={`M33 ${top + 26} Q33 ${top - 3} 60 ${top - 3} Q87 ${top - 3} 87 ${top + 26} Q76 ${top + 8} 60 ${top + 8} Q44 ${top + 8} 33 ${top + 26}Z`} />
          <rect x="31" y={top + 14} width="9" height="46" rx="4" />
          <rect x="80" y={top + 14} width="9" height="46" rx="4" />
        </g>
      );
    case "cacheado":
      return (
        <g fill={c}>
          {[38, 49, 60, 71, 82].map((x, i) => (
            <circle key={x} cx={x} cy={top + (i % 2 ? 4 : 8)} r="11" />
          ))}
          <circle cx="33" cy={top + 22} r="7" />
          <circle cx="87" cy={top + 22} r="7" />
        </g>
      );
    case "coque":
      return (
        <g fill={c}>
          <circle cx="60" cy={top - 8} r="9" />
          <path d={`M34 ${top + 24} Q34 ${top - 2} 60 ${top - 2} Q86 ${top - 2} 86 ${top + 24} Q76 ${top + 8} 60 ${top + 8} Q44 ${top + 8} 34 ${top + 24}Z`} />
        </g>
      );
    case "moicano":
      return <path d={`M52 ${top + 4} L56 ${top - 14} L60 ${top - 2} L64 ${top - 16} L68 ${top + 4}Z`} fill={c} />;
    default:
      return null;
  }
}

function Accessory({ id, robot, top }: { id: string; robot: boolean; top: number }) {
  const eyeY = robot ? 48 : 56;
  switch (id) {
    case "oculos":
      return (
        <g fill="none" stroke="#222" strokeWidth="2.5">
          <circle cx="50" cy={eyeY} r="7" fill="#ffffff55" />
          <circle cx="70" cy={eyeY} r="7" fill="#ffffff55" />
          <path d={`M57 ${eyeY}h6`} />
        </g>
      );
    case "chapeu":
      return (
        <g>
          <ellipse cx="60" cy={top + 4} rx="34" ry="7" fill="#a16207" />
          <path d={`M42 ${top + 4} Q42 ${top - 20} 60 ${top - 20} Q78 ${top - 20} 78 ${top + 4}Z`} fill="#ca8a04" />
          <rect x="42" y={top - 4} width="36" height="5" fill="#7c2d12" />
        </g>
      );
    case "coroa":
      return <path d={`M40 ${top + 6} L44 ${top - 12} L52 ${top - 2} L60 ${top - 16} L68 ${top - 2} L76 ${top - 12} L80 ${top + 6}Z`} fill="#f6c453" stroke="#b7791f" strokeWidth="2" />;
    default:
      return null;
  }
}

function Back({ id }: { id: string }) {
  if (id === "capa")
    return <path d="M36 82 L84 82 L96 148 L24 148Z" fill="#dc2626" />;
  if (id === "capa_cartografo")
    return (
      <g>
        <path d="M36 82 L84 82 L98 150 L22 150Z" fill="#5b21b6" />
        <path d="M22 150 L98 150 L96 144 L24 144Z" fill="#f6c453" />
        <text x="60" y="124" textAnchor="middle" fontSize="16" fill="#f6c453">★</text>
      </g>
    );
  if (id === "mochila") return <rect x="78" y="86" width="22" height="34" rx="8" fill="#b45309" stroke="#78350f" strokeWidth="2" />;
  return null;
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
  const top = robot ? 28 : 30;
  const o = OUTFIT[a.cls ?? ""] ?? OUTFIT.heroi;
  const skin = skinHex(a.color ?? "");
  const body = robotHex(a.color ?? "");
  const front = acc.filter((x) => ["oculos", "chapeu", "coroa"].includes(x));
  const back = acc.filter((x) => ["capa", "capa_cartografo", "mochila"].includes(x));
  return (
    <svg
      className={animate ? "edu edu-idle" : "edu"}
      viewBox="0 0 120 160"
      width={size}
      height={(size * 160) / 120}
      {...(label === "" ? { "aria-hidden": true } : { role: "img", "aria-label": label ?? "Edu" })}
    >
      {back.map((id) => (
        <Back key={id} id={id} />
      ))}
      {robot ? (
        <g>
          <line x1="60" y1="28" x2="60" y2="14" stroke="#f6c453" strokeWidth="3" />
          <circle cx="60" cy="11" r="5" fill="#f6c453" className="edu-led" />
          <rect x="22" y="86" width="12" height="32" rx="6" fill={body} stroke="#0003" />
          <rect x="86" y="86" width="12" height="32" rx="6" fill={body} stroke="#0003" />
          <rect x="38" y="118" width="14" height="30" rx="5" fill="#475569" />
          <rect x="68" y="118" width="14" height="30" rx="5" fill="#475569" />
          <rect x="34" y="80" width="52" height="42" rx="10" fill={body} stroke="#0003" strokeWidth="2" />
          <rect x="48" y="92" width="24" height="14" rx="4" fill="#0f172a" />
          <circle cx="54" cy="99" r="3" fill="#4fd1c5" />
          <circle cx="66" cy="99" r="3" fill="#f6c453" />
          <rect x="30" y="28" width="60" height="48" rx="12" fill={body} stroke="#0003" strokeWidth="2" />
          <rect x="38" y="40" width="44" height="22" rx="8" fill="#0f172a" />
          <rect x="44" y="45" width="10" height="12" rx="4" fill="#67e8f9" className="edu-eye" />
          <rect x="66" y="45" width="10" height="12" rx="4" fill="#67e8f9" className="edu-eye" />
          <rect x="50" y="66" width="20" height="4" rx="2" fill="#0003" />
        </g>
      ) : (
        <g>
          <rect x="40" y="120" width="15" height="28" rx="6" fill="#334155" />
          <rect x="65" y="120" width="15" height="28" rx="6" fill="#334155" />
          <rect x="38" y="82" width="44" height="46" rx="12" fill={o.main} stroke="#0003" strokeWidth="2" />
          <rect x="38" y="112" width="44" height="6" fill={o.trim} />
          <rect x="24" y="86" width="14" height="30" rx="7" fill={o.main} />
          <rect x="82" y="86" width="14" height="30" rx="7" fill={o.main} />
          <circle cx="31" cy="118" r="7" fill={skin} />
          <circle cx="89" cy="118" r="7" fill={skin} />
          {a.cls === "paladino" && (
            <g>
              <circle cx="36" cy="88" r="10" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
              <circle cx="84" cy="88" r="10" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
              <path d="M60 86 l9 6 v12 l-9 8 l-9 -8 v-12z" fill="#f6c453" />
            </g>
          )}
          {a.cls === "exploradora" && <rect x="44" y="78" width="32" height="8" rx="4" fill="#dd6b20" />}
          {a.cls === "heroi" && <path d="M60 90 l6 10 l-6 10 l-6 -10z" fill={o.trim} />}
          <circle cx="60" cy="56" r="26" fill={skin} stroke="#0002" strokeWidth="2" />
          <circle cx="50" cy="56" r="3.4" fill="#1c1c26" className="edu-eye" />
          <circle cx="70" cy="56" r="3.4" fill="#1c1c26" className="edu-eye" />
          <path d="M51 67 Q60 75 69 67" fill="none" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="45" cy="64" r="3" fill="#ff7f6e55" />
          <circle cx="75" cy="64" r="3" fill="#ff7f6e55" />
          <Hair style={a.hair_style ?? "curto"} color={hairHex(a.hair_color ?? "preto")} top={top} />
          {a.cls === "mago" && (
            <g>
              <ellipse cx="60" cy={top + 4} rx="36" ry="7" fill="#5b21b6" />
              <path d={`M40 ${top + 4} L60 ${top - 44} L80 ${top + 4}Z`} fill="#7c3aed" />
              <text x="60" y={top - 10} textAnchor="middle" fontSize="14" fill="#fcd34d">★</text>
            </g>
          )}
          {a.cls === "heroi" && <rect x="34" y={top + 14} width="52" height="7" rx="3" fill="#dc2626" />}
          {a.cls === "paladino" && (
            <path d={`M36 ${top + 18} Q36 ${top - 6} 60 ${top - 6} Q84 ${top - 6} 84 ${top + 18} L84 ${top + 6} Q60 ${top - 4} 36 ${top + 6}Z`} fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
          )}
          {a.cls === "exploradora" && <rect x="36" y={top + 14} width="48" height="6" rx="3" fill="#dd6b20" />}
        </g>
      )}
      {front.map((id) => (
        <Accessory key={id} id={id} robot={robot} top={top} />
      ))}
    </svg>
  );
}
