"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { UploadCloud, X, FileText, CheckCircle2 } from "lucide-react";
import { importContacts } from "@/services/contactService";
import { useQueryClient } from "@tanstack/react-query";

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BulkUploadModal({ open, onOpenChange, onSuccess }: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qc = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await importContacts(file);
      const importedCount = res?.imported_count ?? res?.count ?? res?.imported ?? 0;
      setResult(`Successfully imported ${importedCount} contacts!`);
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setTimeout(() => {
        setFile(null);
        setResult(null);
        onOpenChange(false);
        if (onSuccess) onSuccess();
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to import contacts");
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
              <UploadCloud className="w-5 h-5 text-purple-600" />
              Bulk Upload Contacts (CSV)
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border-2 border-dashed border-purple-200 rounded-2xl p-6 text-center bg-purple-50/50 hover:bg-purple-50 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="csv-file-input"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer block">
                <UploadCloud className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">
                  {file ? file.name : "Click to select or drag CSV file"}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  File should contain name and phone columns.
                </p>
              </label>
            </div>

            {result && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {result}
              </div>
            )}

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
                disabled={loading || !file}
                className="px-5 py-2 text-xs font-semibold text-white rounded-xl shadow disabled:opacity-50"
                style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }}
              >
                {loading ? "Importing..." : "Upload CSV"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default BulkUploadModal;
