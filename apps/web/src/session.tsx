import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { isMusicOn, setMusic, setSfx } from "./audio";
import type { Me } from "./types";

interface Ctx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  logout: () => Promise<void>;
  calm: boolean;
  setCalm: (v: boolean) => void;
  music: boolean;
  toggleMusic: () => void;
  sound: boolean;
  setSound: (v: boolean) => void;
}

const SessionCtx = createContext<Ctx | null>(null);

function load(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === "1";
  } catch {
    return def;
  }
}
function save(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? "1" : "0");
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [calm, setCalmState] = useState(() => load("calm", window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false));
  const [music, setMusicState] = useState(false);
  const [sound, setSoundState] = useState(() => load("sound", true));

  const refresh = useCallback(async () => {
    try {
      const m = await api.me();
      setMe(m);
      return m;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    document.documentElement.classList.toggle("calm", calm);
  }, [calm]);
  useEffect(() => setSfx(sound), [sound]);

  const value = useMemo<Ctx>(
    () => ({
      me,
      loading,
      refresh,
      logout: async () => {
        await api.logout().catch(() => undefined);
        setMusic(false);
        setMusicState(false);
        setMe(null);
      },
      calm,
      setCalm: (v) => {
        setCalmState(v);
        save("calm", v);
      },
      music,
      toggleMusic: () => {
        const next = !isMusicOn();
        setMusic(next);
        setMusicState(next);
      },
      sound,
      setSound: (v) => {
        setSoundState(v);
        save("sound", v);
      },
    }),
    [me, loading, refresh, calm, music, sound],
  );
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession(): Ctx {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("SessionProvider ausente");
  return c;
}
