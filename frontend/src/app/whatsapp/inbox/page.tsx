"use client";

import { useEffect, useState } from "react";
import { useInboxStore } from "@/store/inbox-store";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatWindow } from "@/components/inbox/ChatWindow";
import { CustomerPanel } from "@/components/inbox/CustomerPanel";
import { useConversation, useMarkConversationRead } from "@/hooks/use-conversations";
import { MessageSquareDashed, Lock, UserPlus, UploadCloud, Plus, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiCards } from "@/components/inbox/KpiCards";
import { QuickActionsDrawer } from "@/components/inbox/QuickActionsDrawer";
import { AddContactModal } from "@/components/inbox/AddContactModal";
import { BulkUploadModal } from "@/components/inbox/BulkUploadModal";

export default function InboxPage() {
  const { activeConversationId, setActiveConversation, updateConversation, conversations } = useInboxStore();
  const { data: conversation } = useConversation(activeConversationId);
  const { mutate: markConversationRead } = useMarkConversationRead();
  
  const [panelOpen, setPanelOpen] = useState(false);
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  // Close customer panel when switching conversations
  useEffect(() => {
    setPanelOpen(false);
    if (activeConversationId) {
      updateConversation(activeConversationId, { unread_count: 0 });
      markConversationRead(activeConversationId);
    }
  }, [activeConversationId, markConversationRead, updateConversation]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#f5f6fa]">
      {/* ── TOP: KPI CARDS BAR ── */}
      <KpiCards />

      {/* ── TOP ACTION BAR / TOOLBAR ── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-[#ece9f8]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setQuickDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-semibold text-xs text-white shadow-sm transition-all hover:opacity-95"
            style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
          >
            <Plus className="w-4 h-4" />
            <span>Quick Action</span>
          </button>

          <button
            type="button"
            onClick={() => setAddContactOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs border transition-colors hover:bg-purple-50"
            style={{ borderColor: "#ece9f8", color: "#7c3aed" }}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Contact</span>
          </button>

          <button
            type="button"
            onClick={() => setBulkUploadOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs border transition-colors hover:bg-slate-50"
            style={{ borderColor: "#ece9f8", color: "#4b4f6b" }}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Bulk Upload CSV</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">
            {conversations.length} active threads
          </span>
        </div>
      </div>

      {/* ── MAIN 3-COLUMN WORKSPACE ── */}
      <div className="flex flex-1 h-full overflow-hidden relative">
        {/* ── LEFT: CONVERSATION LIST (340px) ── */}
        <div
          className={cn(
            "flex flex-col h-full flex-shrink-0 border-r border-[#ece9f8] bg-white transition-all",
            activeConversationId ? "hidden md:flex" : "flex w-full md:w-[340px]"
          )}
          style={{ width: "340px", minWidth: "340px" }}
        >
          <ConversationList />
        </div>

        {/* ── CENTER: LIVE CHAT WINDOW ── */}
        <div
          className={cn(
            "flex flex-col flex-1 h-full overflow-hidden relative bg-[#f5f6fa]",
            !activeConversationId ? "hidden md:flex" : "flex"
          )}
        >
          {activeConversationId ? (
            <ChatWindow
              conversationId={activeConversationId}
              onBack={() => setActiveConversation(null)}
              onContactClick={() => setPanelOpen((v) => !v)}
            />
          ) : (
            <EmptyState onOpenQuickActions={() => setQuickDrawerOpen(true)} />
          )}
        </div>

        {/* ── RIGHT: COLLAPSIBLE CUSTOMER SIDEBAR (300px) ── */}
        {activeConversationId && conversation && (
          <div
            className="flex-shrink-0 h-full overflow-y-auto transition-all duration-300 ease-in-out bg-white"
            style={{
              width: panelOpen ? "300px" : "0px",
              minWidth: panelOpen ? "300px" : "0px",
              borderLeft: panelOpen ? "1px solid #ece9f8" : "none",
              overflow: panelOpen ? "auto" : "hidden",
            }}
          >
            {panelOpen && (
              <CustomerPanel
                conversation={conversation}
                onClose={() => setPanelOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* ── MODALS & DRAWERS ── */}
      <QuickActionsDrawer
        open={quickDrawerOpen}
        onOpenChange={setQuickDrawerOpen}
        onConversationReady={(id) => setActiveConversation(id)}
      />

      <AddContactModal
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
      />

      <BulkUploadModal
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Improved Empty State Workspace
───────────────────────────────────────────── */
function EmptyState({ onOpenQuickActions }: { onOpenQuickActions: () => void }) {
  const { conversations } = useInboxStore();
  const unreadCount = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 select-none bg-[#f5f6fa] text-center">
      <div
        className="flex items-center justify-center w-20 h-20 rounded-3xl mb-4 shadow-sm"
        style={{ background: "linear-gradient(135deg,#7c3aed22,#4f46e511)", border: "1.5px solid #7c3aed33" }}
      >
        <MessageSquareDashed className="w-10 h-10 text-purple-600" />
      </div>

      <h2 className="text-xl font-bold text-slate-800">Welcome Back to FastSales Workspace</h2>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">
        Select a conversation from the sidebar or launch a quick action to start engaging with customers.
      </p>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3 my-6 w-full max-w-xs">
        <div className="p-3 rounded-2xl bg-white border border-[#ece9f8] shadow-sm">
          <p className="text-[11px] text-slate-400 font-medium uppercase">Active Threads</p>
          <p className="text-lg font-bold text-slate-800">{conversations.length}</p>
        </div>
        <div className="p-3 rounded-2xl bg-white border border-[#ece9f8] shadow-sm">
          <p className="text-[11px] text-slate-400 font-medium uppercase">Unread Messages</p>
          <p className="text-lg font-bold text-purple-600">{unreadCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenQuickActions}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs text-white shadow-md transition-all hover:opacity-95"
          style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
        >
          <Sparkles className="w-4 h-4" />
          <span>Launch Quick Action</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-8">
        <Lock className="w-3 h-3" />
        End-to-end encrypted messaging workspace
      </div>
    </div>
  );
}
