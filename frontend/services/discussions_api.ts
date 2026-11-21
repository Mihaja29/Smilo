import { getAuthHeaders } from './auth_headers';

export type DiscussionRole = 'user' | 'assistant';

export type AiEntityType = 'patient' | 'prothese' | 'prise_en_charge';

export interface AiCreatedEntity {
  type: AiEntityType;
  id: string;
  label: string;
}

export interface AiFormRequest {
  entityType: AiEntityType;
  prefill?: Record<string, unknown>;
}

export interface DiscussionMessage {
  id: string;
  conversationId?: string;
  role: DiscussionRole;
  authorName: string;
  authorUid: string;
  content: string;
  imageDataUrl?: string;
  createdAt: string;
  updatedAt?: string;
  formRequest?: AiFormRequest;
  formSubmittedLabel?: string;
  formDismissed?: boolean;
}

const DISCUSSIONS_STORAGE_KEY = 'smilo_ai_discussions_cache';

export function getCachedDiscussions(): DiscussionMessage[] {
  try {
    const raw = localStorage.getItem(DISCUSSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCachedDiscussions(items: DiscussionMessage[]): void {
  try {
    localStorage.setItem(DISCUSSIONS_STORAGE_KEY, JSON.stringify(items.slice(-200)));
  } catch {
    // Sauvegarde cache locale
  }
}

// APPELS API REST POUR LA DISCUSSION AVEC L'ASSISTANT IA
export async function getDiscussionsApi(): Promise<DiscussionMessage[]> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/discussions', { headers });
  if (!response.ok) {
    throw new Error('Erreur lors du chargement des échanges.');
  }
  const result = await response.json();
  const serverList: DiscussionMessage[] = Array.isArray(result.data) ? result.data : [];
  const cachedById = new Map(getCachedDiscussions().map((m) => [m.id, m]));
  const merged = serverList.map((item) => {
    const cached = cachedById.get(item.id);
    if (!cached) return item;
    return {
      ...item,
      ...(cached.formRequest ? { formRequest: cached.formRequest } : {}),
      ...(cached.formSubmittedLabel ? { formSubmittedLabel: cached.formSubmittedLabel } : {}),
      ...(cached.formDismissed ? { formDismissed: cached.formDismissed } : {}),
    };
  });
  setCachedDiscussions(merged);
  return merged;
}

async function performAskAttempt(
  headers: Record<string, string>,
  body: string
): Promise<{
  response: Response;
  rawText: string;
  contentType: string;
  isHtmlFallback: boolean;
}> {
  const response = await fetch('/api/discussions/ask', {
    method: 'POST',
    headers,
    body,
  });
  const rawText = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const trimmed = rawText.trim();
  const isHtmlFallback =
    trimmed.startsWith('<') || contentType.includes('text/html') || response.redirected;
  return { response, rawText, contentType, isHtmlFallback };
}

export async function askAiDiscussionApi(input: {
  conversationId?: string;
  authorName: string;
  authorUid?: string;
  prompt: string;
  imageDataUrl?: string;
}): Promise<{
  userMessage: DiscussionMessage;
  assistantMessage: DiscussionMessage;
  createdEntities?: AiCreatedEntity[];
  formRequest?: AiFormRequest;
}> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const body = JSON.stringify(input);

  let attempt = await performAskAttempt(headers, body);
  if (attempt.isHtmlFallback) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    attempt = await performAskAttempt(headers, body);
  }

  const { response, rawText, isHtmlFallback } = attempt;
  let result: Record<string, unknown> = {};
  try {
    result = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    if (isHtmlFallback) {
      throw new Error(
        `Session ou proxy expiré (HTTP ${response.status}). Rechargez la page puis réessayez.`
      );
    }
    throw new Error(`Réponse invalide reçue depuis le serveur (HTTP ${response.status}).`);
  }
  if (!response.ok || result.success === false) {
    const errMsg =
      typeof result.error === 'string' && result.error.trim()
        ? result.error
        : `Impossible d'obtenir une réponse de Diana (HTTP ${response.status}).`;
    throw new Error(errMsg);
  }
  const data = result.data as
    | {
        userMessage?: DiscussionMessage;
        assistantMessage?: DiscussionMessage;
        createdEntities?: AiCreatedEntity[];
        formRequest?: AiFormRequest;
      }
    | undefined;
  if (!data?.userMessage || !data?.assistantMessage) {
    throw new Error("Réponse incomplète reçue de Diana.");
  }
  return {
    userMessage: data.userMessage,
    assistantMessage: data.assistantMessage,
    createdEntities: Array.isArray(data.createdEntities) ? data.createdEntities : [],
    ...(data.formRequest ? { formRequest: data.formRequest } : {}),
  };
}

export async function clearDiscussionsApi(conversationId?: string): Promise<void> {
  const headers = await getAuthHeaders();
  const url = conversationId
    ? `/api/discussions?conversationId=${encodeURIComponent(conversationId)}`
    : '/api/discussions';
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Erreur lors de la suppression.');
  }
  if (!conversationId) {
    setCachedDiscussions([]);
  } else {
    const remaining = getCachedDiscussions().filter(
      (item) => (item.conversationId || 'default') !== conversationId
    );
    setCachedDiscussions(remaining);
  }
}
