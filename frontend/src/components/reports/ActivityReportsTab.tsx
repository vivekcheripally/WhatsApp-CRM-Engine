"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  ChevronDown,
  MoreHorizontal,
  Megaphone,
  MessageCircle,
  UserPlus,
  FileText,
  RefreshCw,
  Check,
  Copy,
  ExternalLink,
  X,
  History,
} from "lucide-react";
import { getRecentActivities } from "../../services/templateService";

export interface ActivityItem {
  id: number | string;
  type: string;
  status: string;
  title: string;
  subtitle: string;
  description: string;
  time: string;
  rawDate: Date | null;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  icon: React.ElementType;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day ago`;
}

function activityToItem(a: any, idx: number): ActivityItem {
  const type = (a.type || "template").toLowerCase();
  const status = (a.status || "").toUpperCase();
  const action = (a.action || "").toLowerCase();
  const rawDate = a.created_at
    ? new Date(a.created_at)
    : a.timestamp
    ? new Date(a.timestamp)
    : null;

  if (type === "campaign") {
    let title = a.title || "Campaign Activity";
    if (!a.title) {
      if (status === "COMPLETED") title = "Campaign Completed";
      else if (status === "SENDING") title = "Campaign Sending";
      else if (status === "SCHEDULED") title = "Campaign Scheduled";
      else title = action === "created" ? "Campaign Created" : "Campaign Updated";
    }
    return {
      id: a.id ?? idx,
      type: "campaign",
      status,
      title,
      subtitle: a.subtitle || a.campaign_name || "Campaign",
      description: a.description || `Status: ${status}`,
      time: rawDate ? timeAgo(rawDate.toISOString()) : "",
      rawDate,
      borderColor: "#a78bfa",
      iconBg: "rgba(167,139,250,0.18)",
      iconColor: "#7c3aed",
      icon: Megaphone,
    };
  }

  if (type === "contact") {
    let title = a.title || (action === "created" ? "Contact Added" : "Contact Updated");
    return {
      id: a.id ?? idx,
      type: "contact",
      status,
      title,
      subtitle: a.subtitle || a.name || a.phone_number || "Contact",
      description: a.description || `Status: ${status}`,
      time: rawDate ? timeAgo(rawDate.toISOString()) : "",
      rawDate,
      borderColor: "#60a5fa",
      iconBg: "rgba(96,165,250,0.18)",
      iconColor: "#3b82f6",
      icon: UserPlus,
    };
  }

  if (type === "message") {
    let title =
      a.title ||
      (status === "DELIVERED"
        ? "Message Delivered"
        : status === "READ"
        ? "Message Read"
        : "Message Sent");
    let borderColor = "#34d399";
    let iconBg = "rgba(52,211,153,0.18)";
    let iconColor = "#10b981";
    if (status === "FAILED") {
      borderColor = "#f87171";
      iconBg = "rgba(248,113,113,0.18)";
      iconColor = "#ef4444";
    }
    return {
      id: a.id ?? idx,
      type: "message",
      status,
      title,
      subtitle: a.subtitle || a.sender_id || a.recipient || "WhatsApp Message",
      description: a.description || a.content || `Status: ${status}`,
      time: rawDate ? timeAgo(rawDate.toISOString()) : "",
      rawDate,
      borderColor,
      iconBg,
      iconColor,
      icon: MessageCircle,
    };
  }

  // Template (default)
  const templateName = a.template_name || a.subtitle || "Template";
  let title = a.title || "Template Activity";
  let description = a.description || "";
  let borderColor = "#fbbf24";
  let iconBg = "rgba(251,191,36,0.18)";
  let iconColor = "#f59e0b";
  let icon: React.ElementType = FileText;

  if (status === "APPROVED") {
    title = "Template Approved";
    description = description || "Template is approved and ready to use";
    borderColor = "#34d399";
    iconBg = "rgba(52,211,153,0.18)";
    iconColor = "#10b981";
  } else if (status === "REJECTED") {
    title = "Template Rejected";
    description = description || "Template was rejected by Meta";
    borderColor = "#f87171";
    iconBg = "rgba(248,113,113,0.18)";
    iconColor = "#ef4444";
  } else if (["PENDING", "PENDING_REVIEW", "IN_APPEAL"].includes(status)) {
    title = action === "created" ? "Template Created" : "Template Updated";
    description =
      description ||
      (action === "created"
        ? "Template submitted for review"
        : "Template changes submitted for review");
    borderColor = "#a78bfa";
    iconBg = "rgba(167,139,250,0.18)";
    iconColor = "#7c3aed";
  } else {
    title = action === "created" ? "Template Created" : "Template Updated";
    description = description || (status ? `Status: ${status}` : "");
  }

  return {
    id: a.id ?? idx,
    type: "template",
    status,
    title,
    subtitle: templateName,
    description,
    time: rawDate ? timeAgo(rawDate.toISOString()) : "",
    rawDate,
    borderColor,
    iconBg,
    iconColor,
    icon,
  };
}

const FALLBACK: ActivityItem[] = [
  {
    id: 1,
    type: "campaign",
    status: "COMPLETED",
    title: "Campaign Completed",
    subtitle: "Order Update*",
    description: "Completed successfully and sent to 1,250 contacts",
    time: "2 min ago",
    rawDate: new Date(Date.now() - 2 * 60000),
    borderColor: "#a78bfa",
    iconBg: "rgba(167,139,250,0.18)",
    iconColor: "#7c3aed",
    icon: Megaphone,
  },
  {
    id: 2,
    type: "message",
    status: "DELIVERED",
    title: "Message Delivered",
    subtitle: "+91 9876543210",
    description: "Your message was delivered successfully",
    time: "5 min ago",
    rawDate: new Date(Date.now() - 5 * 60000),
    borderColor: "#34d399",
    iconBg: "rgba(52,211,153,0.18)",
    iconColor: "#10b981",
    icon: MessageCircle,
  },
  {
    id: 3,
    type: "contact",
    status: "ADDED",
    title: "Contact Added",
    subtitle: "Rahul Sharma",
    description: "Added by Nimisha",
    time: "30 min ago",
    rawDate: new Date(Date.now() - 30 * 60000),
    borderColor: "#60a5fa",
    iconBg: "rgba(96,165,250,0.18)",
    iconColor: "#3b82f6",
    icon: UserPlus,
  },
  {
    id: 4,
    type: "template",
    status: "APPROVED",
    title: "Template Approved",
    subtitle: "order_confirmation_v2",
    description: "Template is approved and ready to use",
    time: "45 min ago",
    rawDate: new Date(Date.now() - 45 * 60000),
    borderColor: "#fbbf24",
    iconBg: "rgba(251,191,36,0.18)",
    iconColor: "#f59e0b",
    icon: FileText,
  },
];

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== "all" && value !== "newest";
  const display = options.find((o) => o.value === value)?.label ?? label;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
        style={{
          background: active ? "rgba(124,58,237,0.08)" : "#fff",
          border: `1px solid ${active ? "#a78bfa" : "#e0ddf5"}`,
          color: active ? "#7c3aed" : "#6b7280",
        }}
      >
        {display}
        <ChevronDown
          size={13}
          style={{
            color: active ? "#7c3aed" : "#9390b5",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full mt-1.5 left-0 z-50 rounded-xl overflow-hidden shadow-lg"
          style={{ background: "#fff", border: "1px solid #ece9f8", minWidth: 150 }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="flex items-center justify-between w-full px-4 py-2 text-xs text-left hover:bg-purple-50 transition-colors cursor-pointer"
              style={{
                color: value === opt.value ? "#7c3aed" : "#4b4880",
                fontWeight: value === opt.value ? 600 : 400,
              }}
            >
              {opt.label}
              {value === opt.value && <Check size={13} style={{ color: "#7c3aed" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function KebabMenu({ item, onDismiss }: { item: ActivityItem; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const copyName = () => {
    navigator.clipboard.writeText(item.subtitle).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setOpen(false);
  };

  const menuItems = [
    { label: copied ? "Copied!" : "Copy Name", icon: Copy, action: copyName },
    ...(item.type === "template"
      ? [
          {
            label: "View on Templates",
            icon: ExternalLink,
            action: () => {
              window.location.href = "/templates";
              setOpen(false);
            },
          },
        ]
      : []),
    {
      label: "Dismiss",
      icon: X,
      action: () => {
        onDismiss();
        setOpen(false);
      },
      danger: true,
    },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-1 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer"
        style={{ color: "#c0bed8" }}
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 rounded-xl overflow-hidden shadow-lg"
          style={{ background: "#fff", border: "1px solid #ece9f8", minWidth: 170 }}
        >
          {menuItems.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.label}
                type="button"
                onClick={m.action}
                className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-left hover:bg-purple-50 transition-colors cursor-pointer"
                style={{ color: (m as any).danger ? "#ef4444" : "#4b4880" }}
              >
                <Icon size={13} />
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  item,
  onDismiss,
}: {
  item: ActivityItem;
  onDismiss: () => void;
}) {
  const Icon = item.icon;
  return (
    <div
      className="flex items-start gap-4 px-5 py-4 rounded-2xl transition-all hover:shadow-md hover:-translate-y-px"
      style={{
        background: "#fff",
        border: "1px solid #ece9f8",
        borderLeft: `4px solid ${item.borderColor}`,
        boxShadow: "0 1px 4px rgba(100,80,200,0.06)",
      }}
    >
      <div
        className="flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
        style={{ width: 42, height: 42, background: item.iconBg }}
      >
        <Icon size={18} style={{ color: item.iconColor }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: "#1a1040" }}>
          {item.title}
        </p>
        {item.subtitle && (
          <p className="text-xs font-semibold mt-0.5" style={{ color: "#4b4880" }}>
            {item.subtitle}
          </p>
        )}
        {item.description && (
          <p className="text-xs mt-1" style={{ color: "#9390b5" }}>
            {item.description}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-xs whitespace-nowrap" style={{ color: "#b0aed0" }}>
          {item.time}
        </span>
        <KebabMenu item={item} onDismiss={onDismiss} />
      </div>
    </div>
  );
}

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "template", label: "Template" },
  { value: "campaign", label: "Campaign" },
  { value: "message", label: "Message" },
  { value: "contact", label: "Contact" },
];
const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "APPROVED", label: "Approved" },
  { value: "PENDING", label: "Pending" },
  { value: "REJECTED", label: "Rejected" },
];
const DATE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

function inDateRange(item: ActivityItem, range: string): boolean {
  if (range === "all" || !item.rawDate) return true;
  const now = Date.now();
  const ms = now - item.rawDate.getTime();
  if (range === "today") return ms < 86400000;
  if (range === "week") return ms < 604800000;
  if (range === "month") return ms < 2592000000;
  return true;
}

export function ActivityReportsTab() {
  const [allItems, setAllItems] = useState<ActivityItem[]>(FALLBACK);
  const [dismissed, setDismissed] = useState<Set<number | string>>(new Set());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const data = await getRecentActivities(100);
        const raw: any[] = Array.isArray(data)
          ? data
          : (data as any)?.activities ?? (data as any)?.results ?? [];
        if (raw.length > 0) {
          setAllItems(raw.map((a: any, i: number) => activityToItem(a, i)));
        }
      } catch {
        /* keep FALLBACK */
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const dismiss = (id: number | string) =>
    setDismissed((prev) => new Set([...prev, id]));

  const filtered = allItems
    .filter((it) => !dismissed.has(it.id))
    .filter((it) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !it.title.toLowerCase().includes(q) &&
          !it.subtitle.toLowerCase().includes(q) &&
          !it.description.toLowerCase().includes(q)
        )
          return false;
      }
      if (typeFilter !== "all" && it.type !== typeFilter) return false;
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      if (!inDateRange(it, dateFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = a.rawDate?.getTime() ?? 0;
      const tb = b.rawDate?.getTime() ?? 0;
      return sort === "newest" ? tb - ta : ta - tb;
    });

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;
  const activeFilters = [typeFilter, statusFilter, dateFilter].filter(
    (v) => v !== "all"
  ).length;

  const clearAll = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setDateFilter("all");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-3xl border border-[#7c3aed]/12 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[200px] max-w-sm"
            style={{ background: "#f8f7fd", border: "1px solid #e0ddf5" }}
          >
            <Search size={14} style={{ color: "#b0aed0", flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search recent activity..."
              className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-[#c0bed8]"
              style={{ color: "#1a1040" }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                style={{ color: "#c0bed8" }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <FilterDropdown
            label="Type"
            value={typeFilter}
            options={TYPE_OPTIONS}
            onChange={(v) => {
              setTypeFilter(v);
              setPage(1);
            }}
          />
          <FilterDropdown
            label="Date"
            value={dateFilter}
            options={DATE_OPTIONS}
            onChange={(v) => {
              setDateFilter(v);
              setPage(1);
            }}
          />
          <FilterDropdown
            label="Status"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          />
          <FilterDropdown
            label="Newest"
            value={sort}
            options={SORT_OPTIONS}
            onChange={(v) => {
              setSort(v);
              setPage(1);
            }}
          />
        </div>

        {activeFilters > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80 cursor-pointer"
            style={{
              background: "rgba(124,58,237,0.1)",
              color: "#7c3aed",
              border: "1px solid #a78bfa",
            }}
          >
            <X size={11} /> Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* ── Count ── */}
      {!isLoading && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold" style={{ color: "#9390b5" }}>
            {filtered.length} {filtered.length === 1 ? "activity" : "activities"} logged
          </p>
        </div>
      )}

      {/* ── Activity list ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-3xl border border-[#7c3aed]/12">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "#7c3aed", borderTopColor: "transparent" }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-3xl border border-[#7c3aed]/12"
          style={{ color: "#9390b5" }}
        >
          <Search size={32} style={{ opacity: 0.3 }} />
          <p className="text-sm font-medium">No activity matching your filters</p>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-semibold text-[#7c3aed] cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <ActivityCard
              key={item.id}
              item={item}
              onDismiss={() => dismiss(item.id)}
            />
          ))}
        </div>
      )}

      {/* ── Load more ── */}
      {hasMore && (
        <div className="flex justify-center pt-2 pb-6">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-xl bg-white border border-[#7c3aed]/20 shadow-sm hover:bg-[#7c3aed]/5 transition-all cursor-pointer"
            style={{ color: "#7c3aed" }}
          >
            <RefreshCw size={13} />
            Load more ({filtered.length - visible.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
