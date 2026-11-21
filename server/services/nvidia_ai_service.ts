import { AiCreatedEntity, AiFormRequest, DiscussionMessage } from '../types';
import {
  AI_CREATION_TOOLS,
  buildAiWorkspaceContext,
  executeAiToolCall,
  extractFallbackActions,
} from './ai_actions_service';

const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_AI_MODEL = 'mistralai/mistral-large-4-1t-a52b';
const REQUEST_TIMEOUT_MS = 45000;
const MAX_TOOL_STEPS = 4;

const SYSTEM_INSTRUCTION = [
  "Tu es Diana, l'assistante IA intégrée à Smilo, une application de gestion de cabinet dentaire (fiches individuelles de patients, suivi des prothèses dentaires, prises en charge d'assurance et gestion de cabinets).",
  "Réponds toujours en français, de manière claire, structurée, professionnelle et concise. N'utilise jamais d'émojis dans tes réponses.",
  "Tu peux créer directement dans la base de données Smilo :",
  "1) des fiches individuelles de patients (create_patient_record),",
  "2) des dossiers de prothèses dentaires (create_prosthesis_record),",
  "3) des dossiers de prises en charge d'assurance (create_coverage_record),",
  "4) un formulaire interactif de saisie directement dans la discussion (request_record_form).",
  "Règles strictes pour la création :",
  "- Si l'utilisateur fournit toutes les informations requises (par texte ou via une image jointe), exécute immédiatement l'action create_* correspondante.",
  "- Si l'utilisateur demande de créer une fiche individuelle, une prothèse dentaire ou une prise en charge et qu'il manque des champs obligatoires (ou s'il demande un formulaire / une boîte de saisie), N'ÉNUMÈRE JAMAIS les champs requis en texte ou en liste à puces. Appelle OBLIGATOIREMENT request_record_form avec entityType ('patient', 'prothese' ou 'prise_en_charge') et un objet prefill contenant les informations déjà connues (texte ou image).",
  "- Quand request_record_form est déclenché, écris uniquement une seule phrase courte invitant à compléter le formulaire ci-dessous, sans répéter la liste des champs.",
  "- N'invente jamais de données personnelles, médicales ou financières manquantes.",
  "- Si une question concerne un diagnostic médical final, rappelle brièvement que la validation clinique appartient au chirurgien-dentiste.",
].join('\n');

const FALLBACK_ACTION_GUIDE = [
  "Pour déclencher une action Smilo, ajoute à la toute fin de ta réponse exactement un bloc :",
  '<SMILO_ACTION>{"name":"NOM_ACTION","arguments":{...}}</SMILO_ACTION>',
  "Actions disponibles :",
  '1) Formulaire interactif (dès qu\'il manque au moins un champ obligatoire pour créer une fiche individuelle, prothèse ou prise en charge) :',
  '<SMILO_ACTION>{"name":"request_record_form","arguments":{"entityType":"patient","prefill":{"nom":"Rakoto","prenom":"Jean"}}}</SMILO_ACTION>',
  '   Valeurs de entityType : "patient", "prothese", "prise_en_charge". Mets dans "prefill" uniquement les champs déjà fournis par l\'utilisateur.',
  '2) Création directe patient (UNIQUEMENT si nom, prenom, sexe, dateNaissance, adresse, telephone et cabinet sont tous connus) :',
  '<SMILO_ACTION>{"name":"create_patient_record","arguments":{"nom":"...","prenom":"...","sexe":"Masculin|Féminin","dateNaissance":"YYYY-MM-DD","adresse":"...","telephone":"...","cabinet":"..."}}</SMILO_ACTION>',
  '3) Création directe prothèse (UNIQUEMENT si cabinetDentaire, patientNomPrenom, numeroDentaire, typeProthese, nomLaboratoire et montant sont tous connus) :',
  '<SMILO_ACTION>{"name":"create_prosthesis_record","arguments":{"cabinetDentaire":"...","patientNomPrenom":"...","numeroDentaire":"...","typeProthese":"...","nomLaboratoire":"...","montant":"..."}}</SMILO_ACTION>',
  '4) Création directe prise en charge (UNIQUEMENT si cabinetDentaire, numeroFacture, montantProposeAriary, montantAssuranceAriary, patientNomPrenom, nomSociete, agence et numeroPriseEnCharge sont tous connus) :',
  '<SMILO_ACTION>{"name":"create_coverage_record","arguments":{"cabinetDentaire":"...","numeroFacture":"...","montantProposeAriary":"...","montantAssuranceAriary":"...","patientNomPrenom":"...","nomSociete":"...","agence":"...","numeroPriseEnCharge":"..."}}</SMILO_ACTION>',
].join('\n');

interface NvidiaChatContentPart {
  type?: string;
  text?: string;
}

interface NvidiaToolCall {
  id: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface NvidiaChatChoice {
  message?: {
    role?: string;
    content?: string | NvidiaChatContentPart[] | null;
    tool_calls?: NvidiaToolCall[];
  };
}

interface NvidiaChatResponse {
  choices?: NvidiaChatChoice[];
  detail?: string;
  message?: string;
  error?: {
    message?: string;
  };
}

function resolveNvidiaApiKey(): string {
  const key = (process.env.NVIDIA_API_KEY || '').trim();
  if (!key || key === 'MY_NVIDIA_API_KEY' || key === '$NVIDIA_API_KEY') {
    throw new Error(
      "Aucune clé API NVIDIA configurée côté serveur. Veuillez définir NVIDIA_API_KEY pour activer Diana."
    );
  }
  return key;
}

function extractMessageText(content: string | NvidiaChatContentPart[] | null | undefined): string {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
}

function mapNvidiaError(status: number, rawMessage: string): Error {
  const lower = rawMessage.toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key')
  ) {
    return new Error(
      "Clé API NVIDIA invalide ou non autorisée. Vérifiez votre clé NVIDIA_API_KEY dans les paramètres serveur."
    );
  }
  if (status === 429 || lower.includes('rate limit') || lower.includes('quota')) {
    return new Error(
      "Quota de l'API NVIDIA temporairement atteint. Veuillez patienter avant de réessayer."
    );
  }
  if (status === 404 || lower.includes('not found')) {
    return new Error("Modèle IA NVIDIA introuvable ou indisponible pour cette clé API.");
  }
  return new Error(rawMessage || "Impossible d'obtenir une réponse de Diana.");
}

type NvidiaOutboundPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type ChatConversationMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | NvidiaOutboundPart[] }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls?: NvidiaToolCall[];
    }
  | {
      role: 'tool';
      tool_call_id: string;
      name: string;
      content: string;
    };

function buildUserContent(text: string, imageDataUrl?: string): string | NvidiaOutboundPart[] {
  if (!imageDataUrl) {
    return text;
  }
  return [
    { type: 'text', text: text || 'Analyse cette image.' },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ];
}

function safeParseToolArguments(raw?: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function callNvidiaCompletions(
  apiKey: string,
  messages: ChatConversationMessage[],
  withTools: boolean
): Promise<{ status: number; ok: boolean; data: NvidiaChatResponse }> {
  const payload: Record<string, unknown> = {
    model: NVIDIA_AI_MODEL,
    messages,
    max_tokens: 768,
    stream: true,
    temperature: 0.4,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    reasoning_effort: 'low',
  };
  if (withTools) {
    payload.tools = AI_CREATION_TOOLS;
    payload.tool_choice = 'auto';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(NVIDIA_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/event-stream, application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as NvidiaChatResponse;
      return { status: response.status, ok: false, data };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream') || !response.body) {
      const data = (await response.json().catch(() => ({}))) as NvidiaChatResponse;
      return { status: response.status, ok: response.ok, data };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let assembledText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonPart = trimmed.slice(5).trim();
        if (jsonPart === '[DONE]') continue;
        try {
          const chunk = JSON.parse(jsonPart) as {
            choices?: Array<{
              delta?: { content?: string | null };
            }>;
          };
          const piece = chunk?.choices?.[0]?.delta?.content;
          if (typeof piece === 'string' && piece) {
            assembledText += piece;
          }
        } catch {
          // Ignorer chunk SSE partiel
        }
      }
    }

    return {
      status: response.status,
      ok: true,
      data: {
        choices: [
          {
            message: {
              role: 'assistant',
              content: assembledText.trim(),
            },
          },
        ],
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// GENERATION DE REPONSE IA ET EXECUTION D'ACTIONS VIA NVIDIA CHAT COMPLETIONS
function getDefaultFormIntro(formRequest: AiFormRequest): string {
  if (formRequest.entityType === 'patient') {
    return 'Complétez les informations ci-dessous pour créer la fiche individuelle.';
  }
  if (formRequest.entityType === 'prothese') {
    return 'Complétez les informations ci-dessous pour enregistrer la prothèse dentaire.';
  }
  return 'Complétez les informations ci-dessous pour enregistrer la prise en charge.';
}

export async function generateAiDiscussionReply(
  history: DiscussionMessage[],
  prompt: string,
  imageDataUrl?: string
): Promise<{
  replyText: string;
  createdEntities: AiCreatedEntity[];
  formRequest?: AiFormRequest;
}> {
  const apiKey = resolveNvidiaApiKey();
  const workspaceContext = await buildAiWorkspaceContext();
  const slicedHistory = history.slice(-16);

  const recentHistory: ChatConversationMessage[] = slicedHistory.map((msg, index) => {
    const keepImage =
      msg.role === 'user' &&
      Boolean(msg.imageDataUrl) &&
      index >= slicedHistory.length - 4;
    if (msg.role === 'assistant') {
      return { role: 'assistant', content: msg.content };
    }
    return {
      role: 'user',
      content: buildUserContent(msg.content, keepImage ? msg.imageDataUrl : undefined),
    };
  });

  const buildInitialMessages = (includeFallbackGuide: boolean): ChatConversationMessage[] => [
    {
      role: 'system',
      content: includeFallbackGuide
        ? `${SYSTEM_INSTRUCTION}\n\n${FALLBACK_ACTION_GUIDE}\n\nContexte actuel :\n${workspaceContext}`
        : `${SYSTEM_INSTRUCTION}\n\nContexte actuel :\n${workspaceContext}`,
    },
    ...recentHistory,
    { role: 'user', content: buildUserContent(prompt, imageDataUrl) },
  ];

  const createdEntities: AiCreatedEntity[] = [];
  let formRequest: AiFormRequest | undefined;

  try {
    let useTools = false;
    const messages = buildInitialMessages(true);

    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      let { status, ok, data } = await callNvidiaCompletions(apiKey, messages, useTools);

      if (!ok && useTools && (status === 400 || status === 422)) {
        const errText = (
          data?.error?.message ||
          data?.detail ||
          data?.message ||
          ''
        ).toLowerCase();
        if (errText.includes('tool') || errText.includes('function')) {
          useTools = false;
          const fallbackMessages = buildInitialMessages(true);
          messages.splice(0, messages.length, ...fallbackMessages);
          ({ status, ok, data } = await callNvidiaCompletions(apiKey, messages, false));
        }
      }

      if (!ok) {
        const upstreamError =
          data?.error?.message || data?.detail || data?.message || `HTTP ${status}`;
        throw mapNvidiaError(status, upstreamError);
      }

      const choiceMessage = data?.choices?.[0]?.message;
      const toolCalls = Array.isArray(choiceMessage?.tool_calls)
        ? choiceMessage.tool_calls
        : [];

      if (toolCalls.length > 0 && useTools) {
        const assistantDraftText = extractMessageText(choiceMessage?.content);
        messages.push({
          role: 'assistant',
          content: assistantDraftText || null,
          tool_calls: toolCalls,
        });

        let shouldReturnFormImmediately = false;

        for (const call of toolCalls) {
          const toolName = call.function?.name || '';
          const parsedArgs = safeParseToolArguments(call.function?.arguments);
          const outcome = await executeAiToolCall(toolName, parsedArgs);
          if (outcome.ok && outcome.createdEntity) {
            createdEntities.push(outcome.createdEntity);
          }
          if (outcome.ok && outcome.formRequest) {
            formRequest = outcome.formRequest;
            shouldReturnFormImmediately = true;
          }
          messages.push({
            role: 'tool',
            tool_call_id: call.id || `call_${Date.now()}`,
            name: toolName,
            content: JSON.stringify(outcome),
          });
        }

        if (shouldReturnFormImmediately && formRequest && createdEntities.length === 0) {
          const replyText = (assistantDraftText || getDefaultFormIntro(formRequest)).slice(0, 4000);
          return {
            replyText,
            createdEntities,
            formRequest,
          };
        }
        continue;
      }

      const rawText = extractMessageText(choiceMessage?.content);
      const { cleanText, actions } = extractFallbackActions(rawText);

      if (actions.length > 0) {
        const summaryLines: string[] = [];
        for (const action of actions) {
          const outcome = await executeAiToolCall(action.name, action.arguments);
          if (outcome.ok && outcome.createdEntity) {
            createdEntities.push(outcome.createdEntity);
            summaryLines.push(`Enregistrement créé : ${outcome.createdEntity.label}`);
          } else if (outcome.ok && outcome.formRequest) {
            formRequest = outcome.formRequest;
          } else if (!outcome.ok && typeof outcome.result?.error === 'string') {
            summaryLines.push(`Impossible de créer : ${outcome.result.error}`);
          }
        }
        const baseReply = [cleanText, ...summaryLines].filter(Boolean).join('\n\n').trim();
        const combined = baseReply || (formRequest ? getDefaultFormIntro(formRequest) : '');
        if (!combined) {
          throw new Error("Diana n'a retourné aucune réponse.");
        }
        return {
          replyText: combined.slice(0, 4000),
          createdEntities,
          ...(formRequest ? { formRequest } : {}),
        };
      }

      const finalText = cleanText || (formRequest ? getDefaultFormIntro(formRequest) : '');
      if (!finalText) {
        throw new Error("Diana n'a retourné aucune réponse.");
      }

      return {
        replyText: finalText.slice(0, 4000),
        createdEntities,
        ...(formRequest ? { formRequest } : {}),
      };
    }

    if (createdEntities.length > 0) {
      const summary = createdEntities.map((e) => `- ${e.label}`).join('\n');
      return {
        replyText: `Les enregistrements suivants ont été créés :\n${summary}`.slice(0, 4000),
        createdEntities,
        ...(formRequest ? { formRequest } : {}),
      };
    }

    if (formRequest) {
      return {
        replyText: getDefaultFormIntro(formRequest),
        createdEntities,
        formRequest,
      };
    }

    throw new Error("Diana n'a pas pu finaliser sa réponse.");
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error("Le délai de réponse de Diana a expiré. Veuillez réessayer.");
    }
    if (
      error instanceof Error &&
      (error.message.includes('NVIDIA') || error.message.includes('Diana'))
    ) {
      throw error;
    }
    throw new Error(
      error instanceof Error ? error.message : "Impossible d'obtenir une réponse de Diana."
    );
  }
}
