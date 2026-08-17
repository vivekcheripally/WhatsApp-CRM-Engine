"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getWabaChannels, setDefaultChannel, WabaChannel } from "@/services/whatsappService";

interface WabaContextType {
  channels: WabaChannel[];
  activeChannel: WabaChannel | null;
  isLoading: boolean;
  selectChannel: (channelId: string) => void;
  setPrimaryChannel: (channelId: string) => Promise<void>;
  refreshChannels: () => Promise<void>;
}

const WabaContext = createContext<WabaContextType | undefined>(undefined);

export function WabaProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [channels, setChannels] = useState<WabaChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<WabaChannel | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshChannels = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getWabaChannels();
      if (res?.success && Array.isArray(res.channels)) {
        setChannels(res.channels);
        const savedId = localStorage.getItem("active_waba_account_id");
        let matched = res.channels.find((c: WabaChannel) => c.id === savedId);
        if (!matched) {
          matched = res.channels.find((c: WabaChannel) => c.is_default) || res.channels[0] || null;
        }
        setActiveChannel(matched);
        if (matched) {
          localStorage.setItem("active_waba_account_id", matched.id);
        } else {
          localStorage.removeItem("active_waba_account_id");
        }
      } else {
        setChannels([]);
        setActiveChannel(null);
      }
    } catch {
      setChannels([]);
      setActiveChannel(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshChannels();
    const handleRefetch = () => {
      refreshChannels();
    };
    window.addEventListener("focus", handleRefetch);
    window.addEventListener("waba-channels-refetch", handleRefetch);
    return () => {
      window.removeEventListener("focus", handleRefetch);
      window.removeEventListener("waba-channels-refetch", handleRefetch);
    };
  }, [refreshChannels]);

  const selectChannel = (channelId: string) => {
    const matched = channels.find((c) => c.id === channelId);
    if (matched) {
      setActiveChannel(matched);
      localStorage.setItem("active_waba_account_id", matched.id);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      window.dispatchEvent(new Event("waba-channel-changed"));
    }
  };

  const setPrimaryChannel = async (channelId: string) => {
    const res = await setDefaultChannel(channelId);
    if (res?.success) {
      await refreshChannels();
    }
  };

  return (
    <WabaContext.Provider
      value={{
        channels,
        activeChannel,
        isLoading,
        selectChannel,
        setPrimaryChannel,
        refreshChannels,
      }}
    >
      {children}
    </WabaContext.Provider>
  );
}

export function useWabaContext() {
  const context = useContext(WabaContext);
  if (!context) {
    throw new Error("useWabaContext must be used within a WabaProvider");
  }
  return context;
}
