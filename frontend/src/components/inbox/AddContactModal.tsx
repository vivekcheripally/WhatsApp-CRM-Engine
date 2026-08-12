"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { UserPlus, X, Phone, Mail, User } from "lucide-react";
import { createContact } from "@/services/contactService";
import { useQueryClient } from "@tanstack/react-query";

interface AddContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddContactModal({ open, onOpenChange, onSuccess }: AddContactModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qc = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setLoading(true);
    setError(null);
    try {
      await createContact({
        name,
        phone,
        email: email || undefined,
        status: "ACTIVE",
        source: "MANUAL",
      });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setName("");
      setPhone("");
      setEmail("");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to create contact");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl border border-[#e8eaf0]">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-purple-600" />
              Add New Contact
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50 border-[#ece9f8]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Phone Number (WhatsApp) *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1234567890"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50 border-[#ece9f8]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Email Address (Optional)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50 border-[#ece9f8]"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-600 text-center font-medium">{error}</p>
            )}

            <div className="pt-3 flex justify-end gap-3 border-t border-[#ece9f8]">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name || !phone}
                className="px-5 py-2 text-xs font-semibold text-white rounded-xl shadow disabled:opacity-50"
                style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
              >
                {loading ? "Creating..." : "Save Contact"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddContactModal;
