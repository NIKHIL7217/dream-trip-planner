// Lightweight client-side session for the demo. Persists a "user" in
// localStorage. Not a real auth system — swap for Lovable Cloud when going
// beyond a prototype.

import { useEffect, useState, useCallback } from "react";

export type SessionUser = {
  email: string;
  name: string;
  joinedAt: string;
};

const KEY = "ephemera.session";

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setSession(user: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(KEY, JSON.stringify(user));
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("ephemera:session"));
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(getSession());
    setHydrated(true);
    const handler = () => setUser(getSession());
    window.addEventListener("ephemera:session", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("ephemera:session", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const signIn = useCallback((email: string, name?: string) => {
    const derivedName =
      name?.trim() ||
      email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    setSession({ email, name: derivedName, joinedAt: new Date().toISOString() });
  }, []);

  const signOut = useCallback(() => setSession(null), []);

  return { user, hydrated, signIn, signOut };
}
