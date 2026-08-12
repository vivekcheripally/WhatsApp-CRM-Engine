"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  Smartphone,
  Send,
  X,
  Shield,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Filter,
  Edit3,
  Trash2,
} from "lucide-react";
import { useAgents } from "@/hooks/use-agents";
import { useWabaContext } from "@/context/WabaContext";
import { useBroadcasts } from "@/hooks/use-broadcasts";
import { getInitials } from "@/lib/utils";
import { RoleGuard } from "@/components/auth/RoleGuard";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #ece9f8",
  borderRadius: "16px",
  boxShadow: "0 1px 6px rgba(100,80,200,0.07)",
};

export default function AgentsPage() {
  const {
    agents,
    isLoading,
    onboardAgent,
    updateAgent,
    toggleStatus,
    deleteAgent,
    assignChannels,
    assignCampaigns,
    refetch,
  } = useAgents();
  const { channels } = useWabaContext();
  const { data: campaignsData } = useBroadcasts();
  const campaigns = campaignsData || [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modal States
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [selectedAgentForChannels, setSelectedAgentForChannels] = useState<any | null>(null);
  const [selectedAgentForCampaigns, setSelectedAgentForCampaigns] = useState<any | null>(null);

  // Form States
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [onboardLoading, setOnboardLoading] = useState(false);

  // Edit Agent Form States
  const [editFullName, setEditFullName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editLoading, setEditLoading] = useState(false);

  // Assignment Modal Checkbox States
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // Filter logic
  const filteredAgents = agents.filter((a) => {
    const matchesSearch =
      (a.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || (a.status || "ACTIVE").toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredAgents.length / pageSize) || 1;
  const paginatedAgents = filteredAgents.slice((page - 1) * pageSize, page * pageSize);

  // Onboard Agent Submit
  const formatError = (err: any, fallback: string) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
    }
    if (typeof detail === "object" && detail !== null) {
      return JSON.stringify(detail);
    }
    return err.message || fallback;
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardLoading(true);
    try {
      await onboardAgent({
        email,
        password,
        full_name: fullName,
      });
      setShowOnboardModal(false);
      setFullName("");
      setEmail("");
      setPassword("");
      refetch();
    } catch (err: any) {
      alert(formatError(err, "Failed to onboard Sales Agent"));
    } finally {
      setOnboardLoading(false);
    }
  };

  // Edit Agent Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;
    setEditLoading(true);
    try {
      await updateAgent({
        agentId: editingAgent.id,
        payload: {
          full_name: editFullName,
          password: editPassword || undefined,
          status: editStatus,
        },
      });
      setEditingAgent(null);
      refetch();
    } catch (err: any) {
      alert(formatError(err, "Failed to update Sales Agent"));
    } finally {
      setEditLoading(false);
    }
  };

  // Toggle Active / Inactive Status
  const handleToggleStatus = async (agent: any) => {
    try {
      await toggleStatus(agent.id);
      refetch();
    } catch (err: any) {
      alert(formatError(err, "Failed to toggle Sales Agent status"));
    }
  };

  // Permanently Delete Agent from Database
  const handleDeleteAgent = async (agent: any) => {
    if (
      !confirm(
        `Are you sure you want to PERMANENTLY DELETE sales agent "${agent.full_name || agent.email}"?\n\nThis will permanently delete the agent account from the database. This action cannot be undone.`
      )
    )
      return;
    try {
      await deleteAgent(agent.id);
      refetch();
    } catch (err: any) {
      alert(formatError(err, "Failed to delete Sales Agent"));
    }
  };

  // Channel Assignment Submit
  const handleAssignChannelsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForChannels) return;
    setAssignLoading(true);
    try {
      await assignChannels({
        agentId: selectedAgentForChannels.id,
        channelIds: selectedChannelIds,
      });
      setSelectedAgentForChannels(null);
      refetch();
    } catch (err: any) {
      alert(formatError(err, "Failed to update channel assignments"));
    } finally {
      setAssignLoading(false);
    }
  };

  // Campaign Assignment Submit
  const handleAssignCampaignsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForCampaigns) return;
    setAssignLoading(true);
    try {
      await assignCampaigns({
        agentId: selectedAgentForCampaigns.id,
        campaignIds: selectedCampaignIds,
      });
      setSelectedAgentForCampaigns(null);
      refetch();
    } catch (err: any) {
      alert(formatError(err, "Failed to update campaign assignments"));
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <RoleGuard role={["ORG_ADMIN"]}>
      <div className="min-h-screen space-y-5 animate-fade-up" style={{ padding: "24px" }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "#1a1040" }}>
              Sales Agent Management
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#9390b5" }}>
              Onboard sales agents, manage WABA channel access, and delegate broadcast campaigns.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowOnboardModal(true)}
            className="flex items-center gap-2 text-sm font-semibold rounded-xl px-5 py-2.5 text-white transition-all shadow-lg hover:opacity-90"
            style={{
              background: "linear-gradient(90deg,#7c3aed,#4f46e5)",
              boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
            }}
          >
            <UserPlus size={16} />
            Onboard Sales Agent
          </button>
        </div>

        {/* Filters & Search */}
        <div style={cardStyle} className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#b0b3c6" }} />
            <input
              type="text"
              placeholder="Search by agent name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl focus:outline-none"
              style={{ background: "#f5f6fa", border: "1.5px solid #e8eaf0", color: "#1a1d23" }}
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" style={{ color: "#7c3aed" }} />
              <span className="text-xs font-semibold" style={{ color: "#4b4f6b" }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs font-medium rounded-xl focus:outline-none cursor-pointer"
                style={{ background: "#f5f6fa", border: "1.5px solid #e8eaf0", color: "#1a1d23" }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Datatable */}
        <div style={cardStyle} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead
                className="text-xs uppercase font-semibold border-b"
                style={{ background: "#f8f7fd", borderBottomColor: "#ece9f8", color: "#6b6795" }}
              >
                <tr>
                  <th className="px-6 py-4">Agent Name & Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">WABA Channels</th>
                  <th className="px-6 py-4">Assigned Campaigns</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece9f8]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-xs" style={{ color: "#9390b5" }}>
                      Loading Sales Agents…
                    </td>
                  </tr>
                ) : paginatedAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-xs" style={{ color: "#9390b5" }}>
                      No Sales Agents found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedAgents.map((agent) => {
                    const channelCount =
                      agent.assigned_channels_count ??
                      (agent.assigned_channel_ids || agent.assigned_channels || []).length;
                    const campaignCount =
                      agent.assigned_campaigns_count ??
                      (agent.assigned_campaign_ids || agent.assigned_campaigns || []).length;
                    return (
                      <tr key={agent.id} className="hover:bg-[#f9f8fe] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex items-center justify-center w-9 h-9 rounded-full text-white text-xs font-bold flex-shrink-0"
                              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
                            >
                              {getInitials(agent.full_name || agent.email)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm" style={{ color: "#1a1040" }}>
                                {agent.full_name || agent.email.split("@")[0]}
                              </p>
                              <p className="text-xs" style={{ color: "#9390b5" }}>
                                {agent.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ background: "#f0eeff", color: "#7c3aed" }}
                          >
                            <Shield className="w-3 h-3" />
                            SALES_AGENT
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {(agent.status || "ACTIVE").toUpperCase() === "ACTIVE" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5" />
                              Inactive
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAgentForChannels(agent);
                              setSelectedChannelIds(
                                agent.assigned_channel_ids || agent.assigned_channels || []
                              );
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border hover:bg-purple-50"
                            style={{ borderColor: "#ece9f8", color: "#7c3aed" }}
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>{channelCount} Assigned</span>
                          </button>
                        </td>

                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAgentForCampaigns(agent);
                              setSelectedCampaignIds(
                                agent.assigned_campaign_ids || agent.assigned_campaigns || []
                              );
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border hover:bg-purple-50"
                            style={{ borderColor: "#ece9f8", color: "#4f46e5" }}
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {campaignCount > 0 ? `${campaignCount} Assigned` : "Manage Campaigns"}
                            </span>
                          </button>
                        </td>

                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              title="Edit Agent Details"
                              onClick={() => {
                                setEditingAgent(agent);
                                setEditFullName(agent.full_name || "");
                                setEditPassword("");
                                setEditStatus((agent.status || "ACTIVE").toUpperCase());
                              }}
                              className="p-2 rounded-xl border transition-all hover:bg-purple-50"
                              style={{ borderColor: "#ece9f8", color: "#7c3aed" }}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {(agent.status || "ACTIVE").toUpperCase() === "ACTIVE" ? (
                              <button
                                type="button"
                                title="Deactivate Agent"
                                onClick={() => handleToggleStatus(agent)}
                                className="p-2 rounded-xl border transition-all hover:bg-amber-50 text-amber-600 border-amber-200"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                title="Activate Agent"
                                onClick={() => handleToggleStatus(agent)}
                                className="p-2 rounded-xl border transition-all hover:bg-emerald-50 text-emerald-600 border-emerald-200"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              title="Permanently Delete Agent"
                              onClick={() => handleDeleteAgent(agent)}
                              className="p-2 rounded-xl border transition-all hover:bg-rose-50 text-rose-600 border-rose-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: "#ece9f8" }}>
            <p className="text-xs" style={{ color: "#9390b5" }}>
              Showing {filteredAgents.length === 0 ? 0 : (page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, filteredAgents.length)} of {filteredAgents.length} agents
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="p-2 rounded-lg border disabled:opacity-40 transition-colors"
                style={{ borderColor: "#ece9f8", color: "#4b4f6b" }}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-semibold px-2" style={{ color: "#1a1040" }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="p-2 rounded-lg border disabled:opacity-40 transition-colors"
                style={{ borderColor: "#ece9f8", color: "#4b4f6b" }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Onboard Agent Modal ── */}
        <Dialog.Root open={showOnboardModal} onOpenChange={setShowOnboardModal}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} />
            <Dialog.Content
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
              style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
            >
              <div className="flex items-center justify-between mb-5">
                <Dialog.Title className="font-bold text-lg flex items-center gap-2" style={{ color: "#1a1040" }}>
                  <UserPlus className="h-5 w-5" style={{ color: "#7c3aed" }} />
                  Onboard Sales Agent
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" className="flex items-center justify-center w-8 h-8 rounded-xl" style={{ background: "#f5f6fa", color: "#9498b0" }}>
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>

              <form onSubmit={handleOnboardSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#4b4f6b" }}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ background: "#f5f6fa", border: "1.5px solid #e8eaf0", color: "#1a1d23" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#4b4f6b" }}>Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. sarah@acme.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ background: "#f5f6fa", border: "1.5px solid #e8eaf0", color: "#1a1d23" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#4b4f6b" }}>Initial Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ background: "#f5f6fa", border: "1.5px solid #e8eaf0", color: "#1a1d23" }}
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t" style={{ borderColor: "#ece9f8" }}>
                  <button
                    type="button"
                    onClick={() => setShowOnboardModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl"
                    style={{ background: "#f5f6fa", color: "#4b4f6b" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={onboardLoading}
                    className="px-5 py-2.5 text-xs font-semibold text-white rounded-xl shadow transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
                  >
                    {onboardLoading ? "Creating Agent…" : "Complete Onboarding"}
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* ── Edit Sales Agent Modal ── */}
        <Dialog.Root open={!!editingAgent} onOpenChange={(open) => !open && setEditingAgent(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} />
            <Dialog.Content
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
              style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
            >
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="font-bold text-lg flex items-center gap-2" style={{ color: "#1a1040" }}>
                  <Edit3 className="h-5 w-5" style={{ color: "#7c3aed" }} />
                  Edit Sales Agent
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" className="flex items-center justify-center w-8 h-8 rounded-xl" style={{ background: "#f5f6fa", color: "#9498b0" }}>
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "#4b4f6b" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    style={{ borderColor: "#ece9f8", background: "#fdfcfe" }}
                    placeholder="Full Name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "#4b4f6b" }}>
                    Account Email (Read-Only)
                  </label>
                  <input
                    type="email"
                    value={editingAgent?.email || ""}
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                    style={{ borderColor: "#ece9f8" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "#4b4f6b" }}>
                    Reset Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    style={{ borderColor: "#ece9f8", background: "#fdfcfe" }}
                    placeholder="Leave blank to keep current password"
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "#4b4f6b" }}>
                    Agent Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    style={{ borderColor: "#ece9f8", background: "#fdfcfe" }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t" style={{ borderColor: "#ece9f8" }}>
                  <button
                    type="button"
                    onClick={() => setEditingAgent(null)}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl"
                    style={{ background: "#f5f6fa", color: "#4b4f6b" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="px-5 py-2.5 text-xs font-semibold text-white rounded-xl shadow transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
                  >
                    {editLoading ? "Saving Changes…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* ── Assign WABA Channels Modal ── */}
        <Dialog.Root open={!!selectedAgentForChannels} onOpenChange={(open) => !open && setSelectedAgentForChannels(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} />
            <Dialog.Content
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
              style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
            >
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="font-bold text-lg flex items-center gap-2" style={{ color: "#1a1040" }}>
                  <Smartphone className="h-5 w-5" style={{ color: "#7c3aed" }} />
                  Assign WABA Channels
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" className="flex items-center justify-center w-8 h-8 rounded-xl" style={{ background: "#f5f6fa", color: "#9498b0" }}>
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>

              <p className="text-xs mb-4" style={{ color: "#9390b5" }}>
                Select WABA channels that <strong>{selectedAgentForChannels?.full_name || selectedAgentForChannels?.email}</strong> can access to read and reply to messages.
              </p>

              <form onSubmit={handleAssignChannelsSubmit} className="space-y-3">
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {channels.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: "#9390b5" }}>No WABA channels available in workspace.</p>
                  ) : (
                    channels.map((ch) => {
                      const isChecked = selectedChannelIds.includes(ch.id);
                      return (
                        <label
                          key={ch.id}
                          className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                          style={{
                            background: isChecked ? "#f0eeff" : "#f9f8fe",
                            borderColor: isChecked ? "#c4b5fd" : "#ece9f8",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedChannelIds((prev) => [...prev, ch.id]);
                              } else {
                                setSelectedChannelIds((prev) => prev.filter((id) => id !== ch.id));
                              }
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                          />
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#1a1040" }}>
                              {ch.channel_name || ch.display_phone_number || "WABA Channel"}
                            </p>
                            <p className="text-xs" style={{ color: "#9390b5" }}>
                              {ch.display_phone_number} {ch.is_default ? "• Default Channel" : ""}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="pt-4 flex items-center justify-between border-t" style={{ borderColor: "#ece9f8" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedChannelIds([])}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    Unassign All
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAgentForChannels(null)}
                      className="px-4 py-2.5 text-xs font-semibold rounded-xl"
                      style={{ background: "#f5f6fa", color: "#4b4f6b" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={assignLoading}
                      className="px-5 py-2.5 text-xs font-semibold text-white rounded-xl shadow transition-all disabled:opacity-50"
                      style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
                    >
                      {assignLoading ? "Saving…" : "Save Assignments"}
                    </button>
                  </div>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* ── Assign Campaigns Modal ── */}
        <Dialog.Root open={!!selectedAgentForCampaigns} onOpenChange={(open) => !open && setSelectedAgentForCampaigns(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} />
            <Dialog.Content
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
              style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
            >
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="font-bold text-lg flex items-center gap-2" style={{ color: "#1a1040" }}>
                  <Send className="h-5 w-5" style={{ color: "#4f46e5" }} />
                  Assign Broadcast Campaigns
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" className="flex items-center justify-center w-8 h-8 rounded-xl" style={{ background: "#f5f6fa", color: "#9498b0" }}>
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>

              <p className="text-xs mb-4" style={{ color: "#9390b5" }}>
                Delegate execution of broadcast campaigns to <strong>{selectedAgentForCampaigns?.full_name || selectedAgentForCampaigns?.email}</strong>.
              </p>

              <form onSubmit={handleAssignCampaignsSubmit} className="space-y-3">
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {campaigns.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: "#9390b5" }}>No campaigns available in workspace.</p>
                  ) : (
                    campaigns.map((c: any) => {
                      const isChecked = selectedCampaignIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                          style={{
                            background: isChecked ? "#f0eeff" : "#f9f8fe",
                            borderColor: isChecked ? "#c4b5fd" : "#ece9f8",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCampaignIds((prev) => [...prev, c.id]);
                              } else {
                                setSelectedCampaignIds((prev) => prev.filter((id) => id !== c.id));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#1a1040" }}>
                              {c.name || c.campaign_name || "Campaign"}
                            </p>
                            <p className="text-xs" style={{ color: "#9390b5" }}>
                              Status: {c.status || "DRAFT"}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="pt-4 flex items-center justify-between border-t" style={{ borderColor: "#ece9f8" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedCampaignIds([])}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    Unassign All
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAgentForCampaigns(null)}
                      className="px-4 py-2.5 text-xs font-semibold rounded-xl"
                      style={{ background: "#f5f6fa", color: "#4b4f6b" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={assignLoading}
                      className="px-5 py-2.5 text-xs font-semibold text-white rounded-xl shadow transition-all disabled:opacity-50"
                      style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
                    >
                      {assignLoading ? "Saving…" : "Save Assignments"}
                    </button>
                  </div>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </RoleGuard>
  );
}
