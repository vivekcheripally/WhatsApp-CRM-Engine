"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MessageSquare,
  Megaphone,
  Clock,
  Users,
  FileText,
  Activity,
  History,
  TrendingUp,
  Inbox,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import api from "@/lib/api";
import { ActivityReportsTab } from "@/components/reports/ActivityReportsTab";
import { useWabaContext } from "@/context/WabaContext";

/* ── Animation helper ── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.4,
    delay,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },
});

/* ── Custom Chart Tooltip ── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md border border-[#7c3aed]/15 rounded-xl p-3 shadow-xl">
      {label && (
        <p className="text-[11px] font-bold text-[#9390b5] uppercase tracking-wider mb-2">
          {label}
        </p>
      )}
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-xs mb-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color || entry.fill }}
          />
          <span className="text-[#4b4880] font-medium">{entry.name}:</span>
          <span className="font-black text-[#1a1040]">
            {typeof entry.value === "number"
              ? entry.value.toLocaleString()
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const { activeChannel } = useWabaContext();
  const [activeTab, setActiveTab] = useState<
    "overview" | "inbox" | "campaigns" | "agents" | "templates" | "activity"
  >("overview");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("7d");

  const [analytics, setAnalytics] = useState<any>(null);
  const [summary, setSummary] = useState<any>({});
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateOverview, setTemplateOverview] = useState<any>({});
  const [agents, setAgents] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sync tab from URL query param if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (
        tab &&
        [
          "overview",
          "inbox",
          "campaigns",
          "agents",
          "templates",
          "activity",
        ].includes(tab)
      ) {
        setActiveTab(tab as any);
      }
    }
  }, []);

  const loadData = async (showRefresh = false, rangeOverride?: "7d" | "30d" | "90d") => {
    const currentRange = rangeOverride || timeRange;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        analyticsRes,
        dashRes,
        campRes,
        tmplRes,
        tmplOverviewRes,
        agentRes,
        convRes,
      ] = await Promise.allSettled([
        api.get(`/api/dashboard/analytics?range=${currentRange}`),
        api.get("/api/dashboard"),
        api.get("/api/campaign/list"),
        api.get("/api/templates/list"),
        api.get("/api/dashboard/template-overview"),
        api.get("/api/users/agents"),
        api.get("/api/conversations"),
      ]);

      if (analyticsRes.status === "fulfilled" && analyticsRes.value.data) {
        const a = analyticsRes.value.data;
        setAnalytics(a);
        if (a.summary) setSummary(a.summary);
        if (a.templates) setTemplateOverview(a.templates);
        if (a.campaigns) setCampaigns(a.campaigns);
        if (a.agents) setAgents(a.agents);
      } else if (dashRes.status === "fulfilled") {
        const d = dashRes.value.data;
        setSummary(d?.summary || {});
        if (d?.templates) setTemplateOverview(d.templates);
      }

      if (campRes.status === "fulfilled") {
        const cData = campRes.value.data;
        const cList = Array.isArray(cData) ? cData : cData?.campaigns || [];
        if (cList.length > 0 || !analyticsRes.value?.data?.campaigns?.length) {
          setCampaigns(cList);
        }
      }

      if (tmplRes.status === "fulfilled") {
        const tData = tmplRes.value.data;
        setTemplates(Array.isArray(tData) ? tData : tData?.templates || []);
      }

      if (tmplOverviewRes.status === "fulfilled") {
        const toData = tmplOverviewRes.value.data;
        if (toData) setTemplateOverview(toData);
      }

      if (agentRes.status === "fulfilled") {
        const aData = agentRes.value.data;
        const aList = Array.isArray(aData) ? aData : aData?.agents || aData?.items || [];
        if (aList.length > 0 || !analyticsRes.value?.data?.agents?.length) {
          setAgents(aList);
        }
      }

      if (convRes.status === "fulfilled") {
        const cvData = convRes.value.data;
        setConversations(
          Array.isArray(cvData)
            ? cvData
            : cvData?.items || cvData?.conversations || []
        );
      }
    } catch (err) {
      console.error("Failed to load live reports data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeChannel?.id, timeRange]);

  /* ── Computed Live Metrics & Data ── */

  // Message Metrics (Directly from verified backend analytics)
  const totalSent =
    Number(analytics?.summary?.outbound_sent ?? summary?.outbound_sent ?? summary?.sent ?? summary?.total_messages ?? 0);
  const totalDelivered = Number(analytics?.summary?.delivered ?? summary?.delivered ?? 0);
  const totalRead = Number(analytics?.summary?.read ?? summary?.read ?? 0);
  const totalFailed = Number(analytics?.summary?.failed ?? summary?.failed ?? 0);

  // Inbox & Conversation Metrics
  const totalConversations = analytics?.inbox?.total ?? conversations.length;
  const openConvs =
    analytics?.inbox?.open ??
    conversations.filter(
      (c) =>
        (c.status || "").toUpperCase() === "OPEN" ||
        (c.status || "").toUpperCase() === "ACTIVE"
    ).length;
  const pendingConvs =
    analytics?.inbox?.pending ??
    conversations.filter(
      (c) => (c.status || "").toUpperCase() === "PENDING"
    ).length;
  const resolvedConvs =
    analytics?.inbox?.resolved ??
    conversations.filter(
      (c) =>
        (c.status || "").toUpperCase() === "RESOLVED" ||
        (c.status || "").toUpperCase() === "CLOSED"
    ).length;

  // Recharts Data — Message Trends Over Time (100% Real Time-Series)
  const messageTrendData = useMemo(() => {
    if (analytics?.trends && Array.isArray(analytics.trends) && analytics.trends.length > 0) {
      return analytics.trends;
    }

    let days: string[] = [];
    if (timeRange === "7d") {
      days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    } else if (timeRange === "30d") {
      days = ["Week 1", "Week 2", "Week 3", "Week 4"];
    } else {
      days = ["Month 1", "Month 2", "Month 3"];
    }

    return days.map((day) => ({
      day,
      Sent: 0,
      Delivered: 0,
      Read: 0,
      Failed: 0,
    }));
  }, [analytics?.trends, timeRange]);

  // Recharts Data — Inbox Status Pie Chart
  const inboxPieData = useMemo(() => {
    const hasData = openConvs > 0 || pendingConvs > 0 || resolvedConvs > 0;
    if (!hasData) {
      return [{ name: "No Conversations", value: 1, color: "#e2e8f0" }];
    }
    return [
      { name: "Resolved", value: resolvedConvs, color: "#10b981" },
      { name: "Open", value: openConvs, color: "#7c3aed" },
      { name: "Pending", value: pendingConvs, color: "#f59e0b" },
    ].filter((item) => item.value > 0);
  }, [resolvedConvs, openConvs, pendingConvs]);

  // Recharts Data — Message / Template Category Distribution
  const messageTypeData = useMemo(() => {
    if (analytics?.category_distribution && Array.isArray(analytics.category_distribution)) {
      return analytics.category_distribution;
    }

    let marketing = 0;
    let utility = 0;
    let auth = 0;
    let service = 0;

    templates.forEach((t) => {
      const cat = (t.category || "").toUpperCase();
      if (cat.includes("MARKETING")) marketing++;
      else if (cat.includes("UTILITY")) utility++;
      else if (cat.includes("AUTH")) auth++;
      else service++;
    });

    const total = marketing + utility + auth + service;
    if (total === 0) {
      return [
        { name: "Marketing", value: 0, color: "#7c3aed", count: 0 },
        { name: "Utility", value: 0, color: "#3b82f6", count: 0 },
        { name: "Authentication", value: 0, color: "#10b981", count: 0 },
        { name: "Service & Support", value: 0, color: "#f59e0b", count: 0 },
      ];
    }

    return [
      {
        name: "Marketing",
        value: Math.round((marketing / total) * 100),
        color: "#7c3aed",
        count: marketing,
      },
      {
        name: "Utility",
        value: Math.round((utility / total) * 100),
        color: "#3b82f6",
        count: utility,
      },
      {
        name: "Authentication",
        value: Math.round((auth / total) * 100),
        color: "#10b981",
        count: auth,
      },
      {
        name: "Service & Support",
        value: Math.round((service / total) * 100),
        color: "#f59e0b",
        count: service,
      },
    ];
  }, [analytics?.category_distribution, templates]);

  // Recharts Data — Campaign Reach Bar Chart
  const campaignBarData = useMemo(() => {
    return campaigns.slice(0, 6).map((c) => ({
      name: (c.campaign_name || c.name || "Campaign").slice(0, 14),
      Recipients: c.total_recipients || c.total || c.recipients || c.contact_count || 0,
      Delivered: c.delivered_count || c.delivered || 0,
      Read: c.read_count || c.read || 0,
    }));
  }, [campaigns]);

  // Recharts Data — Sales Agents Leaderboard
  const agentPerformanceData = useMemo(() => {
    if (analytics?.agents && Array.isArray(analytics.agents) && analytics.agents.length > 0) {
      return analytics.agents;
    }

    return agents.map((ag) => {
      const assigned = conversations.filter(
        (c) => c.assignee_id === ag.id || c.assigned_agent_id === ag.id
      ).length;
      const resolved = conversations.filter(
        (c) =>
          (c.assignee_id === ag.id || c.assigned_agent_id === ag.id) &&
          ((c.status || "").toUpperCase() === "RESOLVED" ||
            (c.status || "").toUpperCase() === "CLOSED")
      ).length;

      return {
        id: ag.id,
        name: ag.full_name || ag.email?.split("@")[0] || "Agent",
        email: ag.email,
        Conversations: assigned,
        Resolved: resolved,
        ResponseMin: assigned > 0 ? "1.2" : "0.0",
      };
    });
  }, [analytics?.agents, agents, conversations]);

  // Template Status breakdown
  const tmplApproved =
    analytics?.templates?.approved ??
    templateOverview?.approved ??
    templates.filter((t) => (t.status || "").toUpperCase() === "APPROVED").length;
  const tmplPending =
    analytics?.templates?.pending ??
    templateOverview?.pending ??
    templates.filter((t) =>
      ["PENDING", "PENDING_REVIEW", "IN_APPEAL"].includes(
        (t.status || "").toUpperCase()
      )
    ).length;
  const tmplRejected =
    analytics?.templates?.rejected ??
    templateOverview?.rejected ??
    templates.filter((t) =>
      ["REJECTED", "PAUSED", "DISABLED"].includes(
        (t.status || "").toUpperCase()
      )
    ).length;

  return (
    <div className="min-h-screen bg-[#f5f4fb] p-6 lg:p-8">
      {/* ── Page Header & Controls ── */}
      <motion.div
        {...fadeUp(0)}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#1a1040] tracking-tight">
              Reports & Intelligence
            </h1>
          </div>
          <p className="text-xs text-[#9390b5] mt-1">
            Unified operational reporting across all channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-[#7c3aed]/15 rounded-xl p-1 shadow-sm">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setTimeRange(r);
                  loadData(false, r);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  timeRange === r
                    ? "bg-[#7c3aed] text-white shadow-sm"
                    : "text-[#6b5f99] hover:text-[#1a1040]"
                }`}
              >
                {r === "7d" ? "7d" : r === "30d" ? "30d" : "90d"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadData(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#7c3aed]/15 text-[#7c3aed] hover:bg-[#7c3aed]/5 transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </button>
        </div>
      </motion.div>

      {/* ── Executive Overview KPI Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <motion.div
          {...fadeUp(0.05)}
          className="rounded-3xl p-5 bg-white border border-[#7c3aed]/10 shadow-sm"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#7c3aed]/10 flex items-center justify-center text-[#7c3aed] mb-3">
            <Send className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-[#1a1040]">
            {totalSent.toLocaleString()}
          </p>
          <p className="text-xs font-semibold text-[#9390b5] mt-1">
            Outbound Sent
          </p>
        </motion.div>

        <motion.div
          {...fadeUp(0.1)}
          className="rounded-3xl p-5 bg-white border border-[#7c3aed]/10 shadow-sm"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-3">
            <MessageSquare className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-[#1a1040]">
            {totalConversations.toLocaleString()}
          </p>
          <p className="text-xs font-semibold text-[#9390b5] mt-1">
            Inbox Conversations
          </p>
        </motion.div>

        <motion.div
          {...fadeUp(0.15)}
          className="rounded-3xl p-5 bg-white border border-[#7c3aed]/10 shadow-sm"
        >
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-3">
            <Megaphone className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-[#1a1040]">
            {analytics?.summary?.active_campaigns ?? campaigns.length}
          </p>
          <p className="text-xs font-semibold text-[#9390b5] mt-1">
            Active Campaigns
          </p>
        </motion.div>

        <motion.div
          {...fadeUp(0.2)}
          className="rounded-3xl p-5 bg-white border border-[#7c3aed]/10 shadow-sm"
        >
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 mb-3">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-[#1a1040]">{analytics?.summary?.active_agents ?? agents.length}</p>
          <p className="text-xs font-semibold text-[#9390b5] mt-1">
            Active Sales Agents
          </p>
        </motion.div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-[#7c3aed]/15 mb-6 pb-2 overflow-x-auto">
        {[
          { id: "overview", label: "Overview & Trends", icon: Activity },
          { id: "inbox", label: "Inbox Analytics", icon: MessageSquare },
          { id: "campaigns", label: "Campaign Reports", icon: Megaphone },
          { id: "agents", label: "Sales Agents Performance", icon: Users },
          { id: "templates", label: "Templates & Automations", icon: FileText },
          { id: "activity", label: "Recent Activity", icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-[#7c3aed] text-white shadow-md shadow-[#7c3aed]/20"
                  : "text-[#6b5f99] hover:bg-[#7c3aed]/5 hover:text-[#1a1040]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW & TRENDS ── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              {...fadeUp(0.1)}
              className="lg:col-span-2 rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-black text-[#1a1040]">
                    Message Delivery & Engagement Trends
                  </h3>
                  <p className="text-xs text-[#9390b5]">
                    Real-time comparison of sent, delivered, read, and failed
                    messages.
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#7c3aed]/10 text-[#7c3aed]">
                  Live Sync
                </span>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={messageTrendData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#7c3aed"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#7c3aed"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorDelivered"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10b981"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10b981"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0eeff"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#9390b5", fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#9390b5", fontSize: 11 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="Sent"
                      stroke="#7c3aed"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorSent)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Delivered"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorDelivered)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div
              {...fadeUp(0.15)}
              className="rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm flex flex-col justify-between"
            >
              <div>
                <h3 className="text-base font-black text-[#1a1040]">
                  Template Category Distribution
                </h3>
                <p className="text-xs text-[#9390b5] mb-4">
                  Distribution of approved & configured template types.
                </p>

                <div className="h-[190px] w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={messageTypeData}
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {messageTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center pointer-events-none">
                    <span className="text-xl font-black text-[#1a1040]">
                      {templates.length}
                    </span>
                    <span className="text-[10px] text-[#9390b5] font-semibold">
                      Templates
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-2 pt-3 border-t border-gray-100">
                {messageTypeData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[#6b5f99] font-medium">
                        {item.name}
                      </span>
                    </div>
                    <span className="font-bold text-[#1a1040]">
                      {item.count} ({item.value}%)
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* ── TAB 2: INBOX ANALYTICS ── */}
      {activeTab === "inbox" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              {...fadeUp(0.1)}
              className="rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm flex flex-col justify-between"
            >
              <div>
                <h3 className="text-base font-black text-[#1a1040]">
                  Conversation Status
                </h3>
                <p className="text-xs text-[#9390b5] mb-4">
                  Live state of customer inbox conversations.
                </p>

                <div className="h-[200px] w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={inboxPieData}
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {inboxPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-[#6b5f99] font-medium">
                      Resolved Conversations
                    </span>
                  </div>
                  <span className="font-bold text-[#1a1040]">
                    {resolvedConvs}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed]" />
                    <span className="text-[#6b5f99] font-medium">
                      Open Conversations
                    </span>
                  </div>
                  <span className="font-bold text-[#1a1040]">{openConvs}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-[#6b5f99] font-medium">
                      Pending Conversations
                    </span>
                  </div>
                  <span className="font-bold text-[#1a1040]">
                    {pendingConvs}
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div
              {...fadeUp(0.15)}
              className="lg:col-span-2 rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm"
            >
              <h3 className="text-base font-black text-[#1a1040] mb-1">
                Inbox SLA & Customer Response Metrics
              </h3>
              <p className="text-xs text-[#9390b5] mb-6">
                Calculated response speeds and customer resolution times.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="rounded-2xl p-4 bg-[#faf9ff] border border-[#7c3aed]/10">
                  <span className="text-xs font-semibold text-[#9390b5]">
                    Open Queues
                  </span>
                  <p className="text-2xl font-black text-[#7c3aed] mt-1">
                    {openConvs}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    Active discussions
                  </span>
                </div>

                <div className="rounded-2xl p-4 bg-[#faf9ff] border border-[#7c3aed]/10">
                  <span className="text-xs font-semibold text-[#9390b5]">
                    Resolved Total
                  </span>
                  <p className="text-2xl font-black text-emerald-600 mt-1">
                    {resolvedConvs}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    {totalConversations > 0
                      ? `${Math.round(
                          (resolvedConvs / totalConversations) * 100
                        )}% resolution rate`
                      : "No chats yet"}
                  </span>
                </div>

                <div className="rounded-2xl p-4 bg-[#faf9ff] border border-[#7c3aed]/10">
                  <span className="text-xs font-semibold text-[#9390b5]">
                    Pending Followup
                  </span>
                  <p className="text-2xl font-black text-amber-600 mt-1">
                    {pendingConvs}
                  </p>
                  <span className="text-[10px] text-amber-600 font-bold">
                    Awaiting agent action
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-[#1a1040] uppercase tracking-wider">
                  Conversation Status Distribution
                </h4>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{
                      width: `${
                        totalConversations > 0
                          ? (resolvedConvs / totalConversations) * 100
                          : 0
                      }%`,
                    }}
                    title={`Resolved (${resolvedConvs})`}
                  />
                  <div
                    className="bg-[#7c3aed] h-full transition-all"
                    style={{
                      width: `${
                        totalConversations > 0
                          ? (openConvs / totalConversations) * 100
                          : 0
                      }%`,
                    }}
                    title={`Open (${openConvs})`}
                  />
                  <div
                    className="bg-amber-500 h-full transition-all"
                    style={{
                      width: `${
                        totalConversations > 0
                          ? (pendingConvs / totalConversations) * 100
                          : 0
                      }%`,
                    }}
                    title={`Pending (${pendingConvs})`}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[#6b5f99] font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />{" "}
                    Resolved ({resolvedConvs})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#7c3aed]" /> Open
                    ({openConvs})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />{" "}
                    Pending ({pendingConvs})
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* ── TAB 3: CAMPAIGN REPORTS ── */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          <motion.div
            {...fadeUp(0.1)}
            className="rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-[#1a1040]">
                  Campaign Audience Reach & Performance
                </h3>
                <p className="text-xs text-[#9390b5]">
                  WhatsApp marketing campaigns by recipient volume, delivery,
                  and read metrics.
                </p>
              </div>
              <span className="text-xs font-bold text-[#7c3aed] bg-[#7c3aed]/10 px-3 py-1 rounded-xl">
                {campaigns.length} Campaigns Total
              </span>
            </div>

            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#7c3aed]/10 text-[#7c3aed] flex items-center justify-center mb-3">
                  <Megaphone className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-[#1a1040] mb-1">
                  No Campaigns Launched Yet
                </h4>
                <p className="text-xs text-[#9390b5] max-w-sm mb-4">
                  Create and schedule a broadcast campaign to view audience
                  delivery and read statistics here.
                </p>
                <Link
                  href="/campaigns"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#7c3aed] hover:bg-[#6d28d9] transition-all shadow-md shadow-[#7c3aed]/20"
                >
                  Create Campaign <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={campaignBarData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0eeff"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#9390b5", fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#9390b5", fontSize: 11 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="Recipients"
                      fill="#7c3aed"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="Delivered"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="Read"
                      fill="#06b6d4"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ── TAB 4: SALES AGENTS PERFORMANCE ── */}
      {activeTab === "agents" && (
        <div className="space-y-6">
          {agents.length === 0 ? (
            <motion.div
              {...fadeUp(0.1)}
              className="rounded-3xl p-12 bg-white border border-[#7c3aed]/12 shadow-sm text-center flex flex-col items-center justify-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center mb-3">
                <Users className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-[#1a1040] mb-1">
                No Sales Agents Onboarded
              </h4>
              <p className="text-xs text-[#9390b5] max-w-sm mb-4">
                Onboard team members and sales agents to assign WhatsApp
                channels, manage conversations, and track performance.
              </p>
              <Link
                href="/agents"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#7c3aed] hover:bg-[#6d28d9] transition-all shadow-md shadow-[#7c3aed]/20"
              >
                Manage Sales Agents <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <motion.div
                {...fadeUp(0.1)}
                className="lg:col-span-2 rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm"
              >
                <h3 className="text-base font-black text-[#1a1040] mb-1">
                  Agent Workload & Resolution Leaderboard
                </h3>
                <p className="text-xs text-[#9390b5] mb-4">
                  Assigned conversations vs successfully resolved per sales
                  agent.
                </p>

                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={agentPerformanceData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0eeff"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#9390b5", fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#9390b5", fontSize: 11 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="Conversations"
                        fill="#7c3aed"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="Resolved"
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div
                {...fadeUp(0.15)}
                className="rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-base font-black text-[#1a1040] mb-1">
                    Agent Speed SLA
                  </h3>
                  <p className="text-xs text-[#9390b5] mb-4">
                    Active team roster & handling status.
                  </p>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {agentPerformanceData.map((ag) => (
                      <div
                        key={ag.id || ag.name}
                        className="p-3 rounded-2xl bg-[#faf9ff] border border-[#7c3aed]/10 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#7c3aed]/10 text-[#7c3aed] font-black flex items-center justify-center text-xs">
                            {ag.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-[#1a1040]">{ag.name}</p>
                            <p className="text-[10px] text-[#9390b5]">
                              {ag.Conversations} chats assigned
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-600 block">
                            {ag.Resolved} resolved
                          </span>
                          <span className="text-[10px] text-[#9390b5]">
                            {ag.Conversations > 0 ? "Active" : "Ready"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: TEMPLATES & AUTOMATIONS ── */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              {...fadeUp(0.1)}
              className="rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-3xl font-black text-[#1a1040]">
                {tmplApproved}
              </p>
              <p className="text-xs font-bold text-[#9390b5] mt-1">
                Approved Templates
              </p>
              <p className="text-[11px] text-emerald-600 mt-2 font-medium">
                Ready for immediate campaign use
              </p>
            </motion.div>

            <motion.div
              {...fadeUp(0.15)}
              className="rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <p className="text-3xl font-black text-[#1a1040]">{tmplPending}</p>
              <p className="text-xs font-bold text-[#9390b5] mt-1">
                Pending Meta Approval
              </p>
              <p className="text-[11px] text-amber-600 mt-2 font-medium">
                Under review by Meta team
              </p>
            </motion.div>

            <motion.div
              {...fadeUp(0.2)}
              className="rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <XCircle className="w-6 h-6" />
              </div>
              <p className="text-3xl font-black text-[#1a1040]">
                {tmplRejected}
              </p>
              <p className="text-xs font-bold text-[#9390b5] mt-1">
                Rejected Templates
              </p>
              <p className="text-[11px] text-rose-600 mt-2 font-medium">
                Requires category or text edits
              </p>
            </motion.div>
          </div>

          {/* Templates Catalog Quick Table */}
          {templates.length > 0 && (
            <motion.div
              {...fadeUp(0.25)}
              className="rounded-3xl p-6 bg-white border border-[#7c3aed]/12 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-black text-[#1a1040]">
                    Configured Templates
                  </h3>
                  <p className="text-xs text-[#9390b5]">
                    Catalog of sync status with Meta WhatsApp Cloud API.
                  </p>
                </div>
                <Link
                  href="/templates"
                  className="text-xs font-bold text-[#7c3aed] hover:underline flex items-center gap-1"
                >
                  Manage Templates <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#7c3aed]/10 text-[#9390b5] uppercase text-[10px] font-bold">
                      <th className="pb-3">Template Name</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Language</th>
                      <th className="pb-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#7c3aed]/5">
                    {templates.slice(0, 6).map((t: any) => (
                      <tr key={t.id || t.template_name} className="hover:bg-[#faf9ff]">
                        <td className="py-3 font-semibold text-[#1a1040]">
                          {t.template_name || t.name}
                        </td>
                        <td className="py-3 text-[#6b5f99]">
                          {t.category || "MARKETING"}
                        </td>
                        <td className="py-3 text-[#9390b5]">
                          {t.language || t.language_code || "en_US"}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                              (t.status || "").toUpperCase() === "APPROVED"
                                ? "bg-emerald-50 text-emerald-600"
                                : (t.status || "").toUpperCase() === "REJECTED"
                                ? "bg-rose-50 text-rose-600"
                                : "bg-amber-50 text-amber-600"
                            }`}
                          >
                            {t.status || "PENDING"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ── TAB 6: RECENT ACTIVITY ── */}
      {activeTab === "activity" && <ActivityReportsTab />}
    </div>
  );
}
