import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  Bookmark,
  ChevronDown,
  CircleDot,
  Compass,
  Heart,
  Home,
  LogOut,
  MessageCircle,
  Menu,
  Moon,
  Pencil,
  Settings,
  Sparkles,
  Sun,
  TrendingUp,
  Waves,
  X,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import oceanBg from "@/assets/ocean-bg.png";
import { useApp } from "@/contexts/AppContext";

type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
};

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", icon: Home, to: "/" },
  { key: "today", label: "Today for You", icon: Heart, to: "/today" },
  { key: "explorer", label: "Quran Explorer", icon: BookOpen, to: "/explorer" },
  { key: "salah", label: "Salah Tracker", icon: Clock, to: "/salah" },
  { key: "tasbih", label: "Digital Tasbih", icon: CircleDot, to: "/tasbih" },
  { key: "reflections", label: "Reflections", icon: Pencil, to: "/reflections" },
  { key: "progress", label: "Progress", icon: TrendingUp, to: "/progress" },
  { key: "bookmarks", label: "Bookmarks", icon: Bookmark, to: "/bookmarks" },
  { key: "chat", label: "Ask AyahMirror", icon: MessageCircle, to: "/chat" },
  { key: "journey", label: "Journey", icon: Compass, to: "/journey" },
  { key: "settings", label: "Settings", icon: Settings, to: "/settings" },
];

function isActive(itemTo: string, pathname: string) {
  if (itemTo === "/") return pathname === "/";
  return pathname === itemTo || pathname.startsWith(itemTo + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    signOut,
    theme,
    toggleTheme,
    privacyPublic,
    togglePrivacy,
    notifications,
    unreadCount,
    markAllRead,
  } = useApp();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setNotifOpen(false);
    setAvatarOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const isLight = theme === "light";

  return (
    <main
      className={`relative min-h-screen w-full ${
        isLight ? "bg-slate-50 text-slate-900" : "bg-slate-950 text-slate-200"
      }`}
    >
      {!isLight && (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${oceanBg})` }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/80 via-[#0a192f]/70 to-slate-950/90" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(20,184,166,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(56,189,248,0.08),transparent_60%)]" />
        </>
      )}
      {isLight && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(45,212,191,0.12),transparent_60%)]" />
      )}

      <div className="relative flex min-h-screen w-full">
        {/* DESKTOP SIDEBAR */}
        <aside
          className={`hidden md:flex w-64 m-4 rounded-2xl flex-col justify-between p-4 backdrop-blur-md border ${
            isLight
              ? "bg-white/70 border-slate-200"
              : "bg-white/5 border-white/10"
          }`}
        >
          <SidebarContent pathname={location.pathname} isLight={isLight} />
        </aside>

        {/* MOBILE SIDEBAR DRAWER */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside
              className={`relative w-72 max-w-[85vw] m-3 rounded-2xl flex flex-col justify-between p-4 border backdrop-blur-xl ${
                isLight
                  ? "bg-white/90 border-slate-200"
                  : "bg-slate-900/90 border-white/10"
              }`}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className={`absolute top-3 right-3 ${
                  isLight ? "text-slate-500" : "text-slate-400"
                }`}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent pathname={location.pathname} isLight={isLight} />
            </aside>
          </div>
        )}

        {/* MAIN */}
        <div className="flex-1 flex flex-col min-w-0 px-4 py-5 sm:px-8 sm:py-8">
          {/* HEADER */}
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileOpen(true)}
                className={`md:hidden p-2 -ml-2 ${
                  isLight ? "text-slate-700" : "text-slate-300"
                }`}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="md:hidden flex items-center gap-2">
                <Sparkles
                  className={`h-5 w-5 ${isLight ? "text-teal-600" : "text-teal-300"}`}
                />
                <span className="text-base font-semibold">AyahMirror</span>
              </div>
            </div>

            <div className="hidden md:flex flex-1 justify-center">
              <div
                className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs backdrop-blur-md ${
                  isLight
                    ? "border-slate-200 bg-white/60 text-slate-700"
                    : "border-white/10 bg-white/5 text-slate-300"
                }`}
              >
                <Sparkles
                  className={`h-3.5 w-3.5 ${isLight ? "text-teal-600" : "text-teal-300"}`}
                />
                Quranic Wellness Mirror
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 relative">
              <button
                onClick={toggleTheme}
                className={`p-1.5 transition ${
                  isLight
                    ? "text-slate-600 hover:text-teal-600"
                    : "text-slate-400 hover:text-teal-300"
                }`}
                aria-label="Toggle theme"
              >
                {isLight ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </button>

              {/* NOTIFICATIONS */}
              <div className="relative">
                <button
                  onClick={() => {
                    setNotifOpen((o) => !o);
                    setAvatarOpen(false);
                    if (unreadCount) markAllRead();
                  }}
                  className={`relative p-1.5 transition ${
                    isLight
                      ? "text-slate-600 hover:text-teal-600"
                      : "text-slate-400 hover:text-teal-300"
                  }`}
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-teal-400" />
                  )}
                </button>
                {notifOpen && (
                  <div
                    className={`absolute right-0 mt-2 w-72 rounded-xl border backdrop-blur-xl p-3 z-40 ${
                      isLight
                        ? "bg-white/95 border-slate-200 text-slate-800"
                        : "bg-slate-900/90 border-white/10 text-slate-100"
                    }`}
                  >
                    <div className="text-xs uppercase tracking-wide mb-2 opacity-60">
                      Notifications
                    </div>
                    {notifications.length === 0 ? (
                      <div className="text-sm opacity-60 py-4 text-center">
                        You're all caught up.
                      </div>
                    ) : (
                      <ul className="max-h-80 overflow-y-auto space-y-2">
                        {notifications.map((n) => (
                          <li
                            key={n.id}
                            className={`rounded-lg px-3 py-2 text-sm ${
                              isLight ? "bg-slate-100" : "bg-white/5"
                            }`}
                          >
                            <div className="font-medium">{n.title}</div>
                            {n.body && (
                              <div className="text-xs opacity-70 mt-0.5">
                                {n.body}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div
                className={`hidden sm:block h-5 w-px ${
                  isLight ? "bg-slate-300" : "bg-white/10"
                }`}
              />

              {/* AVATAR DROPDOWN */}
              <div className="relative">
                <button
                  onClick={() => {
                    setAvatarOpen((o) => !o);
                    setNotifOpen(false);
                  }}
                  className={`flex items-center gap-1.5 transition ${
                    isLight
                      ? "text-slate-700 hover:text-slate-900"
                      : "text-slate-300 hover:text-slate-100"
                  }`}
                  aria-label="Account"
                >
                  <div
                    className={`h-8 w-8 rounded-full border flex items-center justify-center ${
                      isLight
                        ? "bg-gradient-to-br from-teal-400/40 to-cyan-500/30 border-slate-300"
                        : "bg-gradient-to-br from-teal-400/40 to-cyan-600/30 border-white/10"
                    }`}
                  >
                    {privacyPublic ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <ChevronDown className="h-3 w-3" />
                </button>
                {avatarOpen && (
                  <div
                    className={`absolute right-0 mt-2 w-60 rounded-xl border backdrop-blur-xl p-2 z-40 ${
                      isLight
                        ? "bg-white/95 border-slate-200 text-slate-800"
                        : "bg-slate-900/90 border-white/10 text-slate-100"
                    }`}
                  >
                    <button
                      onClick={togglePrivacy}
                      className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                        isLight ? "hover:bg-slate-100" : "hover:bg-white/5"
                      }`}
                    >
                      {privacyPublic ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                      Reflections: {privacyPublic ? "Public" : "Private"}
                    </button>
                    <Link
                      to="/settings"
                      className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                        isLight ? "hover:bg-slate-100" : "hover:bg-white/5"
                      }`}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                        isLight ? "hover:bg-slate-100" : "hover:bg-white/5"
                      }`}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="mt-6 flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </main>
  );
}

function SidebarContent({
  pathname,
  isLight,
}: {
  pathname: string;
  isLight: boolean;
}) {
  return (
    <>
      <div>
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
              isLight
                ? "bg-gradient-to-br from-teal-400/30 to-cyan-500/10 border-teal-400/40"
                : "bg-gradient-to-br from-teal-400/30 to-cyan-500/10 border-teal-400/30"
            }`}
          >
            <Sparkles
              className={`h-4 w-4 ${isLight ? "text-teal-700" : "text-teal-300"}`}
            />
          </div>
          <span
            className={`text-base font-semibold tracking-tight ${
              isLight ? "text-slate-900" : "text-slate-100"
            }`}
          >
            AyahMirror
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, pathname);
            const activeCls = isLight
              ? "bg-gradient-to-r from-teal-500/20 to-transparent border-l-2 border-teal-500 text-teal-700"
              : "bg-gradient-to-r from-teal-500/20 to-transparent border-l-2 border-teal-400 text-teal-300";
            const idleCls = isLight
              ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-l-2 border-transparent"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-l-2 border-transparent";
            return (
              <Link
                key={item.key}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active ? activeCls : idleCls
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div
        className={`rounded-xl border p-4 ${
          isLight ? "border-slate-200 bg-white/60" : "border-white/10 bg-white/5"
        }`}
      >
        <Waves
          className={`h-4 w-4 mb-2 ${isLight ? "text-teal-600" : "text-teal-400"}`}
        />
        <div
          className={`text-sm font-medium ${
            isLight ? "text-slate-900" : "text-slate-100"
          }`}
        >
          AyahMirror
        </div>
        <div
          className={`mt-1 text-xs ${
            isLight ? "text-slate-500" : "text-slate-400"
          }`}
        >
          Peace. Purpose. Presence.
        </div>
      </div>
    </>
  );
}
