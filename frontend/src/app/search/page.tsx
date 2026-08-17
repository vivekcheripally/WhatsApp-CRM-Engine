"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search as SearchIcon,
  User,
  MessageSquare,
  FileText,
  Megaphone,
  ArrowRight,
  Loader2,
  ExternalLink,
  Phone,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import { useInboxStore } from "@/store/inbox-store";

interface SearchResultItem {
  id: string;
  type: "contact" | "conversation" | "template" | "campaign";
  title: string;
  subtitle?: string;
  details?: string;
  status?: string;
  date?: string;
  href: string;
  conversationId?: string;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<"all" | "contact" | "conversation" | "template" | "campaign">("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { setActiveConversation } = useInboxStore();

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);

    try {
      const [contactsRes, convsRes, templatesRes, campaignsRes] = await Promise.allSettled([
        api.get("/api/contacts", { params: { q: searchTerm, limit: 10 } }),
        api.get("/api/conversations", { params: { search: searchTerm, page_size: 10 } }),
        api.get("/api/templates", {}),
        api.get("/api/campaign/list", {}),
      ]);

      const items: SearchResultItem[] = [];
      const termLower = searchTerm.toLowerCase();

      // 1. Contacts
      if (contactsRes.status === "fulfilled") {
        const data: any = contactsRes.value.data;
        const contactList: any[] = Array.isArray(data)
          ? data
          : data?.contacts || data?.items || [];
        contactList.forEach((c: any) => {
          if (
            (c.name && c.name.toLowerCase().includes(termLower)) ||
            (c.phone_number && c.phone_number.includes(termLower)) ||
            (c.email && c.email.toLowerCase().includes(termLower))
          ) {
            items.push({
              id: `contact-${c.id}`,
              type: "contact",
              title: c.name || c.phone_number || "Unnamed Contact",
              subtitle: c.phone_number || c.email,
              details: c.email ? `Email: ${c.email}` : undefined,
              status: c.status || "ACTIVE",
              date: c.created_at,
              href: "/contacts",
            });
          }
        });
      }

      // 2. Conversations
      if (convsRes.status === "fulfilled") {
        const data: any = convsRes.value.data;
        const convList: any[] = data?.items || (Array.isArray(data) ? data : []);
        convList.forEach((c: any) => {
          items.push({
            id: `conv-${c.id}`,
            type: "conversation",
            title: c.customer_name || c.customer_phone || "WhatsApp Conversation",
            subtitle: c.last_message_preview || c.customer_phone,
            details: c.customer_phone ? `Phone: ${c.customer_phone}` : undefined,
            status: c.status || "OPEN",
            date: c.last_message_at || c.updated_at,
            href: "/whatsapp/inbox",
            conversationId: String(c.id),
          });
        });
      }

      // 3. Templates
      if (templatesRes.status === "fulfilled") {
        const data: any = templatesRes.value.data;
        const tmplList: any[] = Array.isArray(data) ? data : data?.templates || [];
        tmplList
          .filter(
            (t: any) =>
              t.template_name?.toLowerCase().includes(termLower) ||
              t.category?.toLowerCase().includes(termLower) ||
              t.body_text?.toLowerCase().includes(termLower)
          )
          .forEach((t: any) => {
            items.push({
              id: `tmpl-${t.id}`,
              type: "template",
              title: t.template_name,
              subtitle: t.category || "Template",
              details: t.language ? `Lang: ${t.language}` : undefined,
              status: t.status || "APPROVED",
              date: t.created_at,
              href: "/templates",
            });
          });
      }

      // 4. Campaigns
      if (campaignsRes.status === "fulfilled") {
        const data: any = campaignsRes.value.data;
        const campList: any[] = Array.isArray(data) ? data : data?.campaigns || [];
        campList
          .filter((c: any) => c.campaign_name?.toLowerCase().includes(termLower))
          .forEach((c: any) => {
            items.push({
              id: `camp-${c.id}`,
              type: "campaign",
              title: c.campaign_name || "Campaign",
              subtitle: `${c.contact_count || 0} recipients`,
              details: c.template_name ? `Template: ${c.template_name}` : undefined,
              status: c.status || "COMPLETED",
              date: c.created_at,
              href: "/campaigns",
            });
          });
      }

      setResults(items);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      performSearch(query.trim());
    }
  };

  const handleNavigate = (item: SearchResultItem) => {
    if (item.type === "conversation" && item.conversationId) {
      setActiveConversation(item.conversationId);
    }
    router.push(item.href);
  };

  const filteredResults = useMemo(() => {
    if (activeTab === "all") return results;
    return results.filter((r) => r.type === activeTab);
  }, [results, activeTab]);

  const counts = useMemo(() => {
    return {
      all: results.length,
      contact: results.filter((r) => r.type === "contact").length,
      conversation: results.filter((r) => r.type === "conversation").length,
      template: results.filter((r) => r.type === "template").length,
      campaign: results.filter((r) => r.type === "campaign").length,
    };
  }, [results]);

  const getIcon = (type: string) => {
    switch (type) {
      case "contact":
        return <User className="h-4 w-4" style={{ color: "#7c3aed" }} />;
      case "conversation":
        return <MessageSquare className="h-4 w-4" style={{ color: "#06b6d4" }} />;
      case "template":
        return <FileText className="h-4 w-4" style={{ color: "#f59e0b" }} />;
      case "campaign":
        return <Megaphone className="h-4 w-4" style={{ color: "#10b981" }} />;
      default:
        return <SearchIcon className="h-4 w-4" style={{ color: "#9390b5" }} />;
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-6" style={{ background: "#f8f7fd" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1a1040" }}>
            Search CRM
          </h1>
          <p className="text-sm mt-1" style={{ color: "#9390b5" }}>
            Search contacts, live conversations, templates, and marketing campaigns.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium hover:underline self-start md:self-auto"
          style={{ color: "#7c3aed" }}
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="relative max-w-2xl">
        <SearchIcon
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "#9390b5" }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone number, keyword, template..."
          className="w-full pl-12 pr-28 py-3.5 rounded-2xl bg-white border border-[#e0ddf5] text-sm text-[#1a1040] placeholder:text-[#b0aed0] focus:outline-none focus:border-[#7c3aed] shadow-sm transition-all"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 px-5 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50 flex items-center gap-1.5"
          style={{
            background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
            boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
          }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
        </button>
      </form>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#ece9f8] pb-3 overflow-x-auto">
        {(
          [
            { id: "all", label: "All Results", count: counts.all },
            { id: "contact", label: "Contacts", count: counts.contact },
            { id: "conversation", label: "Conversations", count: counts.conversation },
            { id: "template", label: "Templates", count: counts.template },
            { id: "campaign", label: "Campaigns", count: counts.campaign },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#7c3aed] text-white shadow-sm"
                : "bg-white text-[#6b679b] hover:bg-[#f0eefb] border border-[#ece9f8]"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === tab.id ? "bg-white/25 text-white" : "bg-[#f5f4fb] text-[#7c3aed]"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Results Container */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-[#ece9f8] shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed] mb-3" />
            <p className="text-sm font-medium text-[#9390b5]">Searching records...</p>
          </div>
        ) : !query.trim() ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#ece9f8] p-8 shadow-sm">
            <SearchIcon className="h-10 w-10 mx-auto text-[#b0aed0] mb-3 opacity-60" />
            <p className="text-base font-semibold text-[#1a1040]">Ready to search</p>
            <p className="text-xs text-[#9390b5] mt-1 max-w-sm mx-auto">
              Type any name, phone number, template title, or campaign to find instant results across your entire CRM.
            </p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#ece9f8] p-8 shadow-sm">
            <Filter className="h-10 w-10 mx-auto text-[#b0aed0] mb-3 opacity-60" />
            <p className="text-base font-semibold text-[#1a1040]">No matches found</p>
            <p className="text-xs text-[#9390b5] mt-1">
              No matching records found for <span className="font-semibold text-[#1a1040]">"{query}"</span> in this category.
            </p>
          </div>
        ) : (
          filteredResults.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNavigate(item)}
              className="bg-white rounded-2xl p-4 md:p-5 border border-[#ece9f8] hover:border-[#7c3aed]/40 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#f5f4fb" }}
                >
                  {getIcon(item.type)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: "#f0eefb", color: "#7c3aed" }}
                    >
                      {item.type}
                    </span>
                    <h3 className="font-semibold text-sm text-[#1a1040] truncate group-hover:text-[#7c3aed] transition-colors">
                      {item.title}
                    </h3>
                    {item.status && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f4fb] text-[#9390b5]">
                        {item.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#9390b5]">
                    {item.subtitle && <span className="truncate">{item.subtitle}</span>}
                    {item.details && <span>• {item.details}</span>}
                    {item.date && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-[#7c3aed] group-hover:translate-x-1 transition-transform flex-shrink-0">
                <span>Open</span>
                <ArrowRight size={14} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
