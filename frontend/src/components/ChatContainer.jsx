import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";
import { CheckSquare, FileText, Square, Trash2 } from "lucide-react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    deleteMessages,
  } = useChatStore();
  const { authUser, lastOffline } = useAuthStore();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const messageEndRef = useRef(null);

  const scrollToBottom = () => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const downloadAttachment = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Download failed", error);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const getMessageAttachments = (message) => {
    if (Array.isArray(message.attachments) && message.attachments.length) {
      return message.attachments;
    }

    const fallback = [];
    if (message.image) {
      fallback.push({ url: message.image, type: "image/*", name: "Image" });
    }
    if (message.audio) {
      fallback.push({ url: message.audio, type: "audio/*", name: "Audio" });
    }
    if (message.attachmentUrl) {
      fallback.push({
        url: message.attachmentUrl,
        type: message.attachmentType || "application/octet-stream",
        name: message.attachmentName || "Download file",
      });
    }
    return fallback;
  };

  const toggleSelection = () => {
    setSelectionMode((prev) => !prev);
    if (selectionMode) {
      setSelectedIds([]);
    }
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const handleSelectMessage = (messageId) => {
    setSelectedIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    );
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;

    const confirmed = window.confirm(`Delete ${selectedIds.length} selected message(s)?`);
    if (!confirmed) return;

    await deleteMessages(selectedIds);
    setSelectedIds([]);
    setSelectionMode(false);
  };

  useEffect(() => {
    if (!selectedUser || !authUser) return;
    getMessages(selectedUser._id);
  }, [selectedUser?._id, authUser, lastOffline, getMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => messages.some((message) => message._id === id)));
  }, [messages]);

  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, [selectedUser._id]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader
        selectionMode={selectionMode}
        selectedCount={selectedIds.length}
        onToggleSelectionMode={toggleSelection}
      />

      {selectionMode && (
        <div className="p-3 border-b border-base-300 bg-base-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-medium">{selectedIds.length} selected</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={clearSelection}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-error btn-sm"
              disabled={!selectedIds.length}
              onClick={handleDeleteSelected}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={message._id}>
            {message.isNew && (index === 0 || !messages[index - 1]?.isNew) && (
              <div className="mb-3 flex items-center justify-center">
                <span className="rounded-full bg-base-200 px-4 py-1 text-xs font-medium uppercase tracking-widest text-zinc-500">
                  New messages
                </span>
              </div>
            )}
            <div
              className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"} ${selectionMode ? "cursor-pointer items-start" : ""}`}
              onClick={selectionMode ? () => handleSelectMessage(message._id) : undefined}
            >
            {selectionMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectMessage(message._id);
                }}
                className={`btn btn-ghost btn-sm btn-circle mr-2 self-start ${selectedIds.includes(message._id) ? "bg-primary text-primary-content" : "bg-base-100"}`}
              >
                {selectedIds.includes(message._id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
            )}
            <div className=" chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    message.senderId === authUser._id
                      ? authUser.profilePic || "/avatar.png"
                      : selectedUser.profilePic || "/avatar.png"
                  }
                  alt="profile pic"
                />
              </div>
            </div>
            <div className="chat-header mb-1">
              <time className="text-xs opacity-50 ml-1">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>
            <div className="chat-bubble flex flex-col">
              {getMessageAttachments(message).map((attachment, idx) => (
                <div key={`${message._id}-${idx}`} className="mb-2">
                  {attachment.type?.startsWith("image/") ? (
                    <img
                      src={attachment.url}
                      alt={attachment.name || "Attachment"}
                      className="sm:max-w-[200px] rounded-md mb-2"
                      onLoad={scrollToBottom}
                    />
                  ) : attachment.type?.startsWith("audio/") ? (
                    <audio
                      controls
                      src={attachment.url}
                      className="sm:max-w-[250px] rounded-md mb-2"
                    />
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200 p-3 mb-2">
                      <FileText className="w-5 h-5" />
                      <button
                        type="button"
                        onClick={() => downloadAttachment(attachment.url, attachment.name)}
                        className="font-medium text-left"
                      >
                        {attachment.name || "Download file"}
                      </button>
                      <span className="text-xs opacity-60">{attachment.type?.split("/")[1] || "file"}</span>
                    </div>
                  )}
                </div>
              ))}
              {message.text && <p>{message.text}</p>}
            </div>
          </div>
        </div>
        ))}
        <div ref={messageEndRef} />
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;