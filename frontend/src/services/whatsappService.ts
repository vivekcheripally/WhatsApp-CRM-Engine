import api from "../lib/api";

type JsonRecord = Record<string, unknown>;

export interface WabaChannel {
  id: string;
  organization_id: string;
  channel_name: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number?: string;
  verified_name?: string;
  status: string;
  is_default: boolean;
  created_at?: string;
}

export const getWabaChannels = async () => {
  try {
    const response = await api.get("/api/whatsapp/channels");
    return response.data;
  } catch (err: any) {
    return { success: false, channels: [], error: err?.response?.data?.detail || String(err) };
  }
};

export const setDefaultChannel = async (accountId: string) => {
  try {
    const response = await api.post(`/api/whatsapp/channels/${accountId}/set-default`);
    return response.data;
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.detail || String(err) };
  }
};

export const deleteWabaChannel = async (accountId: string) => {
  try {
    const response = await api.delete(`/api/whatsapp/channels/${accountId}`);
    return response.data;
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.detail || String(err) };
  }
};

export const connectWabaChannel = async (payload: JsonRecord) => {
  try {
    const response = await api.post("/api/whatsapp/connect", payload);
    return response.data;
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.detail || String(err) };
  }
};

export const sendMessage = async (to: string, template_name: string, waba_account_id?: string) => {
  const url = waba_account_id ? `/api/whatsapp/send?waba_account_id=${waba_account_id}` : "/api/whatsapp/send";
  const response = await api.post(url, { to, template_name });
  return response.data;
};

export const getWhatsAppInfo = async (waba_account_id?: string) => {
  const url = waba_account_id ? `/api/whatsapp/account?waba_account_id=${waba_account_id}` : "/api/whatsapp/account";
  const response = await api.get(url);
  return response.data;
};

export const getWhatsAppSettings = async (waba_account_id?: string) => {
  try {
    const url = waba_account_id ? `/api/whatsapp/settings?waba_account_id=${waba_account_id}` : "/api/whatsapp/settings";
    const response = await api.get(url);
    return response.data;
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.detail || String(err) };
  }
};

export const updateWhatsAppSettings = async (payload: JsonRecord, waba_account_id?: string) => {
  try {
    const url = waba_account_id ? `/api/whatsapp/settings?waba_account_id=${waba_account_id}` : "/api/whatsapp/settings";
    const response = await api.put(url, payload);
    return response.data;
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.detail || String(err) };
  }
};

export const disconnectAccount = async (waba_account_id?: string) => {
  const url = waba_account_id ? `/api/whatsapp/disconnect?waba_account_id=${waba_account_id}` : "/api/whatsapp/disconnect";
  const response = await api.delete(url);
  return response.data;
};
