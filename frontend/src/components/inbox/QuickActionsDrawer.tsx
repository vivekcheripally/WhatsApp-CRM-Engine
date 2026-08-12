"use client";

import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Send, Rocket, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { getContacts } from "@/services/contactService";
import { getTemplates } from "@/services/templateService";
import { listCampaigns, runCampaign } from "@/services/campaignService";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useInboxStore } from "@/store/inbox-store";

interface QuickActionsDrawerProps {
  onConversationReady: (id: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QuickActionsDrawer({
  onConversationReady,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: QuickActionsDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;

  const [activeTab, setActiveTab] = useState<"send" | "campaign" | "schedule">("send");

  // Send Message State
  const [contacts, setContacts] = useState<{ id: string | number; name: string; phone_number: string }[]>([]);
  const [templates, setTemplates] = useState<{ id: string | number; template_name: string; meta_status?: string }[]>([]);
  const [selectedContact, setSelectedContact] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  // Run Campaign State
  const [campaigns, setCampaigns] = useState<{ id: string | number; campaign_name: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<string | null>(null);

  // Schedule Message State
  const [scheduleContact, setScheduleContact] = useState("");
  const [scheduleTemplate, setScheduleTemplate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);

  const qc = useQueryClient();
  const { addMessage } = useInboxStore();

  useEffect(() => {
    if (isOpen) {
      getContacts()
        .then((res) => {
          const items = Array.isArray(res) ? res : res?.contacts ?? res?.items ?? [];
          setContacts(items);
        })
        .catch(() => {});

      getTemplates()
        .then((res) => {
          const items: any[] = Array.isArray(res) ? res : res?.templates ?? res?.items ?? [];
          setTemplates(items.filter((t) => (t.meta_status || t.status || "").toUpperCase() === "APPROVED"));
        })
        .catch(() => {});

      listCampaigns()
        .then((res) => {
          const items: any[] = Array.isArray(res) ? res : res?.campaigns ?? [];
          setCampaigns(items);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!selectedContact || !selectedTemplate) return;
    const contact = contacts.find((c) => String(c.id) === selectedContact);
    if (!contact) return;

    setSendLoading(true);
    setSendStatus(null);

    try {
      const { data: sendData } = await api.post("/api/whatsapp/send", {
        to: contact.phone_number,
        template_name: selectedTemplate,
      });

      if (sendData?.success === false) {
        setSendStatus(`Error: ${sendData?.error ?? "Send failed"}`);
        return;
      }

      const { data: convData } = await api.post("/api/conversations", {
        customer_phone: contact.phone_number,
        customer_name: contact.name,
      });

      const conversationId = String(convData?.conversation?.id ?? convData?.id ?? "");
      if (conversationId && conversationId !== "undefined") {
        if (sendData?.message) {
          addMessage({
            ...sendData.message,
            conversation_id: conversationId,
            id: sendData.message.id ?? String(Date.now()),
            reactions: [],
            media_files: [],
          });
        }

        qc.invalidateQueries({ queryKey: ["conversations"] });
        qc.invalidateQueries({ queryKey: ["messages", conversationId] });
        setSelectedContact("");
        setSelectedTemplate("");
        setSendStatus("Sent! Opening conversation...");
        setTimeout(() => {
          onConversationReady(conversationId);
          setOpen(false);
        }, 500);
      }
    } catch (e: any) {
      setSendStatus(`Error: ${e?.message || "Failed to send."}`);
    } finally {
      setSendLoading(false);
    }
  };

  const handleRunCampaign = async () => {
    if (!selectedCampaign) return;
    setCampaignLoading(true);
    setCampaignStatus(null);
    try {
      const result = await runCampaign(selectedCampaign);
      if (result?.success === false) {
        setCampaignStatus(`Error: ${result.error || "Failed to run campaign"}`);
      } else {
        const count = result?.recipient_count ?? 0;
        setCampaignStatus(
          count > 0
            ? `Campaign dispatch started for ${count} contact${count !== 1 ? "s" : ""}`
            : "Campaign dispatch started"
        );
        setSelectedCampaign("");
      }
    } catch {
      setCampaignStatus("Error running campaign.");
    } finally {
      setCampaignLoading(false);
    }
  };

  const handleScheduleMessage = async () => {
    if (!scheduleContact || !scheduleTemplate || !scheduledTime) return;
    setScheduleLoading(true);
    setScheduleStatus(null);
    try {
      const contact = contacts.find((c) => String(c.id) === scheduleContact);
      await api.post("/api/whatsapp/schedule", {
        to: contact?.phone_number,
        template_name: scheduleTemplate,
        scheduled_at: scheduledTime,
      });
      setScheduleStatus("Message scheduled successfully!");
      setScheduleContact("");
      setScheduleTemplate("");
      setScheduledTime("");
    } catch (e: any) {
      setScheduleStatus(`Error: ${e?.message || "Failed to schedule."}`);
    } finally {
      setScheduleLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      {externalOpen === undefined && (
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold text-xs text-white shadow-md transition-all hover:opacity-90"
            style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
          >
            <Plus className="w-4 h-4" />
            <span>Quick Actions</span>
          </button>
        </Dialog.Trigger>
      )}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-[#ece9f8]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#ece9f8]" style={{ background: "#f8f7fd" }}>
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-purple-600" />
              <Dialog.Title className="font-bold text-base text-slate-900">
                Quick Actions Workspace
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-[#ece9f8] px-6 bg-white gap-4">
            <button
              onClick={() => setActiveTab("send")}
              className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "send"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Send Message
            </button>
            <button
              onClick={() => setActiveTab("campaign")}
              className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "campaign"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              Run Campaign
            </button>
            <button
              onClick={() => setActiveTab("schedule")}
              className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "schedule"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule Message
            </button>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {activeTab === "send" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Contact</label>
                  <select
                    value={selectedContact}
                    onChange={(e) => setSelectedContact(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-purple-400 bg-slate-50"
                  >
                    <option value="">Select contact...</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name} ({c.phone_number})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Approved Template</label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-purple-400 bg-slate-50"
                  >
                    <option value="">Select template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.template_name}>{t.template_name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSend}
                  disabled={sendLoading || !selectedContact || !selectedTemplate}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
                >
                  {sendLoading ? "Sending Message..." : "Send WhatsApp Message"}
                </button>

                {sendStatus && (
                  <p className={`text-xs text-center font-medium ${sendStatus.startsWith("Error") ? "text-rose-600" : "text-emerald-600"}`}>
                    {sendStatus}
                  </p>
                )}
              </div>
            )}

            {activeTab === "campaign" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Broadcast Campaign</label>
                  <select
                    value={selectedCampaign}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-purple-400 bg-slate-50"
                  >
                    <option value="">Select campaign...</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.campaign_name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleRunCampaign}
                  disabled={campaignLoading || !selectedCampaign}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
                >
                  {campaignLoading ? "Dispatching Campaign..." : "Run Broadcast Campaign"}
                </button>

                {campaignStatus && (
                  <p className={`text-xs text-center font-medium ${campaignStatus.startsWith("Error") ? "text-rose-600" : "text-emerald-600"}`}>
                    {campaignStatus}
                  </p>
                )}
              </div>
            )}

            {activeTab === "schedule" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Contact</label>
                  <select
                    value={scheduleContact}
                    onChange={(e) => setScheduleContact(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-purple-400 bg-slate-50"
                  >
                    <option value="">Select contact...</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name} ({c.phone_number})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Template</label>
                  <select
                    value={scheduleTemplate}
                    onChange={(e) => setScheduleTemplate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-purple-400 bg-slate-50"
                  >
                    <option value="">Select template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.template_name}>{t.template_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Schedule Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-purple-400 bg-slate-50"
                  />
                </div>

                <button
                  onClick={handleScheduleMessage}
                  disabled={scheduleLoading || !scheduleContact || !scheduleTemplate || !scheduledTime}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
                >
                  {scheduleLoading ? "Scheduling..." : "Schedule Message"}
                </button>

                {scheduleStatus && (
                  <p className={`text-xs text-center font-medium ${scheduleStatus.startsWith("Error") ? "text-rose-600" : "text-emerald-600"}`}>
                    {scheduleStatus}
                  </p>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default QuickActionsDrawer;
