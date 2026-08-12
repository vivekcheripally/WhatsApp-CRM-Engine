import { UserRole } from "@/lib/types";

export interface MenuItemConfig {
  title: string;
  href: string;
  iconName: string;
  roles?: (UserRole | string)[];
  permissions?: string[];
  badge?: string;
  children?: MenuItemConfig[];
}

export const navigationConfig: MenuItemConfig[] = [
  {
    title: "Super Admin",
    href: "/super-admin",
    iconName: "SuperAdmin",
    roles: ["SYSTEM_ADMIN", "super_admin"],
  },
  {
    title: "Dashboard",
    href: "/",
    iconName: "Dashboard",
    roles: ["ORG_ADMIN", "SALES_AGENT"],
  },
  {
    title: "WhatsApp",
    href: "/whatsapp",
    iconName: "WhatsApp",
    roles: ["ORG_ADMIN", "SALES_AGENT"],
    badge: "Live",
  },
  {
    title: "Contacts",
    href: "/contacts",
    iconName: "Contacts",
    roles: ["ORG_ADMIN", "SALES_AGENT"],
  },
  {
    title: "Templates",
    href: "/templates",
    iconName: "Templates",
    roles: ["ORG_ADMIN", "SALES_AGENT"],
  },
  {
    title: "Campaigns",
    href: "/campaigns",
    iconName: "Campaigns",
    roles: ["ORG_ADMIN", "SALES_AGENT"],
  },
  {
    title: "Reports",
    href: "/reports",
    iconName: "Reports",
    roles: ["ORG_ADMIN"],
    permissions: ["CAMPAIGN_READ"],
  },
  {
    title: "Activity",
    href: "/activity",
    iconName: "Activity",
    roles: ["ORG_ADMIN"],
    permissions: ["CAMPAIGN_READ"],
  },
  {
    title: "Sales Agents",
    href: "/agents",
    iconName: "SalesAgents",
    roles: ["ORG_ADMIN"],
    permissions: ["AGENT_MANAGE"],
  },
];
