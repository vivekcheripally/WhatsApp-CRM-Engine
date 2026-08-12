"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  Building2,
  CheckCircle2,
  Clock,
  Ban,
  MessageSquare,
  Smartphone,
  Plus,
  Copy,
  Check,
  ShieldCheck,
  LogOut,
  RefreshCw,
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
  id: string;
  name: string;
  slug: string;
  contact_name?: string;
  contact_email?: string;
  status: string;
  plan_name: string;
  created_at?: string;
}

export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [planName, setPlanName] = useState("STARTER");
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, oRes] = await Promise.all([
        api.get("/api/super-admin/metrics"),
        api.get("/api/super-admin/organizations"),
      ]);
      setMetrics(mRes.data);
      setOrganizations(oRes.data);
    } catch (err) {
      console.error("Failed to load Super Admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      await api.post("/api/super-admin/organizations/onboard", {
        name,
        slug,
        contact_name: contactName,
        contact_email: contactEmail,
        plan_name: planName,
      });
      setShowOnboardModal(false);
      setName(""); setSlug(""); setContactName(""); setContactEmail("");
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to onboard organization");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleApprove = async (orgId: string) => {
    try {
      const res = await api.post(`/api/super-admin/organizations/${orgId}/approve`);
      if (res.data.initial_password) {
        setCredentials({
          email: res.data.user_email,
          pass: res.data.initial_password,
        });
        setShowCredentialsModal(true);
      }
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to approve organization");
    }
  };

  const handleSuspend = async (orgId: string) => {
    if (!confirm("Are you sure you want to suspend this organization?")) return;
    try {
      await api.post(`/api/super-admin/organizations/${orgId}/suspend`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to suspend organization");
    }
  };

  const handleReactivate = async (orgId: string) => {
    if (!confirm("Are you sure you want to reactivate this organization?")) return;
    try {
      await api.post(`/api/super-admin/organizations/${orgId}/reactivate`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to reactivate organization");
    }
  };

  const copyCredentials = () => {
    if (!credentials) return;
    const text = `Email: ${credentials.email}\nPassword: ${credentials.pass}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      {/* Top Navbar */}
      <div className="flex justify-between items-center pb-8 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Super Admin Portal</h1>
            <p className="text-xs text-slate-400">Platform Onboarding & Organization Control</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={fetchData}
            className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors text-slate-300"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowOnboardModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium text-sm text-white shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Organization</span>
          </button>
          <button
            onClick={logout}
            className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded-xl transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 my-8">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Total Orgs</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics?.total_organizations ?? 0}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Active Orgs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{metrics?.active_organizations ?? 0}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{metrics?.pending_approvals ?? 0}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Suspended</span>
            <Ban className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400">{metrics?.suspended_organizations ?? 0}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Messages Sent</span>
            <MessageSquare className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics?.total_messages_sent ?? 0}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>WhatsApp Accounts</span>
            <Smartphone className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics?.active_whatsapp_accounts ?? 0}</p>
        </div>
      </div>

      {/* Organization Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Client Organizations</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">Contact Person</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-white">{org.name}</p>
                    <p className="text-xs text-slate-400">{org.slug}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-slate-200">{org.contact_name || "—"}</p>
                    <p className="text-xs text-slate-400">{org.contact_email || "—"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg text-xs font-semibold">
                      {org.plan_name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {org.status === "ACTIVE" && (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </span>
                    )}
                    {org.status === "PENDING_APPROVAL" && (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pending Approval</span>
                      </span>
                    )}
                    {org.status === "SUSPENDED" && (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-semibold">
                        <Ban className="w-3.5 h-3.5" />
                        <span>Suspended</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {org.created_at ? new Date(org.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {org.status === "PENDING_APPROVAL" && (
                      <button
                        onClick={() => handleApprove(org.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
                      >
                        Approve & Provision
                      </button>
                    )}
                    {org.status === "ACTIVE" && (
                      <button
                        onClick={() => handleSuspend(org.id)}
                        className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded-lg text-xs font-semibold transition-all"
                      >
                        Suspend
                      </button>
                    )}
                    {org.status === "SUSPENDED" && (
                      <button
                        onClick={() => handleReactivate(org.id)}
                        className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-semibold transition-all"
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard Modal */}
      {showOnboardModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Onboard New Organization</h3>
            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Organization Slug</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="acme-corp"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contact Person Name</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="john@acme.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subscription Plan</label>
                <select
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="STARTER">STARTER</option>
                  <option value="PRO">PRO</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow"
                >
                  {submitLoading ? "Submitting..." : "Submit Onboarding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Credentials Modal */}
      {showCredentialsModal && credentials && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-emerald-400 mb-4">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="text-xl font-bold text-white">Credentials Provisioned</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              Organization approved! Below is the single tenant user login credential created for this organization.
            </p>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2 mb-6 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-200">{credentials.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Temp Password:</span>
                <span className="text-emerald-400 font-bold">{credentials.pass}</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={copyCredentials}
                className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Copied to Clipboard!" : "Copy Credentials"}</span>
              </button>
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
