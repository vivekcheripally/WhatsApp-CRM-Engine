"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Plus, Edit2, Trash2, RefreshCw, CheckCircle, Clock, XCircle, FileText, X, Activity, Send, Eye } from "lucide-react";
import {
  getTemplates, createTemplate, updateTemplate,
  deleteTemplate, syncTemplateStatus, resubmitTemplate, getRecentActivities,
  syncAllTemplates,
} from "../../services/templateService";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useWabaContext } from "@/context/WabaContext";

const card = { background: "#ffffff", border: "1px solid #ece9f8", borderRadius: "14px", boxShadow: "0 1px 6px rgba(100,80,200,0.07)" };
const inputStyle = { background: "#f5f4fb", border: "1.5px solid #e0ddf5", color: "#1a1040", borderRadius: "10px", padding: "9px 14px", width: "100%", fontSize: "13px", outline: "none" } as const;
const labelStyle = { fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "#9390b5", marginBottom: "6px", display: "block" };

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cfg = s === "APPROVED" ? { bg: "rgba(16,185,129,0.12)", color: "#10b981", icon: CheckCircle }
    : s === "REJECTED"         ? { bg: "rgba(244,63,94,0.10)",  color: "#f43f5e", icon: XCircle }
    :                            { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="w-3 h-3" />{s}
    </span>
  );
}

function StatCard({ icon: Icon, title, value, color, bg }: any) {
  return (
    <div className="rounded-2xl p-5 flex items-center justify-between" style={card}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#9390b5" }}>{title}</p>
        <p className="text-[28px] font-bold tabular-nums" style={{ color: "#1a1040" }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
      </div>
      <div className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0" style={{ background: bg }}>
        <Icon size={22} style={{ color }} />
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { user, assigned_channels } = useCurrentUser();
  const { activeChannel, channels } = useWabaContext();

  const [templates, setTemplates] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [notification, setNotification] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [syncingIds, setSyncingIds] = useState<number[]>([]);
  const [resubmittingIds, setResubmittingIds] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<any>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState({
    template_name: "", category: "MARKETING", language: "en_US",
    header: "none", template_body: "", footer: "",
    buttons: [] as any[], header_url: null as string | null,
  });

  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const res = await syncAllTemplates();
      if (res.success) {
        notify("success", res.message || "Synced all templates from Meta!");
        const [td, ad] = await Promise.all([getTemplates(), getRecentActivities(10)]);
        setTemplates(td); setRecentActivities(ad);
      } else {
        notify("error", res.message || "Failed to sync templates");
      }
    } catch (e: any) {
      notify("error", (e as Error).message || "Sync failed");
    } finally {
      setIsSyncingAll(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const [td, ad] = await Promise.all([getTemplates(), getRecentActivities(10)]);
      let templateList = Array.isArray(td) ? td : td?.templates || [];

      // If user is a Sales Agent, strictly show templates for their active assigned WABA channel
      if (user?.role === "SALES_AGENT") {
        const currentActiveWabaId = activeChannel
          ? String(activeChannel.id)
          : (typeof window !== "undefined" ? localStorage.getItem("active_waba_account_id") : null);

        templateList = templateList.filter((t: any) => {
          const tmplWabaId = String(t.whatsapp_account_id || t.waba_account_id || "");
          if (currentActiveWabaId && tmplWabaId) {
            return tmplWabaId === currentActiveWabaId;
          }
          return true;
        });
      }

      setTemplates(templateList);
      setRecentActivities(ad);
    } catch { }
  };

  useEffect(() => {
    loadTemplates();
    const handleChannelChange = () => {
      loadTemplates();
    };
    window.addEventListener("waba-channel-changed", handleChannelChange);
    return () => {
      window.removeEventListener("waba-channel-changed", handleChannelChange);
    };
  }, [activeChannel, user?.id]);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: "", message: "" }), 3000);
  };

  const filtered = filterStatus === "all" ? templates
    : templates.filter(t => (t.meta_status || t.status || "PENDING").toLowerCase() === filterStatus);

  const stats = {
    total:    templates.length,
    approved: templates.filter(t => (t.meta_status || t.status || "").toUpperCase() === "APPROVED").length,
    pending:  templates.filter(t => (t.meta_status || t.status || "").toUpperCase() === "PENDING").length,
    rejected: templates.filter(t => (t.meta_status || t.status || "").toUpperCase() === "REJECTED").length,
  };

  const handleSave = async () => {
    if (!templateData.template_name.trim()) { notify("error", "Template name is required"); return; }
    setIsLoading(true);
    try {
      let result: any;
      if (editingId) {
        result = await updateTemplate(editingId, templateData);
        notify("success", "Template updated!");
      } else {
        if (headerFile) {
          const fd = new FormData();
          Object.entries(templateData).forEach(([k, v]) => { if (v !== null) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v)); });
          fd.append("file", headerFile);
          result = await createTemplate(fd);
        } else {
          result = await createTemplate(templateData);
        }
        notify("success", result?.warning ? "✓ Template saved locally" : "✓ Template submitted to Meta!");
      }
      setTemplateData({ template_name: "", category: "MARKETING", language: "en_US", header: "none", template_body: "", footer: "", buttons: [], header_url: null });
      setHeaderFile(null); setHeaderPreviewUrl(null); setEditingId(null); setShowModal(false);
      setTemplates(await getTemplates());
    } catch (e: any) {
      notify("error", (e as Error).message || "Failed to save template");
    } finally { setIsLoading(false); }
  };

  const handleEdit = (t: any) => {
    const hType = (t.header_type || t.header || "none").toString().toLowerCase();
    const hUrl = t.header_media_url || t.header_url || null;
    setTemplateData({
      template_name: t.template_name,
      category: t.category,
      language: t.language,
      header: hType,
      template_body: t.template_body,
      footer: t.footer || "",
      buttons: t.buttons || [],
      header_url: hUrl,
    });
    setEditingId(t.id); setHeaderPreviewUrl(hUrl); setShowModal(true);
  };

  const handleDelete = async (id: any) => {
    if (!confirm("Delete this template?")) return;
    try { await deleteTemplate(id); notify("success", "Deleted!"); setTemplates(await getTemplates()); }
    catch (e: any) { notify("error", (e as Error).message || "Failed to delete"); }
  };

  const handleSync = async (id: any, templateName: string) => {
    const tid = Number(id);
    setSyncingIds(s => [...s, tid]);
    try {
      const result = await syncTemplateStatus(id);
      if (result?.meta_status) setTemplates(p => p.map(t => Number(t.id) === tid ? { ...t, meta_status: result.meta_status, status: result.meta_status } : t));
      notify(result?.success ? "success" : "error", result?.success ? `"${templateName}" — ${result.meta_status}` : result?.message || "Could not reach Meta");
    } catch (e: any) { notify("error", (e as Error).message || "Sync failed"); }
    finally { setSyncingIds(s => s.filter(x => x !== tid)); }
  };

  const handleResubmit = async (id: any) => {
    const tid = Number(id);
    setResubmittingIds(s => [...s, tid]);
    try {
      const result = await resubmitTemplate(id);
      notify("success", result.message || "Resubmitted to Meta!");
      setTemplates(await getTemplates());
    } catch (e: any) {
      const err = e as any;
      notify("error", (err.message || "Resubmit failed") + (err.hint ? ` — ${err.hint}` : ""));
    } finally { setResubmittingIds(s => s.filter(x => x !== tid)); }
  };

  const FILTER_TABS = [
    { key: "all",      label: "All",      count: stats.total    },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "pending",  label: "Pending",  count: stats.pending  },
    { key: "rejected", label: "Rejected", count: stats.rejected },
  ];

  return (
    <div className="p-6 space-y-5 animate-fade-up">
      {/* Toast */}
      {notification.message && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: notification.type === "success" ? "linear-gradient(135deg,#059669,#10b981)" : "linear-gradient(135deg,#e11d48,#f43f5e)" }}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "#1a1040" }}>Templates</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9390b5" }}>
            {user?.role === "SALES_AGENT" ? "View assigned WhatsApp message templates" : "Manage your WhatsApp message templates"}
          </p>
        </div>
        {user?.role !== "SALES_AGENT" && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-purple-200 text-purple-700 bg-white hover:bg-purple-50 disabled:opacity-50 transition cursor-pointer"
            >
              <RefreshCw size={14} className={isSyncingAll ? "animate-spin" : ""} />
              {isSyncingAll ? "Syncing Meta..." : "Sync from Meta"}
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
              style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
              <Plus size={14} /> Create Template
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={FileText}    title="Total Templates" value={stats.total}    color="#7c3aed" bg="rgba(124,58,237,0.10)" />
        <StatCard icon={CheckCircle} title="Approved"        value={stats.approved} color="#10b981" bg="rgba(16,185,129,0.10)" />
        <StatCard icon={Clock}       title="Pending"         value={stats.pending}  color="#f59e0b" bg="rgba(245,158,11,0.10)" />
        <StatCard icon={XCircle}     title="Rejected"        value={stats.rejected} color="#f43f5e" bg="rgba(244,63,94,0.10)"  />
      </div>

      {/* Main Templates Table Container - Corner to Corner Full Width */}
      <div className="w-full" style={{ ...card, padding: 0, overflow: "hidden" }}>
        {/* Filter tabs */}
        <div className="flex gap-1 p-3" style={{ borderBottom: "1px solid #ece9f8" }}>
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filterStatus === tab.key ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "#f5f4fb",
                color: filterStatus === tab.key ? "#fff" : "#9390b5",
                boxShadow: filterStatus === tab.key ? "0 4px 12px rgba(124,58,237,0.25)" : "none",
              }}>
              {tab.label}
              <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                style={{ background: filterStatus === tab.key ? "rgba(255,255,255,0.25)" : "#ece9f8", color: filterStatus === tab.key ? "#fff" : "#9390b5" }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <table className="data-table">
          <thead>
            <tr><th>Template</th><th>Category</th><th>Language</th><th>Status</th><th>Last Updated</th><th className="text-center">Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12" style={{ color: "#b0aed0" }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12" style={{ color: "#b0aed0" }}>No templates found</td></tr>
            ) : filtered.map(t => (
              <tr key={t.id}>
                <td><span className="font-semibold" style={{ color: "#1a1040" }}>{t.template_name}</span></td>
                <td style={{ color: "#4b4880" }}>{t.category}</td>
                <td style={{ color: "#4b4880" }}>{t.language}</td>
                <td><StatusBadge status={t.meta_status || t.status || "PENDING"} /></td>
                <td style={{ color: "#9390b5" }}>{(t.updated_at || t.created_at) ? new Date(t.updated_at || t.created_at).toLocaleDateString() : "—"}</td>

                <td>
                  <div className="flex items-center justify-center gap-2">
                    {user?.role === "SALES_AGENT" ? (
                      <button
                        onClick={() => handleEdit(t)}
                        title="View Template Details"
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>View Template</span>
                      </button>
                    ) : (
                      <>
                        {[
                          { Icon: Edit2,     fn: () => handleEdit(t),                  col: "#7c3aed", title: "Edit",   spin: false },
                          { Icon: Trash2,    fn: () => handleDelete(t.id),             col: "#f43f5e", title: "Delete", spin: false },
                          { Icon: RefreshCw, fn: () => handleSync(t.id, t.template_name), col: "#10b981", title: "Sync", spin: syncingIds.includes(Number(t.id)) },
                        ].map(({ Icon, fn, col, title, spin }, k) => (
                          <button key={k} onClick={fn} title={title}
                            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                            style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}
                            onMouseEnter={e => (e.currentTarget.style.background = col + "15")}
                            onMouseLeave={e => (e.currentTarget.style.background = "#f5f4fb")}>
                            <Icon size={13} style={{ color: col }} className={spin ? "animate-spin" : ""} />
                          </button>
                        ))}
                        {!t.meta_template_id && (
                          <button onClick={() => handleResubmit(t.id)} title="Resubmit to Meta"
                            disabled={resubmittingIds.includes(Number(t.id))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50"
                            style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#f59e0b15")}
                            onMouseLeave={e => (e.currentTarget.style.background = "#f5f4fb")}>
                            <Send size={13} style={{ color: "#f59e0b" }} className={resubmittingIds.includes(Number(t.id)) ? "animate-pulse" : ""} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6 pt-16 overflow-y-auto" style={{ background: "rgba(26,16,64,0.4)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl flex flex-col mb-6" style={{ background: "#fff", border: "1px solid #ece9f8", maxHeight: "calc(100vh - 8rem)" }}>
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #ece9f8" }}>
              <h2 className="text-lg font-bold" style={{ color: "#1a1040" }}>
                {user?.role === "SALES_AGENT" ? "View Template" : (editingId ? "Edit Template" : "Create Template")}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ color: "#9390b5" }}><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-0 flex-1 min-h-0 overflow-hidden">
              {/* Left — form (scrolls internally so card never grows) */}
              <div className="p-6 space-y-3 overflow-y-auto" style={{ borderRight: "1px solid #ece9f8" }}>
                <div>
                  <span style={labelStyle}>Template Name</span>
                  <input value={templateData.template_name} onChange={e => setTemplateData({ ...templateData, template_name: e.target.value })} placeholder="e.g. order_confirmation" style={inputStyle} className="placeholder:text-[#c0bed8] focus:outline-none" />
                  <p className="text-[11px] mt-1" style={{ color: "#b0aed0" }}>Lowercase, underscores only</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><span style={labelStyle}>Category</span>
                    <select value={templateData.category} onChange={e => setTemplateData({ ...templateData, category: e.target.value })} style={inputStyle} className="focus:outline-none">
                      <option>MARKETING</option><option>UTILITY</option><option>AUTHENTICATION</option>
                    </select>
                  </div>
                  <div><span style={labelStyle}>Language</span>
                    <select value={templateData.language} onChange={e => setTemplateData({ ...templateData, language: e.target.value })} style={inputStyle} className="focus:outline-none">
                      <option value="en_US">English (US)</option><option value="en_GB">English (UK)</option>
                      <option value="hi">Hindi</option><option value="ar">Arabic</option>
                      <option value="fr">French</option><option value="de">German</option>
                      <option value="es_ES">Spanish</option><option value="pt_BR">Portuguese (BR)</option>
                      <option value="id">Indonesian</option><option value="tr">Turkish</option>
                    </select>
                  </div>
                </div>
                <div><span style={labelStyle}>Header</span>
                  <select value={templateData.header} onChange={e => setTemplateData({ ...templateData, header: e.target.value })} style={inputStyle} className="focus:outline-none">
                    <option value="none">None</option><option value="text">Text</option><option value="image">Image</option><option value="video">Video</option><option value="document">Document</option>
                  </select>
                </div>
                {templateData.header !== "none" && (
                  <div><span style={labelStyle}>Upload {templateData.header}</span>
                    <input type="file" accept={templateData.header === "image" ? "image/*" : templateData.header === "video" ? "video/mp4" : ".pdf,.doc,.docx"}
                      onChange={e => { const f = e.target.files?.[0] || null; setHeaderFile(f); setHeaderPreviewUrl(f ? URL.createObjectURL(f) : null); }}
                      className="w-full text-sm" style={{ color: "#4b4880" }} />
                  </div>
                )}
                <div><span style={labelStyle}>Body Text</span>
                  <textarea rows={4} placeholder="Type your message..." value={templateData.template_body} onChange={e => setTemplateData({ ...templateData, template_body: e.target.value })}
                    style={{ ...inputStyle, resize: "none" }} className="placeholder:text-[#c0bed8] focus:outline-none" />
                </div>
                <div><span style={labelStyle}>Footer (optional)</span>
                  <input value={templateData.footer} maxLength={60} onChange={e => setTemplateData({ ...templateData, footer: e.target.value })} placeholder="Optional footer (max 60 chars)" style={inputStyle} className="placeholder:text-[#c0bed8] focus:outline-none" />
                </div>
                <div>
                  <span style={labelStyle}>Buttons</span>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {templateData.buttons.map((btn, i) => (
                      <div key={i} className="flex gap-2">
                        <select value={btn.type} onChange={e => { const b = [...templateData.buttons]; b[i].type = e.target.value; setTemplateData({ ...templateData, buttons: b }); }}
                          style={{ ...inputStyle, flex: 1, width: "auto" }} className="focus:outline-none text-xs">
                          <option value="QUICK_REPLY">QUICK_REPLY</option><option value="CALL_TO_ACTION">CALL_TO_ACTION</option>
                        </select>
                        <input value={btn.text} maxLength={20} placeholder="Label" onChange={e => { const b = [...templateData.buttons]; b[i].text = e.target.value; setTemplateData({ ...templateData, buttons: b }); }}
                          style={{ ...inputStyle, flex: 1, width: "auto" }} className="placeholder:text-[#c0bed8] focus:outline-none text-xs" />
                        <button onClick={() => setTemplateData({ ...templateData, buttons: templateData.buttons.filter((_, j) => j !== i) })} style={{ color: "#f43f5e" }}><X size={15} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setTemplateData({ ...templateData, buttons: [...templateData.buttons, { type: "QUICK_REPLY", text: "" }] })}
                    className="mt-2 text-xs font-medium" style={{ color: "#7c3aed" }}>+ Add Button</button>
                </div>
              </div>

              {/* Right — mobile phone preview */}
              <div className="flex flex-col items-center p-4 overflow-hidden" style={{ background: "#f0f0f8" }}>
                <span style={labelStyle} className="self-start mb-3 flex-shrink-0">Preview</span>

                {/* Phone frame — fills remaining height */}
                <div className="relative flex-1 min-h-0 flex items-center justify-center w-full">
                  <div className="relative h-full" style={{ aspectRatio: "9/18", maxWidth: "100%" }}>
                    {/* Phone outer shell */}
                    <div className="relative h-full rounded-[1.6rem] p-[4px]" style={{
                      background: "linear-gradient(145deg,#2d2d2d,#1a1a1a)",
                      boxShadow: "0 0 0 1px #555, 0 16px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
                    }}>
                      {/* Side buttons */}
                      <div className="absolute" style={{ left: "-3px", top: "15%", width: "3px", height: "5%", background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
                      <div className="absolute" style={{ left: "-3px", top: "23%", width: "3px", height: "8%", background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
                      <div className="absolute" style={{ left: "-3px", top: "33%", width: "3px", height: "8%", background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
                      <div className="absolute" style={{ right: "-3px", top: "25%", width: "3px", height: "12%", background: "#3a3a3a", borderRadius: "0 2px 2px 0" }} />

                      {/* Screen */}
                      <div className="h-full rounded-[1.3rem] overflow-hidden flex flex-col" style={{ background: "#000" }}>
                        {/* Dynamic island / notch */}
                        <div className="flex-shrink-0 flex justify-center pt-1.5 pb-0.5" style={{ background: "#075e54" }}>
                          <div className="rounded-full" style={{ width: "28%", height: "6px", background: "#000" }} />
                        </div>

                        {/* Status bar */}
                        <div className="flex-shrink-0 flex items-center justify-between px-3 pb-1" style={{ background: "#075e54" }}>
                          <span className="font-semibold text-white" style={{ fontSize: "clamp(7px,1.2vw,10px)" }}>9:41</span>
                          <div className="flex items-center gap-1">
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="white" opacity="0.9"><rect x="0" y="3" width="2" height="5" rx="0.5"/><rect x="2.5" y="2" width="2" height="6" rx="0.5"/><rect x="5" y="1" width="2" height="7" rx="0.5"/><rect x="7.5" y="0" width="2" height="8" rx="0.5"/></svg>
                            <svg width="10" height="8" viewBox="0 0 12 9" fill="white" opacity="0.9"><path d="M6 2C4.1 2 2.4 2.7 1.1 3.9L0 2.8C1.6 1.1 3.7 0 6 0s4.4 1.1 6 2.8L10.9 3.9C9.6 2.7 7.9 2 6 2z"/><path d="M6 5c-1 0-1.9.4-2.6 1L2.3 4.9C3.3 4 4.6 3.4 6 3.4s2.7.6 3.7 1.5L8.6 6C7.9 5.4 7 5 6 5z"/><circle cx="6" cy="8" r="1.3"/></svg>
                            <svg width="14" height="8" viewBox="0 0 14 8" fill="none"><rect x="0.5" y="0.5" width="11" height="7" rx="1.5" stroke="white" strokeOpacity="0.5"/><rect x="1.5" y="1.5" width="8" height="5" rx="1" fill="white"/><path d="M13 3v2a1 1 0 0 0 0-2z" fill="white" fillOpacity="0.4"/></svg>
                          </div>
                        </div>

                        {/* Chat header */}
                        <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5" style={{ background: "#075e54" }}>
                          <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0" style={{ background: "#25d366", width: "clamp(18px,3vw,26px)", height: "clamp(18px,3vw,26px)", fontSize: "clamp(7px,1vw,10px)" }}>R</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white leading-tight truncate" style={{ fontSize: "clamp(8px,1.3vw,11px)" }}>Rahul</p>
                            <p className="leading-tight" style={{ fontSize: "clamp(6px,1vw,9px)", color: "#b2dfdb" }}>online</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white" opacity="0.9"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white" opacity="0.9"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white" opacity="0.9"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                          </div>
                        </div>

                        {/* Chat body */}
                        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5" style={{ background: "#efeae2" }}>
                          {/* Date chip */}
                          <div className="flex justify-center">
                            <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.75)", color: "#667781", fontSize: "clamp(6px,0.9vw,8px)" }}>TODAY</span>
                          </div>

                          {/* Message bubble */}
                          <div className="flex justify-end">
                            <div className="rounded-lg rounded-tr-none px-2 py-1.5 relative" style={{ background: "#d9fdd3", boxShadow: "0 1px 2px rgba(0,0,0,0.1)", maxWidth: "85%" }}>
                              {/* Header media */}
                              {templateData.header !== "none" && (headerPreviewUrl || templateData.header_url) ? (
                                templateData.header === "image" ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={headerPreviewUrl || templateData.header_url || ""} alt="header" className="w-full rounded mb-1 object-cover" style={{ maxHeight: "70px" }} />
                                ) : templateData.header === "video" ? (
                                  <div className="w-full rounded mb-1 bg-black flex items-center justify-center" style={{ height: "50px" }}>
                                    <span className="text-white" style={{ fontSize: "14px" }}>▶</span>
                                  </div>
                                ) : (
                                  <div className="w-full rounded mb-1 flex items-center gap-1 px-1.5 py-1" style={{ background: "#f0f0f0" }}>
                                    <span style={{ fontSize: "10px" }}>📄</span>
                                    <span className="truncate" style={{ color: "#555", fontSize: "clamp(6px,0.9vw,8px)" }}>{templateData.header.toUpperCase()}</span>
                                  </div>
                                )
                              ) : null}

                              {/* Body text */}
                              <p className="whitespace-pre-wrap leading-relaxed" style={{ color: "#111b21", fontSize: "clamp(7px,1.1vw,10px)" }}>
                                {(templateData.template_body || "Your message here…")
                                  .replace(/\{\{1\}\}/g, "Rahul")
                                  .replace(/\{\{2\}\}/g, "#12345")
                                  .replace(/\{\{3\}\}/g, "today")}
                              </p>

                              {/* Footer */}
                              {templateData.footer && (
                                <p className="mt-1 pt-1" style={{ color: "#8696a0", borderTop: "1px solid #e9edef", fontSize: "clamp(6px,0.9vw,8px)" }}>
                                  {templateData.footer}
                                </p>
                              )}

                              {/* Timestamp */}
                              <p className="text-right mt-0.5" style={{ color: "#8696a0", fontSize: "clamp(5px,0.8vw,7px)" }}>11:30 AM ✓✓</p>
                            </div>
                          </div>

                          {/* Buttons */}
                          {templateData.buttons.length > 0 && (
                            <div className="flex justify-end">
                              <div className="space-y-0.5" style={{ width: "85%" }}>
                                {templateData.buttons.map((btn, i) => (
                                  <div key={i} className="text-center py-1 rounded-lg font-medium" style={{ background: "#fff", color: "#0a7cff", boxShadow: "0 1px 2px rgba(0,0,0,0.1)", fontSize: "clamp(6px,0.9vw,9px)" }}>
                                    {btn.text || `Button ${i + 1}`}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Input bar */}
                        <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5" style={{ background: "#f0f2f5" }}>
                          <div className="flex-1 rounded-full px-2 py-1" style={{ background: "#fff" }}>
                            <span style={{ color: "#8696a0", fontSize: "clamp(6px,0.9vw,9px)" }}>Type a message</span>
                          </div>
                          <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#00a884", width: "clamp(18px,2.5vw,24px)", height: "clamp(18px,2.5vw,24px)" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6z"/><path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                          </div>
                        </div>

                        {/* Home indicator */}
                        <div className="flex-shrink-0 flex justify-center py-1" style={{ background: "#f0f2f5" }}>
                          <div className="rounded-full" style={{ width: "35%", height: "3px", background: "#000" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #ece9f8" }}>
              {user?.role === "SALES_AGENT" ? (
                <button onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow"
                  style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}>Close</button>
              ) : (
                <>
                  <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium"
                    style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}>Cancel</button>
                  <button onClick={handleSave} disabled={isLoading} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
                    {isLoading ? "Saving…" : editingId ? "Update" : "Create"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
