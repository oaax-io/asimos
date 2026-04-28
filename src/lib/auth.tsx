import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type SuperadminStatus = "unknown" | "granted" | "denied";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSuperadmin: boolean;
  superadminStatus: SuperadminStatus;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, agencyName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshSuperadmin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [superadminStatus, setSuperadminStatus] = useState<SuperadminStatus>("unknown");
  const userRef = useRef<User | null>(null);
  const roleCheckIdRef = useRef(0);
  const superadminStatusRef = useRef<SuperadminStatus>("unknown");
  const bootstrappedRef = useRef(false);

  const updateSuperadminStatus = useCallback((status: SuperadminStatus, granted = false) => {
    superadminStatusRef.current = status;
    setSuperadminStatus(status);
    setIsSuperadmin(granted);
  }, []);

  const refreshSuperadmin = useCallback(async (targetUser?: User | null) => {
    const currentUser = targetUser ?? userRef.current;

    if (!currentUser) {
      updateSuperadminStatus("denied", false);
      return;
    }

    const requestId = ++roleCheckIdRef.current;
    updateSuperadminStatus("unknown", false);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await supabase.rpc("is_superadmin");

      if (requestId !== roleCheckIdRef.current || userRef.current?.id !== currentUser.id) {
        return;
      }

      if (!error) {
        const granted = !!data;
        updateSuperadminStatus(granted ? "granted" : "denied", granted);
        return;
      }

      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      } else {
        console.warn("Superadmin-Prüfung fehlgeschlagen", error.message);
      }
    }

    if (requestId === roleCheckIdRef.current && userRef.current?.id === currentUser.id) {
      updateSuperadminStatus("unknown", false);
    }
  }, [updateSuperadminStatus]);

  const applySession = useCallback((nextSession: Session | null) => {
    const nextUser = nextSession?.user ?? null;
    const previousUserId = userRef.current?.id ?? null;

    setSession(nextSession);
    setUser(nextUser);
    userRef.current = nextUser;

    if (!nextUser) {
      roleCheckIdRef.current += 1;
      updateSuperadminStatus("denied", false);
      return;
    }

    if (previousUserId === nextUser.id && superadminStatusRef.current !== "unknown") {
      return;
    }

    void refreshSuperadmin(nextUser);
  }, [refreshSuperadmin, updateSuperadminStatus]);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      applySession(nextSession);
      if (bootstrappedRef.current) {
        setLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      bootstrappedRef.current = true;
      applySession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      roleCheckIdRef.current += 1;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      applySession(data.session);
    }
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string, agencyName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName, agency_name: agencyName },
      },
    });
    if (!error && data.session) {
      applySession(data.session);
    }
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    applySession(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isSuperadmin, superadminStatus, signIn, signUp, signOut, refreshSuperadmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
