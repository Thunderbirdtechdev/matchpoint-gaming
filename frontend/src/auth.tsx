import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, getToken } from "./api";

export type User = {
  id: string;
  email: string;
  username: string;
  bio?: string;
  avatar?: string;
  favorite_games?: string[];
  wallet_balance?: number;
  pending_balance?: number;
  is_admin?: boolean;
  email_verified?: boolean;
  stats?: { wins: number; losses: number; earnings: number; rank: number; matches: number };
  badges?: string[];
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const t = await getToken();
      if (!t) {
        setLoading(false);
        return;
      }
      const u = await api<User>("/auth/me");
      setUser(u);
    } catch {
      await setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signIn = async (token: string, u: User) => {
    await setToken(token);
    setUser(u);
  };

  const signOut = async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    await setToken(null);
    setUser(null);
  };

  const refresh = async () => {
    try {
      const u = await api<User>("/auth/me");
      setUser(u);
    } catch {}
  };

  return <Ctx.Provider value={{ user, loading, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
