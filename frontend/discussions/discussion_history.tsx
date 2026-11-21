import React from 'react';
import { PlusIcon, TrashIcon } from '../navigation/navigation_icons';

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface DiscussionHistoryProps {
  conversations: ConversationSummary[];
  activeConversationId: string;
  isBusy: boolean;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onCreateNewChat: () => void;
}

function formatHistoryDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  });
}

// VUE HISTORIQUE DES CONVERSATIONS AVEC DIANA
export const DiscussionHistory: React.FC<DiscussionHistoryProps> = ({
  conversations,
  activeConversationId,
  isBusy,
  onSelectConversation,
  onDeleteConversation,
  onCreateNewChat,
}) => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3.5 py-2 bg-[#FFFFFF] space-y-2">
      <div className="flex items-center justify-between px-0.5 pb-1">
        <span className="text-[12px] font-semibold text-[#111827]">
          Historique des conversations
        </span>
        <button
          type="button"
          onClick={onCreateNewChat}
          disabled={isBusy}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8] disabled:opacity-50 cursor-pointer"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Nouveau
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="h-[75%] flex flex-col items-center justify-center text-center px-4">
          <p className="text-[12px] text-[#374151]">
            Aucune conversation enregistrée pour le moment.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-colors ${
                  isActive
                    ? 'bg-[#EFF6FF] border-[#BFDBFE]'
                    : 'bg-[#F8F9FA] border-[#E5E7EB] hover:bg-[#F3F4F6]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <p className="text-[12px] font-medium text-[#111827] truncate">
                    {conv.title}
                  </p>
                  <p className="text-[10px] text-[#374151] mt-0.5">
                    {formatHistoryDate(conv.updatedAt)} · {conv.messageCount} message
                    {conv.messageCount > 1 ? 's' : ''}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteConversation(conv.id)}
                  disabled={isBusy}
                  aria-label="Supprimer cette conversation"
                  title="Supprimer"
                  className="w-7 h-7 rounded-full text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
