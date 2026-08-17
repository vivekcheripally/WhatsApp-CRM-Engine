"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationConfig, MenuItemConfig } from "@/config/navigation.config";
import { RoleGuard } from "@/components/auth/RoleGuard";

/* ── Custom SVG icons ── */

const DashboardIcon = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="1" y="1" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9.5" y="1" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="1" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const ContactsIcon = () => (
  <svg width="18" height="17" viewBox="0 0 18 17" fill="none">
    <circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M1 15c0-3.314 2.686-5 6-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="13" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M16.5 15c0-2.485-1.567-4-4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const TemplatesIcon = () => (
  <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
    <rect x="1" y="1" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="4" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="4" y1="9.5" x2="12" y2="9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="4" y1="13" x2="9" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const CampaignsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M3 7H2a1 1 0 00-1 1v2a1 1 0 001 1h1l3 3V4L3 7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M11 5.5c1.5.8 2.5 2.2 2.5 3.5s-1 2.7-2.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M13 3c2.5 1.4 4 3.5 4 6s-1.5 4.6-4 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 9L16 2L9 16L7.5 10.5L2 9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M7.5 10.5L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ReportsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1" y="1" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    <line x1="5" y1="13" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="9" y1="13" x2="9" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="13" y1="13" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ActivityIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 9h4l2-5 4 10 2-5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SalesAgentsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="5" r="3.2" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M2.5 16.5c0-3.2 2.9-5.5 6.5-5.5s6.5 2.3 6.5 5.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const SuperAdminIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 2L3 5v6c0 3.55 2.55 6.84 6 7.5 3.45-.66 6-3.95 6-7.5V5l-6-3z" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const iconMap: Record<string, () => React.ReactNode> = {
  "Super Admin": SuperAdminIcon,
  "Dashboard":   DashboardIcon,
  "Contacts":    ContactsIcon,
  "Templates":   TemplatesIcon,
  "Campaigns":   CampaignsIcon,
  "WhatsApp":    WhatsAppIcon,
  "Reports":     ReportsIcon,
  "Activity":    ActivityIcon,
  "SalesAgents": SalesAgentsIcon,
  "Sales Agents": SalesAgentsIcon,
  "Settings":    SettingsIcon,
};

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 overflow-hidden"
      style={{
        width: "220px",
        background: "#ffffff",
        borderRight: "1px solid rgba(100,80,200,0.09)",
      }}
    >
      {/* ── Logo ── */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-1.5">
          <img
            src="/logo1.png"
            alt="Logo"
            style={{
              width: 46,
              height: 46,
              flexShrink: 0,
            }}
          />
          <div>
            <p className="font-black text-[16px] tracking-wider leading-tight uppercase" style={{ color: "#1a1040" }}>NEXORA</p>
            <p className="text-[11px] font-semibold" style={{ color: "#9390b5" }}>WhatsApp CRM</p>
          </div>
        </div>
      </div>

      {/* ── Navigation Filtered Declaratively via RoleGuard & PermissionGuard ── */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-none pt-1">
        {navigationConfig.map((m: MenuItemConfig) => {
          const isWhatsApp = m.href === "/whatsapp";
          const active =
            m.href === "/"
              ? pathname === "/"
              : pathname === m.href || pathname.startsWith(m.href + "/");

          const IconComponent = iconMap[m.iconName || m.title];

          return (
            <RoleGuard key={m.title} role={m.roles} permission={m.permissions}>
              <Link
                href={m.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 select-none"
                style={{
                  background: active
                    ? "linear-gradient(90deg, #7c3aed 0%, #5b21b6 100%)"
                    : "transparent",
                  color: active ? "#ffffff" : "#4b4880",
                  fontWeight: active ? 600 : 500,
                  fontSize: "14px",
                  boxShadow: active ? "0 4px 14px rgba(124,58,237,0.35)" : "none",
                  textDecoration: "none",
                }}
              >
                {/* Icon */}
                <span
                  style={{
                    color: active ? "#ffffff" : "#7c3aed",
                    display: "flex",
                    alignItems: "center",
                    width: 20,
                    flexShrink: 0,
                  }}
                >
                  {IconComponent && <IconComponent />}
                </span>

                <span className="flex-1">{m.title}</span>

                {/* Badge */}
                {(m.badge || isWhatsApp) && (
                  <span
                    className="flex items-center justify-center text-[10px] font-bold rounded-full px-2 py-0.5 shadow-sm"
                    style={{
                      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                      color: "#ffffff",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {m.badge || "Live"}
                  </span>
                )}
              </Link>
            </RoleGuard>
          );
        })}
      </nav>

      {/* ── WhatsApp Connected Card + Settings Button (Visible only to ORG_ADMIN) ── */}
      <RoleGuard role={["ORG_ADMIN"]}>
        <div className="p-3 pb-5">
          <div
            className="rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 60%, #4c1d95 100%)",
              border: "1px solid rgba(124,58,237,0.4)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: 38, height: 38,
                  background: "rgba(37,211,102,0.15)",
                  border: "1.5px solid rgba(37,211,102,0.4)",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2C5.58 2 2 5.58 2 10c0 1.42.37 2.75 1.02 3.9L2 18l4.18-.99A7.96 7.96 0 0010 18c4.42 0 8-3.58 8-8s-3.58-8-8-8z" fill="#25d366"/>
                  <circle cx="7" cy="10" r="1" fill="white"/>
                  <circle cx="10" cy="10" r="1" fill="white"/>
                  <circle cx="13" cy="10" r="1" fill="white"/>
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-bold leading-tight text-white">WhatsApp</p>
                <p className="text-[11px] font-medium flex items-center gap-1" style={{ color: "#25d366" }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
                  Connected
                </p>
              </div>
            </div>

            <Link
              href="/whatsapp/settings"
              className="flex items-center justify-center gap-2 w-full rounded-full py-2.5 text-[13px] font-semibold transition-all"
              style={{
                background: "#ffffff",
                color: "#7c3aed",
              }}
            >
              <SettingsIcon />
              Settings
            </Link>
          </div>
        </div>
      </RoleGuard>
    </aside>
  );
}
