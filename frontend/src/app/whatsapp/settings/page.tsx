"use client";

import { useState, useEffect } from "react";
import {
  Wifi, WifiOff, Phone, CheckCircle2, AlertCircle,
  Loader2, Shield, Hash, RefreshCw, Copy, Star, Trash2, Plus
} from "lucide-react";
import { useWhatsAppAccount, useConnectWhatsApp, useDisconnectWhatsApp } from "@/hooks/use-whatsapp";
import { getWabaChannels, setDefaultChannel, deleteWabaChannel, WabaChannel } from "@/services/whatsappService";

type FormState = { channel_name: string; waba_id: string; phone_number_id: string; access_token: string };

const inputStyle = {
  background: "#f5f4fb",
  border: "1px solid #e0ddf5",
  color: "#1a1040",
  borderRadius: "10px",
  padding: "10px 14px 10px 40px",
  width: "100%",
  fontSize: "14px",
  outline: "none",
} as const;

const labelStyle = {
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  color: "#9390b5",
  marginBottom: "6px",
  display: "block",
};

export default function WhatsAppSettingsPage() {
  const { data: status, isLoading, refetch } = useWhatsAppAccount();
  const { mutateAsync: connect, isPending: isConnecting } = useConnectWhatsApp();
  const { mutateAsync: disconnect, isPending: isDisconnecting } = useDisconnectWhatsApp();

  const [channels, setChannels] = useState<WabaChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState<boolean>(true);
  const [form, setForm] = useState<FormState>({ channel_name: "", waba_id: "", phone_number_id: "", access_token: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const account = status?.account;
  const connected = status?.connected;

  const fetchChannelsList = async () => {
    setChannelsLoading(true);
    const res = await getWabaChannels();
    if (res?.success && Array.isArray(res.channels)) {
      setChannels(res.channels);
    }
    setChannelsLoading(false);
  };

  useEffect(() => {
    fetchChannelsList();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await connect(form);
      setSuccess("WABA Channel connected successfully.");
      setForm({ channel_name: "", waba_id: "", phone_number_id: "", access_token: "" });
      refetch();
      await fetchChannelsList();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Connection failed. Check your credentials.");
    }
  };

  const handleSetPrimary = async (accountId: string) => {
    setError(null);
    setSuccess(null);
    const res = await setDefaultChannel(accountId);
    if (res?.success) {
      setSuccess("Primary default WABA channel updated.");
      refetch();
      await fetchChannelsList();
    } else {
      setError(res?.error || "Failed to update default channel.");
    }
  };

  const handleDeleteChannel = async (accountId: string) => {
    if (!confirm("Are you sure you want to disconnect this WABA channel?")) return;
    setError(null);
    setSuccess(null);
    const res = await deleteWabaChannel(accountId);
    if (res?.success) {
      setSuccess("WABA Channel disconnected.");
      refetch();
      await fetchChannelsList();
    } else {
      setError(res?.error || "Failed to disconnect channel.");
    }
  };

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/webhook`;

  if (isLoading || channelsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#7c3aed" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected WABA Channels List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-lg" style={{ color: "#1a1040" }}>Connected WABA Channels</p>
            <p className="text-sm" style={{ color: "#9390b5" }}>Manage your connected WhatsApp Business API phone numbers</p>
          </div>
          <button
            type="button"
            onClick={() => { refetch(); fetchChannelsList(); }}
            className="p-2 rounded-lg transition-colors border border-purple-100 bg-purple-50 hover:bg-purple-100 text-purple-700"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {channels.length === 0 ? (
          <div className="rounded-2xl p-6 text-center border border-dashed border-purple-200 bg-purple-50/50">
            <WifiOff className="h-8 w-8 mx-auto text-purple-400 mb-2" />
            <p className="font-semibold text-purple-900">No WABA Channels Connected</p>
            <p className="text-xs text-purple-600 mt-1">Connect your first Meta WhatsApp Business account below.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((ch) => (
              <div
                key={ch.id}
                className={`rounded-2xl p-5 border transition-all ${
                  ch.is_default ? "bg-purple-50/60 border-purple-300 shadow-sm" : "bg-white border-purple-100 hover:border-purple-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-purple-950">{ch.channel_name || "WABA Channel"}</span>
                        {ch.is_default && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Primary
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{ch.display_phone_number || ch.phone_number_id}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    ch.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {ch.status}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-gray-600 mb-4 bg-white/80 rounded-xl p-3 border border-purple-50">
                  <div><span className="font-medium text-gray-400">WABA ID:</span> <span className="font-mono">{ch.waba_id}</span></div>
                  <div><span className="font-medium text-gray-400">Phone ID:</span> <span className="font-mono">{ch.phone_number_id}</span></div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-purple-100/60">
                  {!ch.is_default ? (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(ch.id)}
                      className="text-xs text-purple-700 hover:text-purple-900 font-semibold flex items-center gap-1"
                    >
                      <Star className="h-3.5 w-3.5" /> Make Primary
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Active Default
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteChannel(ch.id)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}
      {success && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", color: "#059669" }}
        >
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />{success}
        </div>
      )}

      {/* Connect New Channel Form */}
      <div className="rounded-2xl p-6 bg-white border border-purple-100 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Plus className="h-5 w-5 text-purple-600" />
          <p className="font-bold text-base text-purple-950">Connect Additional WABA Channel</p>
        </div>
        <p className="text-sm mb-4 text-gray-500">
          Enter credentials from the{" "}
          <a
            href="https://developers.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-purple-600 font-medium"
          >
            Meta Developer Portal
          </a> to add another phone number or WABA account.
        </p>

        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <span style={labelStyle}>Channel Name / Label</span>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400 pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. Sales Desk - US, Support Line"
                value={form.channel_name}
                onChange={(e) => setForm((f) => ({ ...f, channel_name: e.target.value }))}
                style={inputStyle}
                className="placeholder:text-[#c0bed8] focus:outline-none"
              />
            </div>
          </div>

          {[
            { key: "waba_id", label: "WABA ID", placeholder: "123456789012345", icon: Hash, type: "text" },
            { key: "phone_number_id", label: "Phone Number ID", placeholder: "987654321098765", icon: Phone, type: "text" },
          ].map(({ key, label, placeholder, icon: Icon, type }) => (
            <div key={key}>
              <span style={labelStyle}>{label}</span>
              <div className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400 pointer-events-none" />
                <input
                  type={type}
                  placeholder={placeholder}
                  value={(form as any)[key]}
                  required
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={inputStyle}
                  className="placeholder:text-[#c0bed8] focus:outline-none"
                />
              </div>
            </div>
          ))}

          {/* Access Token */}
          <div>
            <span style={labelStyle}>Meta System User Access Token</span>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400 pointer-events-none" />
              <input
                type={showToken ? "text" : "password"}
                placeholder="EAAxxxxx…"
                value={form.access_token}
                required
                onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
                style={{ ...inputStyle, paddingRight: "80px" }}
                className="placeholder:text-[#c0bed8] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-purple-600"
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isConnecting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 bg-gradient-to-r from-purple-600 to-indigo-600 shadow-md hover:shadow-lg"
            >
              {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
              Connect WABA Channel
            </button>
          </div>
        </form>
      </div>

      {/* Webhook Configuration */}
      <div className="rounded-2xl p-6 bg-purple-50/50 border border-purple-100">
        <p className="font-semibold text-purple-950 mb-1">Webhook Configuration</p>
        <p className="text-sm mb-4 text-purple-700">Set these values in your Meta App Dashboard under Webhooks.</p>
        <div className="space-y-2">
          {[
            { label: "Callback URL", value: webhookUrl },
            { label: "Verify Token", value: "Set in .env → WHATSAPP_HOOK_VERIFY_TOKEN" },
            { label: "Subscribe Fields", value: "messages, message_status_updates" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1.5">
              <span className="text-xs w-36 text-purple-700 font-medium">{label}:</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <code className="text-xs px-3 py-1.5 rounded-lg flex-1 truncate font-mono bg-white text-purple-800 border border-purple-200">
                  {value}
                </code>
                {label === "Callback URL" && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(value)}
                    className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-100"
                    title="Copy"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
