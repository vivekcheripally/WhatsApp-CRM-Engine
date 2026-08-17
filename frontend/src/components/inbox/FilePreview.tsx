"use client";

import { useEffect, useState } from "react";
import { X, Send, FileText, Music, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Message } from "@/lib/types";

interface FilePreviewProps {
  file: File;
  mediaType: "image" | "video" | "audio" | "document";
  conversationId: string;
  onSent: (message: Message) => void;
  onCancel: () => void;
}

export function FilePreview({ file, mediaType, conversationId, onSent, onCancel }: FilePreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mediaType === "image" || mediaType === "video") {
      const url = URL.createObjectURL(file);
      const t = setTimeout(() => setObjectUrl(url), 0);
      return () => {
        clearTimeout(t);
        URL.revokeObjectURL(url);
      };
    }
  }, [file, mediaType]);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("conversation_id", conversationId);
      form.append("message_type", mediaType.toUpperCase());
      if (caption) form.append("caption", caption);
      const { data } = await api.post("/api/messages/send/media-upload", form);
      onSent(data as Message);
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Failed to send. Check your WhatsApp connection.";
      setError(detail);
      console.error("File send failed", e);
    } finally {
      setSending(false);
    }
  };

  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  const ext = file.name.split(".").pop()?.toUpperCase() ?? "";

  return (
    /* ── Backdrop ── */
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(11,20,26,0.97)" }}
    >
      {/* ── Header bar — WhatsApp Web style ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: "#202c33" }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-full transition-colors"
          style={{ color: "#aebac1" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#374248")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "#e9edef" }}>
            {file.name}
          </p>
          <p className="text-xs" style={{ color: "#8696a0" }}>
            {sizeMB} MB
          </p>
        </div>
      </div>

      {/* ── Main preview area ── */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden"
        style={{ background: "#111b21" }}
      >
        {/* Image: use checkerboard so transparent PNGs are visible */}
        {mediaType === "image" && objectUrl && (
          <div
            className="flex items-center justify-center w-full h-full p-4"
            style={{
              backgroundImage:
                "linear-gradient(45deg,#1a2630 25%,transparent 25%)," +
                "linear-gradient(-45deg,#1a2630 25%,transparent 25%)," +
                "linear-gradient(45deg,transparent 75%,#1a2630 75%)," +
                "linear-gradient(-45deg,transparent 75%,#1a2630 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={objectUrl}
              alt="preview"
              style={{
                maxHeight: "100%",
                maxWidth: "100%",
                objectFit: "contain",
                borderRadius: "4px",
                boxShadow: "0 4px 32px rgba(0,0,0,0.6)",
                userSelect: "none",
              }}
            />
          </div>
        )}

        {/* Video */}
        {mediaType === "video" && objectUrl && (
          <video
            src={objectUrl}
            controls
            autoPlay
            style={{
              maxHeight: "100%",
              maxWidth: "100%",
              borderRadius: "4px",
              boxShadow: "0 4px 32px rgba(0,0,0,0.6)",
            }}
          />
        )}

        {/* Audio */}
        {mediaType === "audio" && (
          <div
            className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl"
            style={{ background: "#202c33", border: "1px solid #2a3942", minWidth: "260px" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "#00a884" }}
            >
              <Music className="h-8 w-8 text-white" />
            </div>
            <p className="text-sm font-medium text-center truncate max-w-xs" style={{ color: "#e9edef" }}>
              {file.name}
            </p>
            <p className="text-xs" style={{ color: "#8696a0" }}>
              {sizeMB} MB · {ext}
            </p>
          </div>
        )}

        {/* Document */}
        {mediaType === "document" && (
          <div
            className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl"
            style={{ background: "#202c33", border: "1px solid #2a3942", minWidth: "260px" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(0,168,132,0.15)" }}
            >
              <FileText className="h-8 w-8" style={{ color: "#00a884" }} />
            </div>
            <p className="text-sm font-medium text-center truncate max-w-xs" style={{ color: "#e9edef" }}>
              {file.name}
            </p>
            <p className="text-xs" style={{ color: "#8696a0" }}>
              {sizeMB} MB · {ext}
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom bar — WhatsApp Web style ── */}
      <div
        className="shrink-0 flex flex-col gap-2 px-4 py-3"
        style={{ background: "#202c33" }}
      >
        {/* Error banner */}
        {error && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <span className="text-xs flex-1" style={{ color: "#f87171" }}>⚠️ {error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-sm leading-none"
              style={{ color: "#f87171" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Caption + send row */}
        <div className="flex items-center gap-3">
          {/* Caption input — only for image / video / document */}
          {(mediaType === "image" || mediaType === "video" || mediaType === "document") && (
            <div
              className="flex-1 flex items-center rounded-lg px-4 py-2"
              style={{ background: "#2a3942" }}
            >
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !sending) handleSend();
                }}
                placeholder="Add a caption…"
                className="flex-1 bg-transparent text-sm focus:outline-none"
                style={{ color: "#e9edef" }}
              />
            </div>
          )}

          {/* Spacer when no caption input (audio) */}
          {mediaType === "audio" && <div className="flex-1" />}

          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: "#aebac1" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#374248")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            Cancel
          </button>

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="flex items-center justify-center w-11 h-11 rounded-full transition-all disabled:opacity-50 shrink-0"
            style={{
              background: sending ? "#008069" : "#00a884",
              boxShadow: "0 2px 8px rgba(0,168,132,0.4)",
            }}
            title="Send"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <Send className="h-5 w-5 text-white" style={{ marginLeft: "2px" }} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
