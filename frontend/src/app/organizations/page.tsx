"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Mail,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWabaContext } from "@/context/WabaContext";
import { useAgents } from "@/hooks/use-agents";
import { api } from "@/lib/api";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #ece9f8",
  borderRadius: "16px",
  boxShadow: "0 1px 6px rgba(100,80,200,0.07)",
};

export default function OrganizationsPage() {
  const { user } = useAuth();
  const { channels, channelsLoading } = useWabaContext();
  const { agents, isLoading: agentsLoading } = useAgents();

  const isSuperAdmin = user?.role === "SYSTEM_ADMIN" || user?.role === "super_admin";
  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (isSuperAdmin) {
          const res = await api.get("/api/super-admin/metrics");
          if (mounted) setOrgDetails(res.data);
        } else {
          // Fetch current organization information if available
          const res = await api.get("/api/whatsapp/settings").catch(() => null);
          if (mounted && res?.data) {
            setOrgDetails(res.data);
          }
        }
      } catch (err) {
        console.error("Failed to load organization context:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isSuperAdmin]);

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-6" style={{ background: "#f8f7fd" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1a1040" }}>
            Organization Management
          </h1>
          <p className="text-sm mt-1" style={{ color: "#9390b5" }}>
            Manage your workspace subscription, connected WhatsApp channels, and team permissions.
          </p>
        </div>

        {isSuperAdmin && (
          <Link
            href="/super-admin"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm transition-all self-start md:self-auto"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
              boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
            }}
          >
            <ShieldCheck size={15} />
            <span>Open Super Admin Portal</span>
            <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Workspace Card */}
        <div className="p-6 space-y-4" style={cardStyle}>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "#f0eefb", color: "#7c3aed" }}
            >
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9390b5" }}>
                Tenant Organization
              </p>
              <h2 className="text-lg font-bold" style={{ color: "#1a1040" }}>
                {user?.organization_id ? "Active Tenant Workspace" : "Default Workspace"}
              </h2>
            </div>
          </div>

          <div className="pt-2 border-t border-[#f0eefb] space-y-2.5 text-xs text-[#6b679b]">
            <div className="flex justify-between items-center">
              <span>Status</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={12} /> Active
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Account Role</span>
              <span className="font-semibold text-[#1a1040]">{user?.role || "ORG_ADMIN"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>User Email</span>
              <span className="font-semibold text-[#1a1040]">{user?.email || "admin@platform.com"}</span>
            </div>
          </div>
        </div>

        {/* Connected Channels */}
        <div className="p-6 space-y-4" style={cardStyle}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "#e0f2fe", color: "#0284c7" }}
              >
                <Smartphone size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9390b5" }}>
                  WABA Channels
                </p>
                <h2 className="text-lg font-bold" style={{ color: "#1a1040" }}>
                  {channels.length} Connected
                </h2>
              </div>
            </div>
            <Link
              href="/whatsapp/settings"
              className="text-xs font-semibold text-[#7c3aed] hover:underline"
            >
              Configure
            </Link>
          </div>

          <div className="pt-2 border-t border-[#f0eefb] space-y-2">
            {channelsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#7c3aed]" />
            ) : channels.length === 0 ? (
              <p className="text-xs text-[#9390b5]">No WhatsApp Business channels connected yet.</p>
            ) : (
              channels.slice(0, 3).map((ch) => (
                <div key={ch.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#1a1040] truncate max-w-[140px]">{ch.channel_name}</span>
                  <span className="font-mono text-[11px] text-[#9390b5]">{ch.phone_number_id.slice(-6)}...</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team Members */}
        <div className="p-6 space-y-4" style={cardStyle}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "#fef3c7", color: "#d97706" }}
              >
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9390b5" }}>
                  Sales Team
                </p>
                <h2 className="text-lg font-bold" style={{ color: "#1a1040" }}>
                  {agents.length} Agents
                </h2>
              </div>
            </div>
            <Link href="/agents" className="text-xs font-semibold text-[#7c3aed] hover:underline">
              Manage
            </Link>
          </div>

          <div className="pt-2 border-t border-[#f0eefb] space-y-2">
            {agentsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#7c3aed]" />
            ) : agents.length === 0 ? (
              <p className="text-xs text-[#9390b5]">No sales agents added yet.</p>
            ) : (
              agents.slice(0, 3).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#1a1040] truncate max-w-[140px]">{a.full_name || a.email}</span>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {a.status || "ACTIVE"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/whatsapp/settings"
          className="p-5 rounded-2xl border border-[#ece9f8] bg-white hover:border-[#7c3aed]/40 hover:shadow-md transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#f5f4fb] flex items-center justify-center text-[#7c3aed]">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1a1040] group-hover:text-[#7c3aed] transition-colors">
                WhatsApp Cloud API Settings
              </p>
              <p className="text-xs text-[#9390b5]">Connect Meta WABA credentials, phone number IDs, and auto-replies.</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-[#7c3aed] group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/agents"
          className="p-5 rounded-2xl border border-[#ece9f8] bg-white hover:border-[#7c3aed]/40 hover:shadow-md transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#f5f4fb] flex items-center justify-center text-[#7c3aed]">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1a1040] group-hover:text-[#7c3aed] transition-colors">
                Agent Access & Roles
              </p>
              <p className="text-xs text-[#9390b5]">Assign incoming conversation channels and campaigns to sales agents.</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-[#7c3aed] group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
