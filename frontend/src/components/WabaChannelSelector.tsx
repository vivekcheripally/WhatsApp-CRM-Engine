import React, { useEffect } from "react";
import { useWabaContext } from "@/context/WabaContext";
import { Phone, Star, ChevronDown, Check } from "lucide-react";

export default function WabaChannelSelector() {
  const { channels, activeChannel, selectChannel, refreshChannels } = useWabaContext();

  useEffect(() => {
    refreshChannels();
  }, [refreshChannels]);

  if (!channels || channels.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
        <Phone className="h-3.5 w-3.5" />
        <span>No WABA Connected</span>
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left">
      <div className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold cursor-pointer hover:bg-purple-100 transition-colors">
        <Phone className="h-3.5 w-3.5 text-purple-600" />
        <span className="max-w-[140px] truncate">
          {activeChannel ? activeChannel.channel_name || activeChannel.display_phone_number : "Select Channel"}
        </span>
        {activeChannel?.is_default && (
          <span title="Primary Default Channel">
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-purple-500" />

        {/* Dropdown Menu */}
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-white shadow-xl border border-purple-100 py-1 hidden group-hover:block z-50">
          <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            Switch WABA Channel
          </div>
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => selectChannel(ch.id)}
              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-purple-50 transition-colors ${
                activeChannel?.id === ch.id ? "bg-purple-50/80 font-bold text-purple-700" : "text-gray-700"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                <div className="truncate">
                  <div>{ch.channel_name || "WABA Channel"}</div>
                  <div className="text-[10px] text-gray-400 font-normal">{ch.display_phone_number || ch.phone_number_id}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {ch.is_default && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                {activeChannel?.id === ch.id && <Check className="h-3.5 w-3.5 text-purple-600" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
