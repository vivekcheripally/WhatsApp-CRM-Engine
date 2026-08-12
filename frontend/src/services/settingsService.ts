import api from "../lib/api";

export async function getAutoReplies() {
  const res = await api.get("/api/settings/auto-replies");
  return res.data;
}

export async function createAutoReply(payload: Record<string, unknown>) {
  const res = await api.post("/api/settings/auto-replies", payload);
  return res.data;
}

export async function updateAutoReply(id: string | number, payload: Record<string, unknown>) {
  const res = await api.patch(`/api/settings/auto-replies/${id}`, payload);
  return res.data;
}

export async function deleteAutoReply(id: string | number) {
  const res = await api.delete(`/api/settings/auto-replies/${id}`);
  return res.data;
}

export async function getChatbotRules() {
  const res = await api.get("/api/settings/chatbot-rules");
  return res.data;
}

export async function createChatbotRule(payload: Record<string, unknown>) {
  const res = await api.post("/api/settings/chatbot-rules", payload);
  return res.data;
}

export async function updateChatbotRule(id: string | number, payload: Record<string, unknown>) {
  const res = await api.patch(`/api/settings/chatbot-rules/${id}`, payload);
  return res.data;
}

export async function deleteChatbotRule(id: string | number) {
  const res = await api.delete(`/api/settings/chatbot-rules/${id}`);
  return res.data;
}

const settingsService = {
  getAutoReplies,
  createAutoReply,
  updateAutoReply,
  deleteAutoReply,
  getChatbotRules,
  createChatbotRule,
  updateChatbotRule,
  deleteChatbotRule,
};

export default settingsService;
