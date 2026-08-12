"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { UserPlus, X, Search } from "lucide-react";
import { useAssignAgent } from "@/hooks/use-conversations";
import { useAgents } from "@/hooks/use-agents";
import { getInitials } from "@/lib/utils";

interface AssignAgentModalProps {
  conversationId: string;
  currentAgentId?: string;
  children: React.ReactNode;
}

export function AssignAgentModal({ conversationId, currentAgentId, children }: AssignAgentModalProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { mutateAsync, isPending } = useAssignAgent();
  const { agents, isLoading } = useAgents();

  const filtered = agents.filter(a =>
    (a.full_name || a.email || "").toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async (agentId: string) => {
    await mutateAsync({ conversationId, agentId });
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 shadow-2xl"
          style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-semibold text-base flex items-center gap-2" style={{ color: "#1a1d23" }}>
              <UserPlus className="h-4 w-4" style={{ color: "#7c3aed" }} />
              Assign Agent
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="flex items-center justify-center w-7 h-7 rounded-lg"
                style={{ background: "#f5f6fa", color: "#9498b0" }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "#b0b3c6" }} />
            <input
              placeholder="Search agents…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl focus:outline-none"
              style={{ background: "#f5f6fa", border: "1.5px solid #e8eaf0", color: "#1a1d23" }}
            />
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto">
            {currentAgentId && (
              <button
                type="button"
                onClick={() => handleAssign("")}
                disabled={isPending}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 border border-rose-100 mb-2"
              >
                <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">✕</span>
                <span>Unassign / Release to Queue</span>
              </button>
            )}

            {isLoading ? (
              <p className="text-xs text-center py-4" style={{ color: "#9498b0" }}>Loading agents…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "#9498b0" }}>No agents found.</p>
            ) : (
              filtered.map((agent) => {
                const channelsCount = (agent as any).assigned_channels_count ?? (agent.assigned_channels || (agent as any).assigned_channel_ids || []).length;
                const openChatsCount = (agent as any).open_chats_count ?? 0;
                const campaignsCount = (agent as any).assigned_campaigns_count ?? 0;
                const isOnline = (agent.status || "ACTIVE").toUpperCase() === "ACTIVE";

                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleAssign(agent.id)}
                    disabled={isPending}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors disabled:opacity-50"
                    style={{ color: "#4b4f6b" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold"
                        style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                        {getInitials(agent.full_name || agent.email)}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          isOnline ? "bg-emerald-500" : "bg-gray-400"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#1a1d23" }}>
                        <span className="text-[10px]">{isOnline ? "🟢" : "⚪"}</span>
                        <span>{agent.full_name || agent.email}</span>
                      </p>
                      <p className="text-[11px] truncate font-medium mt-0.5" style={{ color: "#7c3aed" }}>
                        Channels: {channelsCount} <span className="text-gray-300">|</span> Open Chats: {openChatsCount} <span className="text-gray-300">|</span> Campaigns: {campaignsCount}
                      </p>
                    </div>
                    {currentAgentId === agent.id && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#f0eeff", color: "#7c3aed" }}>
                        Current
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
