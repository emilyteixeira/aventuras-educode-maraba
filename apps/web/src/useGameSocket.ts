import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "./types";

export type Fatal = null | "unauth" | "forbidden" | "notfound" | "onboarding";
const FATAL: Record<number, Fatal> = { 4401: "unauth", 4403: "forbidden", 4404: "notfound", 4409: "onboarding" };

export function useGameSocket(code: string) {
  const [state, setState] = useState<GameState | null>(null);
  const [online, setOnline] = useState(false);
  const [fatal, setFatal] = useState<Fatal>(null);
  const [toast, setToast] = useState("");
  const [receivedAt, setReceivedAt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stop = false;
    let retry = 0;
    let reconnect: number | undefined;
    let ping: number | undefined;
    let toastTimer: number | undefined;

    const open = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws/sessions/${code}`);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setOnline(true);
        ping = window.setInterval(() => ws.readyState === 1 && ws.send('{"t":"ping"}'), 20000);
      };
      ws.onmessage = (ev) => {
        let msg: { t: string; msg?: string } & Partial<GameState>;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.t === "state") {
          setState(msg as GameState);
          setReceivedAt(performance.now());
        } else if (msg.t === "error" && msg.msg) {
          setToast(msg.msg);
          window.clearTimeout(toastTimer);
          toastTimer = window.setTimeout(() => setToast(""), 3500);
        }
      };
      ws.onclose = (ev) => {
        window.clearInterval(ping);
        setOnline(false);
        if (stop) return;
        const f = FATAL[ev.code];
        if (f) {
          setFatal(f);
          return;
        }
        reconnect = window.setTimeout(open, Math.min(1000 * 2 ** retry++, 8000));
      };
    };
    open();
    return () => {
      stop = true;
      window.clearTimeout(reconnect);
      window.clearInterval(ping);
      window.clearTimeout(toastTimer);
      wsRef.current?.close();
    };
  }, [code]);

  const send = useCallback((obj: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }, []);

  return { state, online, fatal, toast, send, receivedAt };
}
