import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

// ---------- Types ----------
export type Theme = "oceanic" | "light";
export type NotificationItem = {
  id: string;
  title: string;
  body?: string;
  kind: "reminder" | "community" | "system";
  createdAt: number;
  read?: boolean;
};
export type Preferences = {
  theme: Theme;
  reciter_id: number;
  translation_id: number;
  life_stage: string | null;
  default_public: boolean;
};

type AppContextValue = {
  // session
  userId: string | null;
  authReady: boolean;
  signOut: () => Promise<void>;

  // theme
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;

  // privacy mode
  privacyPublic: boolean;
  togglePrivacy: () => void;

  // notifications
  notifications: NotificationItem[];
  pushNotification: (n: Omit<NotificationItem, "id" | "createdAt">) => void;
  markAllRead: () => void;
  unreadCount: number;

  // preferences
  prefs: Preferences;
  savePrefs: (p: Partial<Preferences>) => Promise<void>;
  prefsLoaded: boolean;
};

const DEFAULT_PREFS: Preferences = {
  theme: "oceanic",
  reciter_id: 7,
  translation_id: 131,
  life_stage: null,
  default_public: false,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [theme, setThemeState] = useState<Theme>("oceanic");
  const [privacyPublic, setPrivacyPublic] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Session
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Hydrate theme from localStorage once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem("ayah:theme") as Theme | null;
    if (t === "light" || t === "oceanic") setThemeState(t);
  }, []);

  // Persist theme to localStorage + html class
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ayah:theme", theme);
    document.documentElement.classList.toggle("theme-light", theme === "light");
  }, [theme]);

  // Load prefs from Supabase
  useEffect(() => {
    if (!userId) {
      setPrefsLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("theme,reciter_id,translation_id,life_stage,default_public")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const next: Preferences = {
          theme: (data.theme as Theme) ?? "oceanic",
          reciter_id: data.reciter_id ?? 7,
          translation_id: data.translation_id ?? 131,
          life_stage: data.life_stage ?? null,
          default_public: !!data.default_public,
        };
        setPrefs(next);
        setThemeState(next.theme);
        setPrivacyPublic(next.default_public);
      }
      setPrefsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === "oceanic" ? "light" : "oceanic")),
    [],
  );
  const togglePrivacy = useCallback(() => setPrivacyPublic((p) => !p), []);

  const pushNotification = useCallback(
    (n: Omit<NotificationItem, "id" | "createdAt">) => {
      setNotifications((arr) => [
        {
          ...n,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          read: false,
        },
        ...arr,
      ].slice(0, 20));
    },
    [],
  );
  const markAllRead = useCallback(
    () => setNotifications((arr) => arr.map((n) => ({ ...n, read: true }))),
    [],
  );

  const savePrefs = useCallback(
    async (patch: Partial<Preferences>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      if (patch.theme) setThemeState(patch.theme);
      if (typeof patch.default_public === "boolean") setPrivacyPublic(patch.default_public);
      if (!userId) return;
      await supabase
        .from("user_preferences")
        .upsert(
          { user_id: userId, ...next, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
    },
    [prefs, userId],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = useMemo<AppContextValue>(
    () => ({
      userId,
      authReady,
      signOut,
      theme,
      setTheme,
      toggleTheme,
      privacyPublic,
      togglePrivacy,
      notifications,
      pushNotification,
      markAllRead,
      unreadCount,
      prefs,
      savePrefs,
      prefsLoaded,
    }),
    [
      userId,
      authReady,
      signOut,
      theme,
      setTheme,
      toggleTheme,
      privacyPublic,
      togglePrivacy,
      notifications,
      pushNotification,
      markAllRead,
      unreadCount,
      prefs,
      savePrefs,
      prefsLoaded,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
