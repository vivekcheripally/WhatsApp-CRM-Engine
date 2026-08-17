"use client";

import { useRef, useState } from "react";
import {
  Paperclip,
  Image as ImageIcon,
  Film,
  FileText,
  Music,
  Loader2,
  MapPin,
  User,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { api } from "@/lib/api";
import type { Message } from "@/lib/types";

interface MediaUploadButtonProps {
  conversationId: string;
  onSent?: (message: Message) => void;
  /** If provided, hands the file off for preview instead of uploading directly */
  onPreview?: (type: MediaCategory) => void;
  onOpenChange?: (open: boolean) => void;
}

type MediaCategory = "image" | "video" | "audio" | "document";

const ACCEPT_MAP: Record<MediaCategory, string> = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  video: "video/mp4,video/3gpp",
  audio: "audio/mpeg,audio/ogg,audio/opus,audio/aac",
  document:
    "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain",
};

const MEDIA_ITEMS: Array<{ type: MediaCategory; icon: React.ReactNode; label: string; color: string }> = [
  { type: "image",    icon: <ImageIcon className="h-[18px] w-[18px]" />, label: "Image",    color: "#7c3aed" },
  { type: "video",    icon: <Film      className="h-[18px] w-[18px]" />, label: "Video",    color: "#7c3aed" },
  { type: "audio",    icon: <Music     className="h-[18px] w-[18px]" />, label: "Audio",    color: "#7c3aed" },
  { type: "document", icon: <FileText  className="h-[18px] w-[18px]" />, label: "Document", color: "#7c3aed" },
];

/* ── Location Modal ─────────────────────────────────────────────────────── */
function LocationModal({
  conversationId,
  onSent,
  onClose,
}: {
  conversationId: string;
  onSent?: (m: Message) => void;
  onClose: () => void;
}) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState("");

  const detectLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6)); setDetecting(false); },
      () => { setError("Could not get location. Enter manually."); setDetecting(false); }
    );
  };

  const handleSend = async () => {
    if (!lat || !lng) { setError("Latitude and longitude are required"); return; }
    setSending(true);
    try {
      const { data } = await api.post("/api/messages/location", {
        conversation_id: conversationId,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        name: name.trim() || undefined,
        address: address.trim() || undefined,
      });
      onSent?.(data as Message);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to send location");
    } finally {
      setSending(false);
    }
  };

  const inp =
    "w-full rounded-xl px-3 py-2 text-sm focus:outline-none bg-[#f5f4fb] border border-[#e0ddf5] text-[#1a1040] placeholder:text-[#c0bed8] focus:border-[#7c3aed]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(26,16,64,0.4)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{ background: "#fff", border: "1px solid #ece9f8", boxShadow: "0 20px 60px rgba(100,80,200,0.18)" }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #f0eefb" }}>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" style={{ color: "#7c3aed" }} />
            <h3 className="font-semibold text-sm" style={{ color: "#1a1040" }}>Send Location</h3>
          </div>
          <button onClick={onClose} className="text-[#9390b5] hover:text-[#7c3aed] transition-colors text-lg leading-none">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <button
            onClick={detectLocation}
            disabled={detecting}
            className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
            style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}
          >
            <MapPin className="h-4 w-4" />
            {detecting ? "Detecting…" : "Use My Current Location"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#9390b5" }}>Latitude *</label>
              <input value={lat} onChange={e => setLat(e.target.value)} placeholder="12.9716" className={inp} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#9390b5" }}>Longitude *</label>
              <input value={lng} onChange={e => setLng(e.target.value)} placeholder="77.5946" className={inp} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#9390b5" }}>Place Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Office" className={inp} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#9390b5" }}>Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 MG Road" className={inp} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !lat || !lng}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            Send Location
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Contact Card Modal ─────────────────────────────────────────────────── */
function ContactCardModal({
  conversationId,
  onSent,
  onClose,
}: {
  conversationId: string;
  onSent?: (m: Message) => void;
  onClose: () => void;
}) {
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!contactName.trim() || !phone.trim()) { setError("Name and phone are required"); return; }
    setSending(true);
    try {
      const { data } = await api.post("/api/messages/contact", {
        conversation_id: conversationId,
        contact_name: contactName.trim(),
        phone_number: phone.trim(),
        email: email.trim() || undefined,
      });
      onSent?.(data as Message);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to send contact card");
    } finally {
      setSending(false);
    }
  };

  const inp =
    "w-full rounded-xl px-3 py-2 text-sm focus:outline-none bg-[#f5f4fb] border border-[#e0ddf5] text-[#1a1040] placeholder:text-[#c0bed8] focus:border-[#7c3aed]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(26,16,64,0.4)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{ background: "#fff", border: "1px solid #ece9f8", boxShadow: "0 20px 60px rgba(100,80,200,0.18)" }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #f0eefb" }}>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" style={{ color: "#7c3aed" }} />
            <h3 className="font-semibold text-sm" style={{ color: "#1a1040" }}>Send Contact Card</h3>
          </div>
          <button onClick={onClose} className="text-[#9390b5] hover:text-[#7c3aed] transition-colors text-lg leading-none">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#9390b5" }}>Full Name *</label>
            <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="John Doe" className={inp} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#9390b5" }}>Phone Number *</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="919876543210" className={inp} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#9390b5" }}>Email (optional)</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" className={inp} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !contactName.trim() || !phone.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
            Send Contact
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */
export function MediaUploadButton({
  conversationId,
  onSent,
  onPreview,
  onOpenChange,
}: MediaUploadButtonProps) {
  // Only used when onPreview is NOT provided (direct upload path)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingType, setPendingType] = useState<MediaCategory | null>(null);
  const [open, setOpen] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [hoveredType, setHoveredType] = useState<string | null>(null);

  const handleItemClick = (type: MediaCategory) => {
    setOpen(false);
    if (onPreview) {
      // Hand off to ChatWindow's FilePreview — no direct upload here
      onPreview(type);
    } else {
      // Direct upload path (no preview)
      setPendingType(type);
      setTimeout(() => fileInputRef.current?.click(), 80);
    }
  };

  // Only used in direct-upload path (no onPreview)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingType) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("conversation_id", conversationId);
      form.append("message_type", pendingType.toUpperCase());
      const { data } = await api.post("/api/messages/send/media-upload", form);
      onSent?.(data as Message);
    } catch (err: any) {
      console.error("Media upload failed:", err?.response?.data?.detail ?? err);
    } finally {
      setUploading(false);
      setPendingType(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      {/* Hidden file input — only active in direct-upload (no-preview) mode */}
      {!onPreview && (
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={pendingType ? ACCEPT_MAP[pendingType] : "*"}
          onChange={handleFileChange}
        />
      )}

      {showLocation && (
        <LocationModal conversationId={conversationId} onSent={onSent} onClose={() => setShowLocation(false)} />
      )}
      {showContact && (
        <ContactCardModal conversationId={conversationId} onSent={onSent} onClose={() => setShowContact(false)} />
      )}

      <Popover.Root
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          onOpenChange?.(v);
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={uploading}
            title="Attach file"
            className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-colors"
            style={{ color: "#54656f" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e9edef")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {uploading
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <Paperclip className="h-5 w-5" />
            }
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={10}
            className="z-50 animate-in fade-in-0 zoom-in-95"
            style={{
              width: "210px",
              background: "#ffffff",
              border: "1px solid #e9edef",
              borderRadius: "12px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.08)",
              padding: "6px",
              outline: "none",
            }}
          >
            {/* Media items */}
            {MEDIA_ITEMS.map(({ type, icon, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleItemClick(type)}
                onMouseEnter={() => setHoveredType(type)}
                onMouseLeave={() => setHoveredType(null)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all"
                style={{
                  color: hoveredType === type ? "#111b21" : "#3b4a54",
                  background: hoveredType === type ? "#f0f2f5" : "transparent",
                }}
              >
                <span
                  style={{
                    color: hoveredType === type ? "#008069" : "#54656f",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {icon}
                </span>
                {label}
              </button>
            ))}

            {/* Divider */}
            <div style={{ borderTop: "1px solid #e9edef", margin: "4px 4px" }} />

            {/* Location */}
            <button
              type="button"
              onClick={() => { setOpen(false); setShowLocation(true); }}
              onMouseEnter={() => setHoveredType("location")}
              onMouseLeave={() => setHoveredType(null)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all"
              style={{
                color: hoveredType === "location" ? "#111b21" : "#3b4a54",
                background: hoveredType === "location" ? "#f0f2f5" : "transparent",
              }}
            >
              <span style={{ color: hoveredType === "location" ? "#008069" : "#54656f", display: "flex" }}>
                <MapPin className="h-[18px] w-[18px]" />
              </span>
              Location
            </button>

            {/* Contact Card */}
            <button
              type="button"
              onClick={() => { setOpen(false); setShowContact(true); }}
              onMouseEnter={() => setHoveredType("contact")}
              onMouseLeave={() => setHoveredType(null)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all"
              style={{
                color: hoveredType === "contact" ? "#111b21" : "#3b4a54",
                background: hoveredType === "contact" ? "#f0f2f5" : "transparent",
              }}
            >
              <span style={{ color: hoveredType === "contact" ? "#008069" : "#54656f", display: "flex" }}>
                <User className="h-[18px] w-[18px]" />
              </span>
              Contact Card
            </button>

            <Popover.Arrow
              style={{ fill: "#ffffff", filter: "drop-shadow(0 -1px 0 #e9edef)" }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
