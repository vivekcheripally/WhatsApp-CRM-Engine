"use client";

import { useEffect, useState } from "react";
import { useInboxStore } from "@/store/inbox-store";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatWindow } from "@/components/inbox/ChatWindow";
import { CustomerPanel } from "@/components/inbox/CustomerPanel";
import { useConversation, useMarkConversationRead } from "@/hooks/use-conversations";
import { MessageSquareDashed, Lock, UserPlus, UploadCloud, Plus, Zap, Sparkles, Send, Rocket, Calendar } from "lucide-react";
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
  const [initialTab, setInitialTab] = useState<"send" | "campaign" | "schedule">("send");
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

  const handleOpenAction = (tab: "send" | "campaign" | "schedule") => {
    setInitialTab(tab);
    setQuickDrawerOpen(true);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#f5f6fa]">
      {/* ── TOP ACTION BAR / TOOLBAR ── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-[#ece9f8]">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => handleOpenAction("send")}
            className="inline-flex items-center gap-2 font-bold text-sm transition-all hover:opacity-80 cursor-pointer"
            style={{ color: "#7c3aed" }}
          >
            <Send className="w-4 h-4 stroke-[2.2]" style={{ color: "#7c3aed" }} />
            <span>Send Message</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAction("campaign")}
            className="inline-flex items-center gap-2 font-medium text-sm text-[#475569] hover:text-[#1e293b] transition-colors cursor-pointer"
          >
            <Rocket className="w-4 h-4 text-[#64748b]" />
            <span>Run Campaign</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAction("schedule")}
            className="inline-flex items-center gap-2 font-medium text-sm text-[#475569] hover:text-[#1e293b] transition-colors cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-[#64748b]" />
            <span>Schedule Message</span>
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
            <EmptyState onOpenQuickActions={() => handleOpenAction("send")} />
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
        initialTab={initialTab}
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
    <div className="flex flex-1 flex-col items-center justify-center p-8 select-none bg-[#efeae2] text-center">
      <div
        className="flex items-center justify-center w-20 h-20 rounded-3xl mb-4 shadow-sm"
        style={{ background: "#d9fdd3", border: "1.5px solid #00806933" }}
      >
        <MessageSquareDashed className="w-10 h-10 text-[#008069]" />
      </div>

      <h2 className="text-xl font-bold text-[#111b21]">Welcome to WhatsApp Workspace</h2>
      <p className="text-xs text-[#667781] mt-1 max-w-sm">
        Select a conversation from the sidebar or launch a quick action to start engaging with customers.
      </p>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3 my-6 w-full max-w-xs">
        <div className="p-3 rounded-2xl bg-white border border-[#e9edef] shadow-sm">
          <p className="text-[11px] text-[#667781] font-medium uppercase">Active Threads</p>
          <p className="text-lg font-bold text-[#111b21]">{conversations.length}</p>
        </div>
        <div className="p-3 rounded-2xl bg-white border border-[#e9edef] shadow-sm">
          <p className="text-[11px] text-[#667781] font-medium uppercase">Unread Messages</p>
          <p className="text-lg font-bold text-[#008069]">{unreadCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenQuickActions}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs text-white shadow-md transition-all hover:opacity-95"
          style={{ background: "#008069" }}
        >
          <Sparkles className="w-4 h-4" />
          <span>Launch Quick Action</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-[#667781] mt-8">
        <Lock className="w-3 h-3" />
        End-to-end encrypted messaging workspace
      </div>
    </div>
  );
}
