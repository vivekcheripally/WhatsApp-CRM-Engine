"use client";

import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, CheckCircle2, Clock, Ban, MessageSquare, Smartphone,
  Plus, Copy, Check, ShieldCheck, LogOut, RefreshCw, Search, X,
  BarChart3, ArrowRight, ChevronLeft, Users, Send, Eye, MoreVertical,
  Activity, TrendingUp, FileText, Megaphone, Bot, ChevronDown, ChevronUp,
  UserCheck, Zap, Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface Metrics {
  total_organizations: number;
  active_organizations: number;
  pending_approvals: number;
  suspended_organizations: number;
  total_messages_sent: number;
  active_whatsapp_accounts: number;
}
interface OrganizationItem {
  id: string; name: string; slug: string;
  contact_name?: string; contact_email?: string;
  status: string; plan_name: string; created_at?: string;
}

interface OrgAnalytics {
  org_id: string;
  org_name: string;
  org_slug: string;
  contact_name?: string;
  contact_email?: string;
  status: string;
  plan_name: string;
  created_at?: string;
  templates_total: number;
  templates_approved: number;
  templates_pending: number;
  templates_rejected: number;
  campaigns_total: number;
  campaigns_draft: number;
  campaigns_sending: number;
  campaigns_scheduled: number;
  campaigns_completed: number;
  campaigns_failed: number;
  campaign_recipients: number;
  campaign_sent: number;
  campaign_delivered: number;
  campaign_read: number;
  messages_sent: number;
  contacts_count: number;
  whatsapp_accounts_count: number;
  auto_replies_count: number;
  users_count: number;
}

type View = "home" | "analytics" | "organizations";


export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  const [view, setView] = useState<View>("home");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; pass: string; emailSent?: boolean; emailError?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [contactName, setContactName] = useState(""); const [contactEmail, setContactEmail] = useState("");
  const [planName, setPlanName] = useState("STARTER"); const [submitLoading, setSubmitLoading] = useState(false);
  const [orgAnalytics, setOrgAnalytics] = useState<OrgAnalytics[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsSearch, setAnalyticsSearch] = useState("");
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [activeMenuOrgId, setActiveMenuOrgId] = useState<string | null>(null);

  useEffect(() => {
    const handleWindowClick = () => setActiveMenuOrgId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, oRes] = await Promise.all([
        api.get("/api/super-admin/metrics"),
        api.get("/api/super-admin/organizations"),
      ]);
      setMetrics(mRes.data);
      setOrganizations(oRes.data);
    } catch (err) { console.error("Failed to load Super Admin data:", err); }
    finally { setLoading(false); }
  };

  const fetchOrgAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await api.get("/api/super-admin/organizations/analytics");
      setOrgAnalytics(res.data);
    } catch (err) { console.error("Failed to load org analytics:", err); }
    finally { setAnalyticsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (view === "analytics") { fetchOrgAnalytics(); } }, [view]);

  const filteredOrganizations = useMemo(() => {
    return organizations.filter(org => {
      const matchesStatus = statusFilter === "ALL" || org.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || org.name.toLowerCase().includes(q) || org.slug.toLowerCase().includes(q)
        || (org.contact_email && org.contact_email.toLowerCase().includes(q))
        || (org.contact_name && org.contact_name.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [organizations, statusFilter, searchQuery]);

  const getErrorMessage = (err: any, fallback: string) => {
    return err.data?.detail || err.response?.data?.detail || err.message || fallback;
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitLoading(true);
    try {
      await api.post("/api/super-admin/organizations/onboard", { name, slug, contact_name: contactName, contact_email: contactEmail, plan_name: planName });
      setShowOnboardModal(false);
      setName(""); setSlug(""); setContactName(""); setContactEmail("");
      fetchData();
    } catch (err: any) { alert(getErrorMessage(err, "Failed to onboard organization")); }
    finally { setSubmitLoading(false); }
  };

  const handleApprove = async (orgId: string) => {
    try {
      const res = await api.post(`/api/super-admin/organizations/${orgId}/approve`);
      if (res.data.initial_password) {
        setCredentials({
          email: res.data.user_email || res.data.contact_email,
          pass: res.data.initial_password,
          emailSent: res.data.email_sent,
          emailError: res.data.email_error,
        });
        setShowCredentialsModal(true);
      } else {
        alert(res.data.message || "Organization approved successfully!");
      }
      fetchData();
    } catch (err: any) { alert(getErrorMessage(err, "Failed to approve organization")); }
  };



  const handleSuspend = async (orgId: string) => {
    if (!confirm("Suspend this organization?")) return;
    try { await api.post(`/api/super-admin/organizations/${orgId}/suspend`); fetchData(); }
    catch (err: any) { alert(getErrorMessage(err, "Failed to suspend organization")); }
  };

  const handleReactivate = async (orgId: string) => {
    if (!confirm("Reactivate this organization?")) return;
    try { await api.post(`/api/super-admin/organizations/${orgId}/reactivate`); fetchData(); }
    catch (err: any) { alert(getErrorMessage(err, "Failed to reactivate organization")); }
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to delete "${orgName}"?\n\nWARNING: All users, campaigns, contacts, templates, and WhatsApp data associated with this organization will be permanently deleted.`)) return;
    try {
      await api.delete(`/api/super-admin/organizations/${orgId}`);
      fetchData();
    } catch (err: any) { alert(getErrorMessage(err, "Failed to delete organization")); }
  };

  const copyCredentials = () => {
    if (!credentials) return;
    navigator.clipboard.writeText(`Email: ${credentials.email}\nPassword: ${credentials.pass}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const loginAnalytics = useMemo(() => {
    const totalOrganizations = metrics?.total_organizations ?? 0;
    const activeOrganizations = metrics?.active_organizations ?? 0;
    const pendingApprovals = metrics?.pending_approvals ?? 0;
    const activeAccounts = metrics?.active_whatsapp_accounts ?? 0;
    const totalMessages = metrics?.total_messages_sent ?? 0;

    const loginSuccessRate = totalOrganizations > 0
      ? Math.min(99, Math.max(92, 94 + Math.round((activeOrganizations / totalOrganizations) * 3)))
      : 96;
    const dailyLogins = Math.max(120, Math.round(totalMessages / 8 + activeOrganizations * 12));
    const avgSessionMin = Math.max(8, Math.min(24, 10 + Math.round((activeOrganizations / Math.max(1, totalOrganizations)) * 5)));
    const peakHour = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00"][activeOrganizations % 6];
    const securityAlerts = Math.max(0, pendingApprovals);

    return {
      loginSuccessRate,
      dailyLogins,
      avgSessionMin,
      peakHour,
      securityAlerts,
      activeOrganizations,
      activeAccounts,
      totalMessages,
    };
  }, [metrics]);

  const lastUpdated = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  /* ── input style helper ── */
  const inp = "w-full bg-[#f5f4fb] border border-[#e0ddf5] rounded-xl px-3.5 py-2.5 text-[#1a1040] text-sm focus:outline-none focus:border-[#7c3aed] focus:bg-white transition-colors placeholder:text-[#c0bed8]";

  return (
    <div className="min-h-screen relative overflow-hidden font-sans" style={{ background: "linear-gradient(135deg, #f7f3ff 0%, #eee4ff 45%, #e5d8ff 100%)" }}>

      {/* ── BACKGROUND ARTWORK — matching exact screenshot ── */}

      {/* Top-left subtle ambient glow */}
      <div className="fixed pointer-events-none z-0"
        style={{
          top: "-100px", left: "-100px",
          width: "450px", height: "450px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.3) 0%, rgba(196,181,253,0.15) 50%, transparent 75%)",
          filter: "blur(20px)",
        }} />

      {/* Left side translucent sphere with soft glow */}
      <div className="fixed pointer-events-none z-0"
        style={{
          top: "40%", left: "-90px", transform: "translateY(-50%)",
          width: "360px", height: "360px",
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, rgba(196,181,253,0.75) 0%, rgba(167,139,250,0.35) 45%, rgba(124,58,237,0.1) 70%, transparent 100%)",
          filter: "blur(1px)",
        }} />

      {/* Right side massive layered concentric glowing sphere (as in screenshot) */}
      <div className="fixed pointer-events-none z-0 flex items-center justify-center"
        style={{
          bottom: "-60px", right: "-120px",
          width: "540px", height: "540px",
          borderRadius: "50%",
          background: "radial-gradient(circle at 40% 40%, rgba(196,181,253,0.65) 0%, rgba(167,139,250,0.3) 45%, rgba(124,58,237,0.08) 70%, transparent 100%)",
        }}>
        <div className="w-[440px] h-[440px] rounded-full border border-purple-400/25 p-10 flex items-center justify-center">
          <div className="w-[340px] h-[340px] rounded-full border border-purple-400/30 p-10">
            <div className="w-[240px] h-[240px] rounded-full border border-purple-400/35" />
          </div>
        </div>
      </div>

      {/* Top-right dot matrix grid */}
      <div className="fixed pointer-events-none z-0"
        style={{
          top: "40px", right: "40px",
          width: "220px", height: "180px",
          backgroundImage: "radial-gradient(circle, rgba(124,58,237,0.22) 1.2px, transparent 1.2px)",
          backgroundSize: "16px 16px",
          opacity: 0.65,
        }} />

      {/* Bottom-left dot matrix grid */}
      <div className="fixed pointer-events-none z-0"
        style={{
          bottom: "40px", left: "40px",
          width: "220px", height: "180px",
          backgroundImage: "radial-gradient(circle, rgba(124,58,237,0.2) 1.2px, transparent 1.2px)",
          backgroundSize: "16px 16px",
          opacity: 0.6,
        }} />

      {/* Scattered colored accent dots (purple, green, blue) as in screenshot */}
      <div className="fixed pointer-events-none z-0 w-2.5 h-2.5 rounded-full"
        style={{ top: "35%", left: "23%", background: "#a78bfa", boxShadow: "0 0 10px rgba(167,139,250,0.5)" }} />
      <div className="fixed pointer-events-none z-0 w-2 h-2 rounded-full"
        style={{ top: "42%", right: "19%", background: "#8b5cf6" }} />
      <div className="fixed pointer-events-none z-0 w-2 h-2 rounded-full"
        style={{ bottom: "38%", left: "15%", background: "#6ee7b7" }} />
      <div className="fixed pointer-events-none z-0 w-2 h-2 rounded-full"
        style={{ bottom: "22%", right: "19%", background: "#93c5fd" }} />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: "rgba(124,58,237,0.1)", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          {view !== "home" && (
            <button onClick={() => setView("home")} className="flex items-center gap-1.5 text-sm font-medium mr-2 transition-colors" style={{ color: "#7c3aed" }}>
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-[14px] leading-none" style={{ color: "#1a1040" }}>Nexora</p>
            <p className="text-[10px]" style={{ color: "#9390b5" }}>Super Admin Portal</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          style={{ background: "rgba(239,68,68,0.07)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════
            HOME VIEW — exact match to image
        ══════════════════════════════════ */}
        {view === "home" && (
          <motion.div key="home" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-8 py-12">

            {/* ── Header ── */}
            <div className="flex flex-col items-center mb-12">
              {/* Outline shield — like image */}
              <div className="w-12 h-12 flex items-center justify-center mb-3 rounded-xl"
                style={{ background: "rgba(124,58,237,0.07)", border: "1.5px solid rgba(124,58,237,0.22)" }}>
                <ShieldCheck className="w-6 h-6" style={{ color: "#7c3aed" }} strokeWidth={1.5} />
              </div>

              {/* Big NEXORA Heading */}
              <h1 className="text-4xl sm:text-5xl font-black tracking-widest uppercase mb-2"
                style={{
                  background: "linear-gradient(135deg, #1a1040 0%, #7c3aed 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent"
                }}>
                NEXORA
              </h1>

              <p className="text-[11px] font-black tracking-[0.28em] uppercase mb-3" style={{ color: "#7c3aed" }}>
                Super Admin Portal
              </p>
              {/* "Welcome back," black + "Super Admin!" purple — exact like image */}
              <h2 className="text-[28px] sm:text-[32px] font-black text-center mb-1.5" style={{ letterSpacing: "-0.02em" }}>
                <span style={{ color: "#1a1040" }}>Welcome back, </span>
                <span style={{ color: "#7c3aed" }}>Super Admin!</span>
              </h2>
              <p className="text-[13px] mb-3" style={{ color: "#9390b5" }}>What would you like to do today?</p>
              {/* Small dot underline — like image */}
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#7c3aed" }} />
            </div>

            {/* ── 3 Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full" style={{ maxWidth: "840px" }}>

              {/* Analytics — purple */}
              <motion.button
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6, boxShadow: "0 24px 56px rgba(124,58,237,0.16)" }}
                whileTap={{ scale: 0.985 }}
                onClick={() => setView("analytics")}
                className="flex flex-col items-center text-center rounded-2xl overflow-hidden relative cursor-pointer transition-all"
                style={{
                  background: "#fff",
                  border: "1.5px solid rgba(124,58,237,0.14)",
                  boxShadow: "0 2px 20px rgba(124,58,237,0.07)",
                  padding: "36px 28px 0 28px",
                }}>
                {/* Top-left dot */}
                <div className="absolute top-4 left-4 w-1.5 h-1.5 rounded-full" style={{ background: "rgba(124,58,237,0.3)" }} />

                {/* Icon circle */}
                <div className="w-[56px] h-[56px] rounded-full flex items-center justify-center mb-5 flex-shrink-0"
                  style={{ background: "rgba(124,58,237,0.08)" }}>
                  <BarChart3 className="w-6 h-6" style={{ color: "#7c3aed" }} strokeWidth={1.5} />
                </div>

                <h2 className="text-[16px] font-black mb-2" style={{ color: "#7c3aed" }}>Analytics</h2>
                <p className="text-[12.5px] leading-relaxed mb-5" style={{ color: "#9390b5" }}>
                  View platform insights, metrics and performance analytics.
                </p>

                {/* Arrow button */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center mb-8 flex-shrink-0"
                  style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)" }}>
                  <ArrowRight className="w-4 h-4" style={{ color: "#7c3aed" }} />
                </div>

                {/* Bottom-right wavy blob — exactly like image */}
                <div className="absolute bottom-0 right-0 w-[110px] h-[90px] pointer-events-none">
                  <svg viewBox="0 0 110 90" className="w-full h-full" fill="none">
                    <path d="M110 90 C 80 90, 60 70, 50 50 C 40 30, 60 10, 80 5 C 95 0, 110 5, 110 20 Z"
                      fill="rgba(124,58,237,0.07)" />
                    <path d="M110 90 C 85 90, 70 75, 65 58 C 60 42, 72 28, 88 22 C 100 18, 110 22, 110 35 Z"
                      fill="rgba(124,58,237,0.05)" />
                    {/* Wavy lines */}
                    <path d="M55 65 Q70 55 85 65 Q100 75 110 68" stroke="rgba(124,58,237,0.15)" strokeWidth="1" fill="none" />
                    <path d="M60 75 Q75 65 90 75 Q105 85 110 78" stroke="rgba(124,58,237,0.1)" strokeWidth="1" fill="none" />
                  </svg>
                </div>
              </motion.button>

              {/* Create Organization — green */}
              <motion.button
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6, boxShadow: "0 24px 56px rgba(5,150,105,0.15)" }}
                whileTap={{ scale: 0.985 }}
                onClick={() => setShowOnboardModal(true)}
                className="flex flex-col items-center text-center rounded-2xl overflow-hidden relative cursor-pointer transition-all"
                style={{
                  background: "linear-gradient(180deg,#fff 0%,#f2fff9 100%)",
                  border: "1.5px solid rgba(5,150,105,0.18)",
                  boxShadow: "0 2px 20px rgba(5,150,105,0.07)",
                  padding: "36px 28px 0 28px",
                }}>
                <div className="absolute top-4 left-4 w-1.5 h-1.5 rounded-full" style={{ background: "rgba(5,150,105,0.35)" }} />

                <div className="w-[56px] h-[56px] rounded-full flex items-center justify-center mb-5 flex-shrink-0"
                  style={{ background: "rgba(5,150,105,0.08)" }}>
                  <Building2 className="w-6 h-6" style={{ color: "#059669" }} strokeWidth={1.5} />
                </div>

                <h2 className="text-[16px] font-black mb-2" style={{ color: "#059669" }}>Create Organization</h2>
                <p className="text-[12.5px] leading-relaxed mb-5" style={{ color: "#9390b5" }}>
                  Onboard a new organization and configure platform access.
                </p>

                <div className="w-9 h-9 rounded-full flex items-center justify-center mb-8 flex-shrink-0"
                  style={{ background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)" }}>
                  <ArrowRight className="w-4 h-4" style={{ color: "#059669" }} />
                </div>

                {/* Bottom-right wavy blob — green */}
                <div className="absolute bottom-0 right-0 w-[110px] h-[90px] pointer-events-none">
                  <svg viewBox="0 0 110 90" className="w-full h-full" fill="none">
                    <path d="M110 90 C 80 90, 60 70, 50 50 C 40 30, 60 10, 80 5 C 95 0, 110 5, 110 20 Z"
                      fill="rgba(5,150,105,0.1)" />
                    <path d="M110 90 C 85 90, 70 75, 65 58 C 60 42, 72 28, 88 22 C 100 18, 110 22, 110 35 Z"
                      fill="rgba(5,150,105,0.06)" />
                    <path d="M55 65 Q70 55 85 65 Q100 75 110 68" stroke="rgba(5,150,105,0.18)" strokeWidth="1" fill="none" />
                    <path d="M60 75 Q75 65 90 75 Q105 85 110 78" stroke="rgba(5,150,105,0.12)" strokeWidth="1" fill="none" />
                  </svg>
                </div>
              </motion.button>

              {/* Check Organizations — blue */}
              <motion.button
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6, boxShadow: "0 24px 56px rgba(59,130,246,0.15)" }}
                whileTap={{ scale: 0.985 }}
                onClick={() => setView("organizations")}
                className="flex flex-col items-center text-center rounded-2xl overflow-hidden relative cursor-pointer transition-all"
                style={{
                  background: "#fff",
                  border: "1.5px solid rgba(59,130,246,0.14)",
                  boxShadow: "0 2px 20px rgba(59,130,246,0.06)",
                  padding: "36px 28px 0 28px",
                }}>
                <div className="absolute top-4 left-4 w-1.5 h-1.5 rounded-full" style={{ background: "rgba(59,130,246,0.32)" }} />

                <div className="w-[56px] h-[56px] rounded-full flex items-center justify-center mb-5 flex-shrink-0"
                  style={{ background: "rgba(59,130,246,0.08)" }}>
                  <Users className="w-6 h-6" style={{ color: "#3b82f6" }} strokeWidth={1.5} />
                </div>

                <h2 className="text-[16px] font-black mb-2" style={{ color: "#3b82f6" }}>Check Organizations</h2>
                <p className="text-[12.5px] leading-relaxed mb-5" style={{ color: "#9390b5" }}>
                  View and manage all organizations registered on the platform.
                </p>

                <div className="w-9 h-9 rounded-full flex items-center justify-center mb-8 flex-shrink-0"
                  style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)" }}>
                  <ArrowRight className="w-4 h-4" style={{ color: "#3b82f6" }} />
                </div>

                {/* Bottom-right wavy blob — blue */}
                <div className="absolute bottom-0 right-0 w-[110px] h-[90px] pointer-events-none">
                  <svg viewBox="0 0 110 90" className="w-full h-full" fill="none">
                    <path d="M110 90 C 80 90, 60 70, 50 50 C 40 30, 60 10, 80 5 C 95 0, 110 5, 110 20 Z"
                      fill="rgba(59,130,246,0.08)" />
                    <path d="M110 90 C 85 90, 70 75, 65 58 C 60 42, 72 28, 88 22 C 100 18, 110 22, 110 35 Z"
                      fill="rgba(59,130,246,0.05)" />
                    <path d="M55 65 Q70 55 85 65 Q100 75 110 68" stroke="rgba(59,130,246,0.15)" strokeWidth="1" fill="none" />
                    <path d="M60 75 Q75 65 90 75 Q105 85 110 78" stroke="rgba(59,130,246,0.1)" strokeWidth="1" fill="none" />
                  </svg>
                </div>
              </motion.button>

            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════
            ANALYTICS VIEW — Per-Org Activity
        ══════════════════════════════════ */}
        {view === "analytics" && (
          <motion.div key="analytics" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 px-8 py-6">

            {/* Header & Controls */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
              <div>
                <p className="text-[11px] font-black tracking-[0.2em] uppercase mb-1" style={{ color: "#7c3aed" }}>Organization Activity Analytics</p>
                <h2 className="text-[28px] font-black" style={{ color: "#1a1040", letterSpacing: "-0.025em" }}>Live Usage & Operational Insights</h2>
                <p className="text-sm mt-1" style={{ color: "#9390b5" }}>Real-time breakdown of templates, campaign executions, messages sent, contacts & bots for every organization.</p>
              </div>

              <div className="flex items-center gap-3">
                {/* Search bar */}
                <div className="relative w-64">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9390b5]" />
                  <input
                    type="text"
                    placeholder="Search organization..."
                    value={analyticsSearch}
                    onChange={(e) => setAnalyticsSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-2xl text-xs font-semibold bg-white border border-[#7c3aed]/20 text-[#1a1040] placeholder:text-[#9390b5] focus:outline-none focus:border-[#7c3aed]"
                  />
                  {analyticsSearch && (
                    <button onClick={() => setAnalyticsSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9390b5] hover:text-[#1a1040]">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={fetchOrgAnalytics}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold bg-white border border-[#7c3aed]/20 text-[#7c3aed] hover:bg-[#7c3aed]/5 transition-all shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
            </div>

            {/* Loading state */}
            {analyticsLoading && orgAnalytics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 text-[#7c3aed] animate-spin mb-3" />
                <p className="text-sm font-semibold text-[#9390b5]">Loading organization analytics...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {orgAnalytics
                  .filter((org) => {
                    const q = analyticsSearch.toLowerCase().trim();
                    return !q || org.org_name.toLowerCase().includes(q) || org.org_slug.toLowerCase().includes(q);
                  })
                  .map((org, index) => {
                    const isExpanded = expandedOrg === org.org_id;

                    return (
                      <motion.div
                        key={org.org_id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm hover:shadow-md transition-all"
                      >
                        {/* Org Header Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-md" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}>
                              {org.org_name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-[#1a1040]">{org.org_name}</h3>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase ${
                                  org.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                                  org.status === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                                  "bg-rose-50 text-rose-600 border border-rose-200"
                                }`}>
                                  {org.status}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#7c3aed]/10 text-[#7c3aed]">
                                  {org.plan_name} Plan
                                </span>
                              </div>
                              <p className="text-xs text-[#9390b5] mt-0.5">
                                Slug: <span className="font-semibold text-[#1a1040]">@{org.org_slug}</span> {org.contact_email && `• ${org.contact_email}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setExpandedOrg(isExpanded ? null : org.org_id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#7c3aed] bg-[#7c3aed]/5 hover:bg-[#7c3aed]/10 transition-all"
                            >
                              {isExpanded ? (
                                <>Less Details <ChevronUp className="w-3.5 h-3.5" /></>
                              ) : (
                                <>Full Breakdown <ChevronDown className="w-3.5 h-3.5" /></>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* 5 Core Metric Highlights */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5">
                          {/* 1. Templates */}
                          <div className="rounded-2xl p-4 bg-[#faf9ff] border border-[#7c3aed]/10">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-lg bg-[#7c3aed]/10 flex items-center justify-center text-[#7c3aed]">
                                <FileText className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold text-[#1a1040]">Templates</span>
                            </div>
                            <p className="text-2xl font-black text-[#1a1040]">{org.templates_total}</p>
                            <p className="text-[11px] text-[#9390b5] mt-1">
                              <span className="text-emerald-600 font-semibold">{org.templates_approved} Approved</span> • {org.templates_pending} Pending
                            </p>
                          </div>

                          {/* 2. Campaigns */}
                          <div className="rounded-2xl p-4 bg-[#faf9ff] border border-[#7c3aed]/10">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                <Megaphone className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold text-[#1a1040]">Campaigns</span>
                            </div>
                            <p className="text-2xl font-black text-[#1a1040]">{org.campaigns_total}</p>
                            <p className="text-[11px] text-[#9390b5] mt-1">
                              <span className="text-indigo-600 font-semibold">{org.campaigns_completed} Done</span> • {org.campaigns_sending} Sending
                            </p>
                          </div>

                          {/* 3. Messages Sent */}
                          <div className="rounded-2xl p-4 bg-[#faf9ff] border border-[#7c3aed]/10">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                <MessageSquare className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold text-[#1a1040]">Outbound Msgs</span>
                            </div>
                            <p className="text-2xl font-black text-[#1a1040]">{org.messages_sent.toLocaleString()}</p>
                            <p className="text-[11px] text-[#9390b5] mt-1">Total WhatsApp Sent</p>
                          </div>

                          {/* 4. Contacts */}
                          <div className="rounded-2xl p-4 bg-[#faf9ff] border border-[#7c3aed]/10">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-600">
                                <Users className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold text-[#1a1040]">Contacts CRM</span>
                            </div>
                            <p className="text-2xl font-black text-[#1a1040]">{org.contacts_count.toLocaleString()}</p>
                            <p className="text-[11px] text-[#9390b5] mt-1">Active Leads</p>
                          </div>

                          {/* 5. Auto Replies & WABAs */}
                          <div className="rounded-2xl p-4 bg-[#faf9ff] border border-[#7c3aed]/10">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                                <Bot className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold text-[#1a1040]">Auto-Replies</span>
                            </div>
                            <p className="text-2xl font-black text-[#1a1040]">{org.auto_replies_count}</p>
                            <p className="text-[11px] text-[#9390b5] mt-1">
                              {org.whatsapp_accounts_count} WABA • {org.users_count} Users
                            </p>
                          </div>
                        </div>

                        {/* Expanded Details Panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden"
                            >
                              {/* Template Status breakdown */}
                              <div className="rounded-2xl p-4 bg-gray-50/60 border border-gray-100">
                                <h4 className="text-xs font-black uppercase tracking-wider text-[#1a1040] mb-3">Template Approval Breakdown</h4>
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-emerald-700 font-medium">Approved Templates</span>
                                    <span className="font-bold text-[#1a1040]">{org.templates_approved}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-amber-700 font-medium">Pending Review</span>
                                    <span className="font-bold text-[#1a1040]">{org.templates_pending}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-rose-700 font-medium">Rejected Templates</span>
                                    <span className="font-bold text-[#1a1040]">{org.templates_rejected}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Campaign Status breakdown */}
                              <div className="rounded-2xl p-4 bg-gray-50/60 border border-gray-100">
                                <h4 className="text-xs font-black uppercase tracking-wider text-[#1a1040] mb-3">Campaign Execution Status</h4>
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-indigo-700 font-medium">Completed Campaigns</span>
                                    <span className="font-bold text-[#1a1040]">{org.campaigns_completed}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-blue-700 font-medium">Currently Sending</span>
                                    <span className="font-bold text-[#1a1040]">{org.campaigns_sending}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-purple-700 font-medium">Scheduled</span>
                                    <span className="font-bold text-[#1a1040]">{org.campaigns_scheduled}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600 font-medium">Drafts</span>
                                    <span className="font-bold text-[#1a1040]">{org.campaigns_draft}</span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
              </div>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════
            ORGANIZATIONS VIEW
        ══════════════════════════════════ */}
        {view === "organizations" && (
          <motion.div key="organizations" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 px-8 py-6">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 6px 16px rgba(124,58,237,0.3)" }}>
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black" style={{ color: "#1a1040", letterSpacing: "-0.02em" }}>Organizations</h2>
                  <p className="text-xs mt-0.5" style={{ color: "#9390b5" }}>View and manage all organizations registered on the platform.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#b0aed0" }} />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email or slug…"
                    className="rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none"
                    style={{ background: "#fff", border: "1.5px solid #e4e0f5", color: "#1a1040", width: "230px" }} />
                </div>
                <button onClick={fetchData}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(255,255,255,0.9)", border: "1.5px solid rgba(124,58,237,0.2)", color: "#7c3aed" }}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
            </div>

            {/* Table container */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "#fff", border: "1px solid rgba(124,58,237,0.08)", boxShadow: "0 2px 16px rgba(124,58,237,0.05)" }}>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 px-5 py-3 border-b" style={{ borderColor: "#f0eeff", background: "#faf9ff" }}>
                {[["ALL", "All"], ["ACTIVE", "Active"], ["PENDING_APPROVAL", "Pending"], ["SUSPENDED", "Suspended"]].map(([val, label]) => (
                  <button key={val} onClick={() => setStatusFilter(val)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: statusFilter === val ? "rgba(124,58,237,0.09)" : "transparent", color: statusFilter === val ? "#7c3aed" : "#9390b5" }}>
                    {label}
                    <span className="ml-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                      style={{ background: statusFilter === val ? "rgba(124,58,237,0.12)" : "#f0eeff", color: "#7c3aed" }}>
                      {val === "ALL" ? organizations.length
                        : val === "ACTIVE" ? organizations.filter(o => o.status === "ACTIVE").length
                          : val === "PENDING_APPROVAL" ? organizations.filter(o => o.status === "PENDING_APPROVAL").length
                            : organizations.filter(o => o.status === "SUSPENDED").length}
                    </span>
                  </button>
                ))}
                <div className="flex-1" />
                <span className="text-[11px]" style={{ color: "#b0aed0" }}>{filteredOrganizations.length} of {organizations.length} orgs</span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead style={{ background: "#faf9ff", borderBottom: "1px solid #f0eeff" }}>
                    <tr>
                      {["Organization", "Owner", "Plan", "WhatsApp Status", "Status", "Created On", "Actions"].map(h => (
                        <th key={h} className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#b0aed0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout">
                      {filteredOrganizations.length === 0 ? (
                        <tr key="empty"><td colSpan={7} className="px-5 py-12 text-center text-sm" style={{ color: "#c0bed8" }}>No organizations found.</td></tr>
                      ) : filteredOrganizations.map((org, i) => (
                        <motion.tr key={org.id} layout
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-t transition-colors" style={{ borderColor: "#f5f3ff" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#faf9ff")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                                style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                                {org.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-[13px]" style={{ color: "#1a1040" }}>{org.name}</p>
                                <p className="text-[10px]" style={{ color: "#b0aed0" }}>{org.slug}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-[12px]" style={{ color: "#1a1040" }}>{org.contact_name || "—"}</p>
                            <p className="text-[10px]" style={{ color: "#b0aed0" }}>{org.contact_email || "—"}</p>
                          </td>

                          <td className="px-5 py-3.5">
                            <span className="px-2.5 py-1 text-[10px] font-black rounded-lg"
                              style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.12)" }}>
                              {org.plan_name === "STARTER" ? "Starter" : org.plan_name === "PRO" ? "Pro" : "Enterprise"}
                            </span>
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full"
                                style={{ background: org.status === "ACTIVE" ? "#10b981" : org.status === "SUSPENDED" ? "#ef4444" : "#f59e0b" }} />
                              <span className="text-[11px] font-medium"
                                style={{ color: org.status === "ACTIVE" ? "#059669" : org.status === "SUSPENDED" ? "#ef4444" : "#d97706" }}>
                                {org.status === "ACTIVE" ? "Connected" : org.status === "SUSPENDED" ? "Disconnected" : "Pending"}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            {org.status === "ACTIVE" && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: "rgba(5,150,105,0.08)", color: "#059669", border: "1px solid rgba(5,150,105,0.15)" }}>Active</span>}
                            {org.status === "PENDING_APPROVAL" && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: "rgba(245,158,11,0.08)", color: "#d97706", border: "1px solid rgba(245,158,11,0.15)" }}>Pending</span>}
                            {org.status === "SUSPENDED" && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>Suspended</span>}
                          </td>

                          <td className="px-5 py-3.5 text-[11px]" style={{ color: "#9390b5" }}>
                            {org.created_at ? new Date(org.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <button className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f5f4fb", color: "#9390b5" }} title="View">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {org.status === "PENDING_APPROVAL" && (
                                <button onClick={() => handleApprove(org.id)}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
                                  style={{ background: "linear-gradient(135deg,#059669,#047857)" }}>Approve</button>
                              )}
                              {org.status === "ACTIVE" && (
                                <button onClick={() => handleSuspend(org.id)}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                                  style={{ background: "rgba(239,68,68,0.07)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>Suspend</button>
                              )}
                              {org.status === "SUSPENDED" && (
                                <button onClick={() => handleReactivate(org.id)}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                                  style={{ background: "rgba(5,150,105,0.07)", color: "#059669", border: "1px solid rgba(5,150,105,0.15)" }}>Reactivate</button>
                              )}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuOrgId(activeMenuOrgId === org.id ? null : org.id);
                                  }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-purple-100/60"
                                  style={{ background: "#f5f4fb", color: "#6b6899" }}
                                  title="Actions"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>

                                {activeMenuOrgId === org.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className={`absolute right-0 ${i >= filteredOrganizations.length - 2 ? "bottom-full mb-1.5" : "top-full mt-1.5"} w-44 rounded-2xl bg-white shadow-xl border border-purple-100 z-[100] py-1 overflow-hidden`}
                                    style={{ boxShadow: "0 10px 25px -5px rgba(124,58,237,0.15)" }}
                                  >
                                    <button
                                      onClick={() => {
                                        setActiveMenuOrgId(null);
                                        handleDeleteOrg(org.id, org.name);
                                      }}
                                      className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                      Delete Organization
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Footer pagination */}
              <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "#f0eeff", background: "#faf9ff" }}>
                <span className="text-[11px]" style={{ color: "#b0aed0" }}>
                  Showing 1 to {filteredOrganizations.length} of {organizations.length} organizations
                </span>
                <div className="flex items-center gap-1.5">
                  <button className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: "#f0eeff", color: "#9390b5" }}>‹</button>
                  <button className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#fff" }}>1</button>
                  <button className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: "#f0eeff", color: "#9390b5" }}>›</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Onboard Modal ══ */}
      <AnimatePresence>
        {showOnboardModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(26,16,64,0.4)", backdropFilter: "blur(6px)" }}>
            <motion.div initial={{ scale: 0.93, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.93, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="w-full max-w-md rounded-3xl p-7 shadow-2xl"
              style={{ background: "#fff", border: "1px solid #ece9f8" }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black" style={{ color: "#1a1040" }}>Onboard New Organization</h3>
                  <p className="text-xs" style={{ color: "#9390b5" }}>Set up platform access for a new client</p>
                </div>
              </div>
              <form onSubmit={handleOnboardSubmit} className="space-y-3.5">
                {[
                  { label: "Organization Name", value: name, onChange: setName, placeholder: "Acme Corp", type: "text" },
                  { label: "Organization Slug", value: slug, onChange: setSlug, placeholder: "acme-corp", type: "text" },
                  { label: "Contact Person Name", value: contactName, onChange: setContactName, placeholder: "John Doe", type: "text" },
                  { label: "Contact Email", value: contactEmail, onChange: setContactEmail, placeholder: "john@acme.com", type: "email" },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4a4568" }}>{f.label}</label>
                    <input type={f.type} required value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder} className={inp} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4a4568" }}>Subscription Plan</label>
                  <select value={planName} onChange={e => setPlanName(e.target.value)} className={inp}>
                    <option value="STARTER">STARTER</option>
                    <option value="PRO">PRO</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowOnboardModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}>Cancel</button>
                  <button type="submit" disabled={submitLoading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
                    {submitLoading ? "Submitting…" : "Submit Onboarding"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Credentials Modal ══ */}
      <AnimatePresence>
        {showCredentialsModal && credentials && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(26,16,64,0.4)", backdropFilter: "blur(6px)" }}>
            <motion.div initial={{ scale: 0.93, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.93, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="w-full max-w-md rounded-3xl p-7 shadow-2xl"
              style={{ background: "#fff", border: "1px solid #bbf7d0" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(5,150,105,0.1)" }}>
                  <CheckCircle2 className="w-5 h-5" style={{ color: "#059669" }} />
                </div>
                <div>
                  <h3 className="text-lg font-black" style={{ color: "#1a1040" }}>Credentials Provisioned</h3>
                  <p className="text-xs" style={{ color: "#9390b5" }}>
                    {credentials.emailSent
                      ? `Credentials sent to ${credentials.email}`
                      : credentials.emailError
                      ? `Approved, but could not email credentials`
                      : `Organization approved successfully`}
                  </p>
                </div>
              </div>
              <p className="text-xs mb-4 font-medium" style={{ color: credentials.emailSent ? "#059669" : credentials.emailError ? "#d97706" : "#6b6899" }}>
                {credentials.emailSent
                  ? `An automated email with login credentials has been sent to ${credentials.email}.`
                  : credentials.emailError
                  ? `SMTP status: ${credentials.emailError}. You can copy credentials below.`
                  : `Share these login credentials with the organization admin.`}
              </p>

              <div className="rounded-2xl p-4 mb-5 space-y-2.5" style={{ background: "#f9f8ff", border: "1px solid #ece9f8" }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold" style={{ color: "#9390b5" }}>Email</span>
                  <span className="text-sm font-bold" style={{ color: "#1a1040" }}>{credentials.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold" style={{ color: "#9390b5" }}>Temp Password</span>
                  <span className="text-sm font-black" style={{ color: "#7c3aed" }}>{credentials.pass}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={copyCredentials}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Credentials"}
                </button>
                <button onClick={() => setShowCredentialsModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
