"use client";

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-3 relative z-10">
      <span
        className="text-[11px] font-medium px-3 py-1 rounded-lg bg-white"
        style={{
          color: "#54656f",
          boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
