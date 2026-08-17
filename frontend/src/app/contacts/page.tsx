"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Plus, Eye, Edit2, Trash2, Users, CheckCircle, CalendarDays, Upload, X, UserPlus, Shield } from "lucide-react";
import { getContacts, createContact, updateContact, deleteContactApi, importContacts, bulkAssignContacts } from "../../services/contactService";
import { useAgents } from "@/hooks/use-agents";
import * as Dialog from "@radix-ui/react-dialog";

const card = { background: "#ffffff", border: "1px solid #ece9f8", borderRadius: "14px", boxShadow: "0 1px 6px rgba(100,80,200,0.07)" };
const inputStyle = { background: "#f5f4fb", border: "1px solid #e0ddf5", color: "#1a1040", borderRadius: "10px", padding: "10px 14px", width: "100%", fontSize: "14px", outline: "none" };

function StatCard({ icon: Icon, title, value, delta, color, bg }: any) {
  return (
    <div className="rounded-2xl p-5 flex items-center justify-between" style={card}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#9390b5" }}>{title}</p>
        <p className="text-[28px] font-bold tabular-nums" style={{ color: "#1a1040" }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
        {delta && <p className="text-[11px] mt-1.5 font-medium" style={{ color: "#10b981" }}>↑ {delta}</p>}
      </div>
      <div className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0" style={{ background: bg }}>
        <Icon size={22} style={{ color }} />
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [filters, setFilters] = useState({ status: "all", source: "all" });
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [viewContact, setViewContact] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", status: "Active" });

  // Bulk Selection & Agent Assignment
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const { agents } = useAgents();

  const loadContacts = useCallback(async () => {
    try {
      const data = await getContacts({ q: searchTerm, status: filters.status, source: filters.source });
      const contactList = Array.isArray(data) ? data : (data.contacts || []);
      setContacts(contactList.map((c: any) => ({
        id: String(c.id),
        name: c.name,
        email: c.email || "",
        phone: c.phone_number || c.phone,
        status: c.status || "Active",
        source: c.source || "MANUAL",
        owner_name: c.owner_name || c.owner?.full_name || "Org Admin",
        owner_role_type: c.owner_role_type || "O",
        owner_id: c.owner_id,
        created_at: c.created_at,
      })));
    } catch { }
  }, [filters, searchTerm]);

  useEffect(() => { const t = setTimeout(loadContacts, 200); return () => clearTimeout(t); }, [loadContacts]);

  const total = contacts.length;
  const active = contacts.filter(c => (c.status || "").toLowerCase() === "active").length;
  const thisMonth = contacts.filter(c => { try { const d = new Date(c.created_at), n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); } catch { return false; } }).length;

  const handleSave = async () => {
    if (!newContact.name || !newContact.phone) { alert("Name and Phone required"); return; }
    try {
      if (editingIndex !== null) { await updateContact(contacts[editingIndex].id, newContact); setEditingIndex(null); }
      else { await createContact(newContact); }
      await loadContacts();
      setNewContact({ name: "", phone: "", email: "", status: "Active" });
      setShowModal(false);
    } catch { alert("Failed to save contact"); }
  };

  const handleDelete = async (id: any) => { try { await deleteContactApi(id); loadContacts(); } catch { alert("Failed to delete"); } };
  const handleEdit = (index: number) => { setNewContact(contacts[index]); setEditingIndex(index); setShowModal(true); };
  const handleImport = async (e: any) => {
    const file = e.target.files[0]; if (!file) return;
    try { const r = await importContacts(file); if (!r.success) { alert(`Import failed: ${r.message || r.error}`); return; } await loadContacts(); }
    catch { alert("Failed to import"); } finally { e.target.value = null; }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const handleBulkAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAgentId || selectedIds.size === 0) return;
    setAssignLoading(true);
    try {
      await bulkAssignContacts(Array.from(selectedIds), targetAgentId);
      setShowBulkAssignModal(false);
      setSelectedIds(new Set());
      setTargetAgentId("");
      await loadContacts();
      alert("Contacts successfully assigned to Sales Agent!");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to assign contacts.");
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "#1a1040" }}>Contacts</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9390b5" }}>Manage all WhatsApp contacts and agent assignments</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowBulkAssignModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow"
              style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
            >
              <UserPlus size={16} /> Bulk Assign Agent ({selectedIds.size})
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "#fff", border: "1px solid #e0ddf5", color: "#7c3aed" }}>
            <Upload size={14} /> Import
          </button>
          <button onClick={() => { setEditingIndex(null); setNewContact({ name: "", phone: "", email: "", status: "Active" }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
            <Plus size={14} /> Add Contact
          </button>
          <input type="file" accept=".csv,.xlsx" ref={fileInputRef} onChange={handleImport} className="hidden" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users}        title="Total Contacts" value={total}      color="#7c3aed" bg="rgba(124,58,237,0.10)" />
        <StatCard icon={CheckCircle}  title="Active"         value={active}     color="#10b981" bg="rgba(16,185,129,0.10)" />
        <StatCard icon={CalendarDays} title="This Month"     value={thisMonth}  color="#06b6d4" bg="rgba(6,182,212,0.10)"  />
        <StatCard icon={Users}        title="Total"          value={total}      color="#f59e0b" bg="rgba(245,158,11,0.10)" />
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {/* Toolbar */}
        <div className="px-5 py-3.5 flex flex-wrap items-center gap-3" style={{ borderBottom: "1px solid #ece9f8" }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#b0aed0" }} />
            <input type="text" placeholder="Search contacts…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-xl w-full focus:outline-none"
              style={{ background: "#f5f4fb", border: "1px solid #e0ddf5", color: "#1a1040" }} />
          </div>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 text-sm rounded-xl focus:outline-none"
            style={{ background: "#f5f4fb", border: "1px solid #e0ddf5", color: "#4b4880" }}>
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select value={filters.source} onChange={e => setFilters({ ...filters, source: e.target.value })}
            className="px-3 py-2 text-sm rounded-xl focus:outline-none font-medium"
            style={{ background: "#f5f4fb", border: "1px solid #e0ddf5", color: "#7c3aed" }}>
            <option value="all">All Sources</option>
            <option value="MANUAL">Manually Added (MANUAL)</option>
            <option value="INBOUND_WHATSAPP">Inbound WhatsApp Leads (INBOUND_WHATSAPP)</option>
            <option value="CSV_IMPORT">CSV Imports (CSV_IMPORT)</option>
          </select>
          <button onClick={() => setFilters({ status: "all", source: "all" })}
            className="px-3 py-2 text-sm rounded-xl"
            style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}>
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={contacts.length > 0 && selectedIds.size === contacts.length}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                </th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Owner / Agent</th>
                <th>Status</th>
                <th>Source</th>
                <th>Added</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => {
                const isSelected = selectedIds.has(c.id);
                return (
                  <tr key={c.id} className={isSelected ? "bg-purple-50/50" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelect(c.id, e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                          {(c.name || c.phone || "C").split(" ").filter(Boolean).map((p: string) => p[0]).slice(0, 2).join("").toUpperCase() || "C"}
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "#1a1040" }}>{c.name || c.phone || "Unnamed Contact"}</p>
                          <p className="text-xs" style={{ color: "#9390b5" }}>{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs">{c.phone}</td>
                    <td>
                      {(() => {
                        const isOrg = c.owner_role_type === "O";
                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              isOrg
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                isOrg ? "bg-purple-200 text-purple-800" : "bg-blue-200 text-blue-800"
                              }`}
                            >
                              {isOrg ? "O" : "A"}
                            </span>
                            <span>{c.owner_name || "Org Admin"}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: (c.status || "").toLowerCase() === "active" ? "rgba(16,185,129,0.12)" : "rgba(100,80,200,0.07)", color: (c.status || "").toLowerCase() === "active" ? "#10b981" : "#9390b5" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: (c.status || "").toLowerCase() === "active" ? "#10b981" : "#9390b5" }} />
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{
                          background: c.source === "INBOUND_WHATSAPP" ? "rgba(6,182,212,0.12)" : (c.source === "CSV_IMPORT" ? "rgba(245,158,11,0.12)" : "rgba(124,58,237,0.12)"),
                          color: c.source === "INBOUND_WHATSAPP" ? "#0891b2" : (c.source === "CSV_IMPORT" ? "#d97706" : "#7c3aed")
                        }}>
                        {c.source || "MANUAL"}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: "#9390b5" }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        {[{ Icon: Eye, fn: () => setViewContact(c), color: "#06b6d4" }, { Icon: Edit2, fn: () => handleEdit(i), color: "#7c3aed" }, { Icon: Trash2, fn: () => handleDelete(c.id), color: "#f43f5e" }].map(({ Icon, fn, color }, k) => (
                          <button key={k} onClick={fn} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                            style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}
                            onMouseEnter={e => (e.currentTarget.style.background = color + "15")}
                            onMouseLeave={e => (e.currentTarget.style.background = "#f5f4fb")}>
                            <Icon size={13} style={{ color }} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {contacts.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12" style={{ color: "#b0aed0" }}>No contacts found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Assign Modal */}
      <Dialog.Root open={showBulkAssignModal} onOpenChange={setShowBulkAssignModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
            style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
          >
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="font-bold text-lg flex items-center gap-2" style={{ color: "#1a1040" }}>
                <UserPlus className="h-5 w-5" style={{ color: "#7c3aed" }} />
                Bulk Assign Agent ({selectedIds.size} Contacts)
              </Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="flex items-center justify-center w-8 h-8 rounded-xl" style={{ background: "#f5f6fa", color: "#9498b0" }}>
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <p className="text-xs mb-4" style={{ color: "#9390b5" }}>
              Select a Sales Agent to assign ownership for the {selectedIds.size} selected contacts.
            </p>

            <form onSubmit={handleBulkAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4b4f6b" }}>Select Sales Agent</label>
                <select
                  required
                  value={targetAgentId}
                  onChange={(e) => setTargetAgentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "#f5f6fa", border: "1.5px solid #e8eaf0", color: "#1a1d23" }}
                >
                  <option value="">-- Choose Sales Agent --</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.full_name || ag.email} ({ag.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t" style={{ borderColor: "#ece9f8" }}>
                <button
                  type="button"
                  onClick={() => setShowBulkAssignModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl"
                  style={{ background: "#f5f6fa", color: "#4b4f6b" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading || !targetAgentId}
                  className="px-5 py-2.5 text-xs font-semibold text-white rounded-xl shadow transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
                >
                  {assignLoading ? "Assigning…" : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Add/Edit Modal */}
      <Dialog.Root open={showModal} onOpenChange={setShowModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl p-6 space-y-4 bg-white border border-[#ece9f8] shadow-2xl">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-bold text-[#1a1040]">
                {editingIndex !== null ? "Edit Contact" : "Add Contact"}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="p-1 rounded-lg text-[#9390b5] hover:bg-slate-100 transition-colors">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            {[{ ph: "Full Name", key: "name", type: "text" }, { ph: "919876543210 (no + or spaces)", key: "phone", type: "text" }, { ph: "Email Address", key: "email", type: "email" }].map(({ ph, key, type }) => (
              <input key={key} type={type} placeholder={ph} value={(newContact as any)[key]}
                onChange={e => setNewContact({ ...newContact, [key]: e.target.value })}
                className="placeholder:text-[#c0bed8] focus:outline-none" style={inputStyle} />
            ))}
            <select value={newContact.status} onChange={e => setNewContact({ ...newContact, status: e.target.value })}
              className="focus:outline-none" style={inputStyle}>
              <option>Active</option><option>Inactive</option>
            </select>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}>Cancel</button>
              <button type="button" onClick={handleSave} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>Save</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* View Modal */}
      <Dialog.Root open={!!viewContact} onOpenChange={(open) => { if (!open) setViewContact(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-2xl p-6 bg-white border border-[#ece9f8] shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-bold text-[#1a1040]">Contact Details</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="p-1 rounded-lg text-[#9390b5] hover:bg-slate-100 transition-colors">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            <div className="space-y-1">
              {viewContact && [["Name", viewContact.name], ["Phone", viewContact.phone], ["Email", viewContact.email || "—"], ["Owner / Agent", viewContact.owner_name], ["Status", viewContact.status]].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5" style={{ borderBottom: "1px solid #f0eefb" }}>
                  <span className="text-sm" style={{ color: "#9390b5" }}>{k}</span>
                  <span className="text-sm font-semibold" style={{ color: "#1a1040" }}>{v}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setViewContact(null)} className="mt-5 w-full py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "#f5f4fb", color: "#7c3aed", border: "1px solid #e0ddf5" }}>Close</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
