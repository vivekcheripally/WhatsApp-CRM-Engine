import BASE_URL from "./api";

const API_URL = `${BASE_URL}/api`;

function _authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("jwt");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export async function listConversations() {
  const res = await fetch(`${API_URL}/conversations`, { headers: { ..._authHeaders() } });
  return res.json();
}

export async function getConversation(id: string | number) {
  const res = await fetch(`${API_URL}/conversations/${id}`, { headers: { ..._authHeaders() } });
  return res.json();
}

export async function listMessages(conversationId: string | number) {
  const res = await fetch(`${API_URL}/conversations/${conversationId}/messages`, { headers: { ..._authHeaders() } });
  return res.json();
}

export async function sendMessage(payload: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/messages/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ..._authHeaders() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function createConversation(payload: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ..._authHeaders() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

const inboxService = {
  listConversations,
  getConversation,
  listMessages,
  sendMessage,
  createConversation,
};

export default inboxService;
