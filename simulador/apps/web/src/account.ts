// Conta do usuário: perfil local (sempre disponível) e, se configurado, sessão no Supabase.
import { useEffect, useState } from "react";
import { Backend, type Session } from "@fisilab/platform";

export interface Profile {
  name: string;
  matricula: string;
  role: "aluno" | "professor";
  email?: string;
}

const KEY = "fisilab.perfil.v1";
const SKEY = "fisilab.sessao.v1";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Backend configurado no build (ou null: modo local). */
export const backend: Backend | null = url && anonKey ? new Backend({ url, anonKey }) : null;

if (backend) {
  try {
    const s = JSON.parse(localStorage.getItem(SKEY) ?? "null") as Session | null;
    if (s) backend.session = s;
  } catch {
    /* sem sessão salva */
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SKEY, JSON.stringify(s));
    else localStorage.removeItem(SKEY);
  } catch {
    /* ignora */
  }
  emit();
}

/** Garante token válido antes de chamar o backend. */
export async function freshSession(): Promise<Session | null> {
  if (!backend?.session) return null;
  if (backend.session.expiresAt - Date.now() / 1000 < 60) {
    try {
      saveSession(await backend.refresh());
    } catch {
      backend.signOut();
      saveSession(null);
    }
  }
  return backend.session;
}

export function loadProfile(): Profile | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as Profile | null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
  emit();
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useProfile(): Profile | null {
  const [p, setP] = useState(loadProfile);
  useEffect(() => {
    const on = () => setP(loadProfile());
    listeners.add(on);
    return () => void listeners.delete(on);
  }, []);
  return p;
}

/** Endpoint do tutor quando há backend e sessão. */
export function tutorClient() {
  return backend?.session ? { endpoint: backend.fnUrl("tutor"), token: backend.session.accessToken } : {};
}
