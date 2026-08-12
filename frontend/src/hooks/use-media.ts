import { useQuery } from "@tanstack/react-query";

export function useSignedMediaUrl(mediaFileId: string | null, fileUrl?: string) {
  return useQuery<{ signed_url: string; expires_in: number }>({
    queryKey: ["media-signed-url", mediaFileId, fileUrl],
    queryFn: async () => {
      if (fileUrl && (fileUrl.startsWith("/api/messages/media/") || fileUrl.startsWith("/uploads/"))) {
        return { signed_url: fileUrl, expires_in: 86400 };
      }
      if (mediaFileId) {
        return { signed_url: `/api/messages/media/${mediaFileId}/stream`, expires_in: 86400 };
      }
      return { signed_url: fileUrl || "", expires_in: 86400 };
    },
    enabled: !!mediaFileId && !mediaFileId.startsWith("tmpl_"),
    staleTime: 50 * 60 * 1000, // Re-fetch before 1h expiry
    gcTime: 55 * 60 * 1000,
  });
}
