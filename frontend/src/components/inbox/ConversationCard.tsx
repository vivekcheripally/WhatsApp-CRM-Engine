"use client";
import { motion } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Archive, MoreVertical, Trash2, Pin, Star, CheckCheck, Check, Clock } from "lucide-react";
import { cn, formatMessageTime, truncate } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ContactAvatar } from "./ContactAvatar";
import { useArchiveConversation, useDeleteConversation, useUpdateConversation } from "@/hooks/use-conversations";
import { useInboxStore } from "@/store/inbox-store";
import type { Conversation } from "@/lib/types";

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

/** Mini delivery icon for conversation list preview */
function PreviewTick({ status }: { status?: string }) {
  if (!status) return null;
  switch (status) {
    case "PENDING":
      return <Clock className="h-3 w-3 shrink-0" style={{ color: "#b0b3c6" }} />;
    case "SENT":
      return <Check className="h-3 w-3 shrink-0" style={{ color: "#b0b3c6" }} />;
    case "DELIVERED":
      return <CheckCheck className="h-3 w-3 shrink-0" style={{ color: "#b0b3c6" }} />;
    case "READ":
      return <CheckCheck className="h-3 w-3 shrink-0" style={{ color: "#53bdeb" }} />;
    default:
      return null;
  }
}

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationCard({ conversation, isActive, onClick }: ConversationCardProps) {
  const { setActiveConversation } = useInboxStore();
  const { mutateAsync: archiveConv } = useArchiveConversation();
  const { mutateAsync: deleteConv } = useDeleteConversation();
  const { mutateAsync: updateConv } = useUpdateConversation();

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await archiveConv({ id: conversation.id, archive: !conversation.is_archived });
  };
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    await deleteConv(conversation.id);
    setActiveConversation(null);
  };
  const handleToggleWaiting = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = conversation.status === "PENDING" ? "OPEN" : "PENDING";
    await updateConv({ id: conversation.id, status: newStatus });
  };

  const hasUnread = conversation.unread_count > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="relative flex items-center gap-3 px-5 py-3.5 cursor-pointer group transition-colors"
      style={{
        background: isActive ? "#f0eeff" : "transparent",
        borderLeft: isActive ? "3px solid #7c3aed" : "3px solid transparent",
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#fafafa"; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <ContactAvatar
          name={conversation.customer_name}
          phone={conversation.customer_phone}
          className="h-11 w-11"
        />
        {/* Online dot — shown when unread */}
        {hasUnread && (
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
            style={{ background: "#22c55e" }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-[14px] font-semibold truncate"
            style={{ color: "#1a1d23" }}
          >
            {conversation.customer_name || conversation.customer_phone}
          </span>
          <span
            className="text-[11px] shrink-0 whitespace-nowrap"
            style={{ color: hasUnread ? "#7c3aed" : "#b0b3c6" }}
          >
            {conversation.last_message_at
              ? (() => {
                  try {
                    const raw = conversation.last_message_at;
                    if (!raw) return "";
                    const utc = raw.endsWith("Z") || raw.includes("+") ? raw : raw + "Z";
                    let d = new Date(utc);
                    if (isNaN(d.getTime())) d = new Date(raw);
                    if (isNaN(d.getTime())) return "";
                    if (isToday(d)) return format(d, "h:mm a");
                    if (isYesterday(d)) return "Yesterday";
                    return format(d, "dd/MM/yyyy");
                  } catch {
                    return "";
                  }
                })()
              : ""}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {/* Delivery tick before the preview — only for agent's last message */}
            {conversation.last_message_sender === "AGENT" && (
              <PreviewTick status={conversation.last_message_status} />
            )}
            <p
              className="text-[12.5px] truncate"
              style={{ color: hasUnread ? "#4b4f6b" : "#9498b0", fontWeight: hasUnread ? 500 : 400 }}
            >
              {conversation.last_message_preview
                ? truncate(conversation.last_message_preview, 30)
                : <span className="italic" style={{ color: "#c0c3d6" }}>No messages yet</span>}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Unread badge */}
            {hasUnread && (
              <span
                className="flex items-center justify-center min-w-[20px] h-5 rounded-full text-white text-[10px] font-bold px-1.5"
                style={{ background: "#7c3aed" }}
              >
                {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
              </span>
            )}
          </div>
        </div>

        {/* Badges & Tags Row */}
        <div className="flex items-center gap-1 mt-1 overflow-x-auto scrollbar-none">
          {(conversation.is_broadcast_reply || conversation.broadcast_campaign_id) && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
              Campaign Reply
            </span>
          )}
          {conversation.assignee?.full_name && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-50 text-purple-600 border border-purple-100 shrink-0 truncate max-w-[90px]">
              {conversation.assignee.full_name.split(" ")[0]}
            </span>
          )}
          {conversation.tags?.map((t: string, i: number) => (
            <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 shrink-0">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Context menu (hover) */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              onClick={e => e.stopPropagation()}
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
              style={{ background: "#f0eeff", color: "#7c3aed" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#e5e0ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "#f0eeff")}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-50 min-w-[160px] rounded-xl p-1 text-sm shadow-xl"
              style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
            >
              <DropdownMenu.Item
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer outline-none text-sm transition-colors"
                style={{ color: "#4b4f6b" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                onSelect={e => { e.preventDefault(); handleToggleWaiting(e as any); }}
              >
                <Clock className="h-4 w-4" style={{ color: "#9498b0" }} />
                {conversation.status === "PENDING" ? "Mark as Open" : "Mark as Waiting"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer outline-none text-sm transition-colors"
                style={{ color: "#4b4f6b" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                onSelect={e => { e.preventDefault(); handleArchive(e as any); }}
              >
                <Archive className="h-4 w-4" style={{ color: "#9498b0" }} />
                {conversation.is_archived ? "Unarchive" : "Archive chat"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer outline-none text-sm transition-colors"
                style={{ color: "#ef4444" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fff5f5")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                onSelect={e => { e.preventDefault(); handleDelete(e as any); }}
              >
                <Trash2 className="h-4 w-4" />
                Delete chat
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </motion.div>
  );
}
