"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { messagesAPI, notificationsAPI } from "@/lib/api";
import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Calendar,
  User,
  FileText,
  BarChart2,
  LogOut,
  Bell,
  CheckCheck,
  CalendarClock,
  X,
  Flag,
  ShieldAlert,
  Gavel,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
};

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: {
    appointmentId?: string;
    startAt?: string;
    [key: string]: unknown;
  } | null;
}

const coachNavItems: Omit<NavItem, "badge">[] = [
  { href: "/coach/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/coach/clients", icon: Users, label: "Clients" },
  { href: "/coach/messages", icon: MessageSquare, label: "Messages" },
  { href: "/coach/appointments", icon: Calendar, label: "Agenda" },
  { href: "/coach/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/coach/templates", icon: FileText, label: "Templates" },
  { href: "/coach/profile", icon: User, label: "Mon Profil" },
];

// L'administration n'expose aucune entrée métier : ni clients, ni programmes, ni
// statistiques. Un administrateur n'a rien à y faire, et les routes correspondantes
// lui répondraient 403 de toute façon.
const adminNavItems: Omit<NavItem, "badge">[] = [
  { href: "/admin/reports", icon: Flag, label: "Signalements" },
  { href: "/admin/appeals", icon: Gavel, label: "Recours" },
];

const clientNavItems: Omit<NavItem, "badge">[] = [
  { href: "/client/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/client/coaches", icon: Users, label: "Coachs" },
  { href: "/client/messages", icon: MessageSquare, label: "Messages" },
  { href: "/client/appointments", icon: Calendar, label: "Agenda" },
  { href: "/client/profile", icon: User, label: "Mon Profil" },
];

export const Sidebar = () => {
  const { user, logout, isCoach, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await messagesAPI.getUnreadCount();
      setUnreadCount(response.data.data?.count ?? 0);
    } catch {
      // silencieux
    }
  }, []);

  const fetchNotifCount = useCallback(async () => {
    try {
      const res = await notificationsAPI.getUnreadCount();
      setNotifUnread(res.data.data?.count ?? 0);
    } catch {
      // silencieux
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsAPI.getAll();
      setNotifications(res.data.data ?? []);
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const refresh = () => {
      fetchUnreadCount();
      fetchNotifCount();
    };

    refresh();
    // 10 s et non 30 : la pastille est le seul signal qu'un message est arrivé.
    // Elle décroissait déjà instantanément à la lecture (événement
    // fitflow:messages-read) mais ne montait qu'au sondage suivant.
    const interval = setInterval(refresh, 10_000);

    // Retour sur l'onglet : on rafraîchit sans attendre le prochain tour. C'est ce
    // qui rend la pastille perçue comme immédiate, le cas courant étant de revenir
    // sur l'application après l'avoir quittée.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [user, fetchUnreadCount, fetchNotifCount]);

  useEffect(() => {
    // La pastille doit s'éteindre à l'ouverture de la conversation, pas au retour
    // du réseau. La page messagerie annonce donc le nombre de messages qu'elle
    // vient de lire et on le retire aussitôt ; l'événement sans détail, émis une
    // fois le serveur à jour, réconcilie le compteur avec la source de vérité.
    const handler = (e: Event) => {
      const read = (e as CustomEvent<{ count?: number }>).detail?.count;
      if (typeof read === "number" && read > 0) {
        setUnreadCount((prev) => Math.max(0, prev - read));
        return;
      }
      fetchUnreadCount();
    };
    window.addEventListener("fitflow:messages-read", handler);
    return () => window.removeEventListener("fitflow:messages-read", handler);
  }, [fetchUnreadCount]);

  // Fermer panneau au clic extérieur
  useEffect(() => {
    if (!notifOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideBtn = notifRef.current?.contains(target);
      // Le panneau est dans un portail, on cherche le div .notif-panel
      const insidePanel = (target as Element)?.closest?.("[data-notif-panel]");
      if (!insideBtn && !insidePanel) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [notifOpen]);

  const openNotifPanel = async () => {
    if (!notifOpen) {
      await fetchNotifications();
      if (bellBtnRef.current) {
        const rect = bellBtnRef.current.getBoundingClientRect();
        setPanelPos({ top: window.innerHeight - rect.bottom, left: rect.right + 8 });
      }
    }
    setNotifOpen((v) => !v);
  };

  const markAllRead = async () => {
    await notificationsAPI.markAllRead();
    setNotifUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markOneRead = async (id: string) => {
    await notificationsAPI.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setNotifUnread((c) => Math.max(0, c - 1));
  };

  const baseItems = isAdmin()
    ? adminNavItems
    : isCoach()
      ? coachNavItems
      : clientNavItems;
  const navItems: NavItem[] = baseItems.map((item) =>
    item.href.includes("/messages") ? { ...item, badge: unreadCount } : item
  );

  return (
    <aside data-theme="lime" className="group/sidebar fixed left-0 top-0 h-screen w-16 hover:w-48 bg-white border-r border-gray-100 shadow-sm flex flex-col z-50 transition-[width] duration-300 ease-in-out overflow-hidden">
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-100 shrink-0">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo-vert-256.png" alt="FitFlow" className="h-8 w-8 shrink-0" />
          <span className="text-base font-bold text-gray-900 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap">
            FitFlow
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col py-4 gap-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.map(({ href, icon: Icon, label, badge }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center h-10 px-3 mx-2 rounded-xl transition-all duration-200 group/item ${
                isActive ? "bg-primary-50" : "hover:bg-gray-50"
              }`}
            >
              {/* Indicateur actif */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary-500 rounded-r-full sidebar-line-glow" />
              )}

              {/* Icône */}
              <span className="relative shrink-0">
                <Icon
                  className={`h-5 w-5 transition-all duration-200 ${
                    isActive
                      ? "text-primary-500 sidebar-icon-active"
                      : "text-gray-300 group-hover/item:text-gray-400"
                  }`}
                />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold leading-none">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>

              {/* Label */}
              <span
                className={`ml-3 text-sm font-medium whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-100 ${
                  isActive
                    ? "text-primary-700"
                    : "text-gray-500 group-hover/item:text-gray-700"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer : cloche + avatar + déconnexion */}
      <div className="flex flex-col gap-1 px-2 py-3 border-t border-gray-100 shrink-0">

        {/* Bouton notifications */}
        <div ref={notifRef}>
          <button
            ref={bellBtnRef}
            onClick={openNotifPanel}
            className="relative flex items-center h-10 px-3 w-full rounded-xl text-gray-300 hover:text-primary-500 hover:bg-primary-50/70 transition-all duration-200 group/item"
          >
            <span className="relative shrink-0">
              <Bell className="h-5 w-5" />
              {notifUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold leading-none">
                  {notifUnread > 99 ? "99+" : notifUnread}
                </span>
              )}
            </span>
            <span className="ml-3 text-sm font-medium text-gray-500 group-hover/item:text-primary-600 whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-100">
              Notifications
            </span>
          </button>

          {/* Panneau notifications — portail fixed hors sidebar */}
          {notifOpen && typeof window !== "undefined" && createPortal(
            <div
              data-notif-panel
              className="fixed w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-[200] overflow-hidden"
              style={{ bottom: panelPos.top, left: panelPos.left, maxHeight: "min(480px, calc(100vh - 32px))" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-gray-900 text-sm">Notifications</span>
                <div className="flex items-center gap-2">
                  {notifUnread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Tout lire
                    </button>
                  )}
                  <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto max-h-80">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <Bell className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">Aucune notification</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const apptStart = notif.data?.startAt;
                    const isAppointmentNotif =
                      notif.type === "APPOINTMENT_REMINDER" ||
                      notif.type === "APPOINTMENT_CANCELLED" ||
                      notif.type === "APPOINTMENT_MODIFIED";
                    const handleClick = () => {
                      if (!notif.isRead) markOneRead(notif.id);
                      if (isAppointmentNotif && apptStart) {
                        const dateParam = apptStart.split("T")[0]; // YYYY-MM-DD
                        const apptId = notif.data?.appointmentId;
                        const path = isCoach() ? "/coach/appointments" : "/client/appointments";
                        const qs = new URLSearchParams({ date: dateParam });
                        if (apptId) qs.set("appointmentId", apptId);
                        setNotifOpen(false);
                        router.push(`${path}?${qs.toString()}`);
                      }
                    };
                    return (
                    <button
                      key={notif.id}
                      onClick={handleClick}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        notif.isRead ? "opacity-60" : ""
                      } ${isAppointmentNotif && apptStart ? "cursor-pointer" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                          notif.type === "APPOINTMENT_CANCELLED"
                            ? "bg-red-100"
                            : notif.type === "APPOINTMENT_REMINDER"
                            ? "bg-indigo-100"
                            : "bg-yellow-100"
                        }`}>
                          <CalendarClock className={`h-3.5 w-3.5 ${
                            notif.type === "APPOINTMENT_CANCELLED"
                              ? "text-red-600"
                              : notif.type === "APPOINTMENT_REMINDER"
                              ? "text-indigo-600"
                              : "text-yellow-600"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-semibold ${notif.isRead ? "text-gray-500" : "text-gray-900"}`}>
                              {notif.title}
                            </p>
                            {!notif.isRead && (
                              <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{notif.body}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {format(parseISO(notif.createdAt), "d MMM 'à' HH:mm", { locale: fr })}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                  })
                )}
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* Avatar utilisateur */}
        <div className="flex items-center h-10 px-1 gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary-700">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-600 whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-100 truncate">
            {user?.firstName} {user?.lastName}
          </span>
        </div>

        {/* Déconnexion */}
        <button
          onClick={logout}
          className="flex items-center h-10 px-3 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50/70 transition-all duration-200 group/item"
        >
          <LogOut className="h-5 w-5 shrink-0 transition-colors duration-200" />
          <span className="ml-3 text-sm font-medium text-gray-500 group-hover/item:text-red-400 whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-100">
            Déconnexion
          </span>
        </button>
      </div>
    </aside>
  );
};
