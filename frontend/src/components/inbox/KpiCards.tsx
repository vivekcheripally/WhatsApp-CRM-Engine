"use client";

import React from "react";
import { MessageSquare, Mail, UserCheck, Clock, Send, Zap } from "lucide-react";
import { useInboxStore } from "@/store/inbox-store";
import { useCurrentUser } from "@/hooks/use-current-user";

export function KpiCards() {
  const { conversations } = useInboxStore();
  const { user } = useCurrentUser();

  const totalOpen = conversations.filter(
    (c) => (c.status || "OPEN").toUpperCase() === "OPEN"
  ).length;

  const totalUnread = conversations.reduce(
    (acc, c) => acc + (c.unread_count || 0),
    0
  );

  const assignedToMe = conversations.filter(
    (c) =>
      c.assignee_id === user?.id ||
      c.assignee?.id === user?.id ||
      c.assignee?.email === user?.email
  ).length;

  const waitingCount = conversations.filter(
    (c) => (c.unread_count || 0) > 0 || (c.status || "").toUpperCase() === "WAITING"
  ).length;

  const campaignReplies = conversations.filter(
    (c) =>
      c.is_broadcast_reply ||
      c.broadcast_campaign_id ||
      (c.tags && c.tags.includes("Campaign Reply"))
  ).length;

  const cards = [
    {
      title: "Open Conversations",
      value: totalOpen || conversations.length,
      icon: MessageSquare,
      color: "#7c3aed",
      bg: "#f3effe",
    },
    {
      title: "Unread Messages",
      value: totalUnread,
      icon: Mail,
      color: "#ec4899",
      bg: "#fce7f3",
    },
    {
      title: "Assigned To Me",
      value: assignedToMe,
      icon: UserCheck,
      color: "#3b82f6",
      bg: "#eff6ff",
    },
    {
      title: "Waiting Queue",
      value: waitingCount,
      icon: Clock,
      color: "#f59e0b",
      bg: "#fef3c7",
    },
    {
      title: "Campaign Replies",
      value: campaignReplies,
      icon: Send,
      color: "#10b981",
      bg: "#d1fae5",
    },
    {
      title: "Avg Response",
      value: "< 2m",
      icon: Zap,
      color: "#8b5cf6",
      bg: "#f5f3ff",
    },
  ];

  return (
    <div className="w-full px-4 py-3 bg-white border-b border-[#ece9f8]">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="flex items-center gap-3 p-2.5 rounded-xl border transition-all hover:shadow-sm"
              style={{ borderColor: "#ece9f8", background: "#fdfcfe" }}
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                style={{ background: card.bg, color: card.color }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium truncate text-slate-500">
                  {card.title}
                </p>
                <p className="text-sm font-bold text-slate-800 leading-tight">
                  {card.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KpiCards;
