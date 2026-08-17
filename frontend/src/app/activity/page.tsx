"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ActivityRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/reports?tab=activity");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#f5f4fb]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
        <p className="text-xs font-semibold text-[#9390b5]">Redirecting to Reports &gt; Activity...</p>
      </div>
    </div>
  );
}