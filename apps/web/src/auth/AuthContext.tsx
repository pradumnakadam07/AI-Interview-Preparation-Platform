import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";

export interface User { id: string; name: string; email: string }
interface AuthContextValue { user: User | null; signIn: (email: string, password: string) => Promise<void>; signUp: (name: string, email: string, password: string) => Promise<void>; signOut: () => void }
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("interviewlab_user");
    try { return saved ? JSON.parse(saved) as User : null; } catch { return null; }
  });
  const save = (data: { token: string; user: User }) => { localStorage.setItem("interviewlab_token", data.token); localStorage.setItem("interviewlab_user", JSON.stringify(data.user)); setUser(data.user); };
  const signIn = async (email: string, password: string) => { const { data } = await api.post("/api/v1/auth/login", { email, password }); save(data); };
  const signUp = async (name: string, email: string, password: string) => { const { data } = await api.post("/api/v1/auth/register", { name, email, password }); save(data); };
  const signOut = () => { localStorage.removeItem("interviewlab_token"); localStorage.removeItem("interviewlab_user"); setUser(null); };
  const value = useMemo(() => ({ user, signIn, signUp, signOut }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be used inside AuthProvider"); return value; }
