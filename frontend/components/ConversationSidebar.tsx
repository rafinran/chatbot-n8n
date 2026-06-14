"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import {
  listConversations,
  createConversation,
  deleteConversation,
} from "@/lib/api";

interface Conversation {
  id: number;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConversationSidebarProps {
  activeConversationId: number | null;
  onSelectConversation: (id: number) => void;
  onNewConversation: () => void;
}

export function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await listConversations();
      if (response?.conversations) {
        setConversations(response.conversations);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = async () => {
    try {
      const response = await createConversation();
      if (response?.conversation) {
        setConversations([response.conversation, ...conversations]);
        onNewConversation();
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;

    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        onNewConversation();
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  return (
    <div className="w-64 flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b">
        <button
          onClick={handleNewConversation}
          className="w-full flex items-center justify-center gap-2 bg-[#0A2A8B] text-white rounded-lg px-4 py-2.5 font-medium hover:bg-[#081f63] transition"
        >
          <Plus size={18} />
          Chat Baru
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Loading...
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No conversations yet
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between group transition ${
                  activeConversationId === conv.id
                    ? "bg-[#0A2A8B] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MessageSquare
                    size={16}
                    className="flex-shrink-0"
                  />
                  <span className="text-sm truncate">
                    {conv.title || "Untitled"}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  className={`flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition ${
                    activeConversationId === conv.id
                      ? "hover:bg-white/20"
                      : "hover:bg-gray-200"
                  }`}
                >
                  <Trash2 size={14} />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
