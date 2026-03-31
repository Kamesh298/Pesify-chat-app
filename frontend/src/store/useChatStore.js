import { create } from 'zustand';
import { toast } from 'react-hot-toast';
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from './useAuthStore';

export const useChatStore = create((set, get) => ({
    messages: [],
    users: [],
    selectedUser: null,
    chatLastSeen: {},
    unreadCounts: {},
    isUserLoading: false,
    isMessagesLoading: false,

    clearUnreadCount: (userId) => {
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [userId]: 0,
        },
        users: state.users.map((user) =>
          user._id === userId ? { ...user, unreadCount: 0 } : user
        ),
      }));
    },

    incrementUnreadCount: (userId) => {
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [userId]: (state.unreadCounts[userId] || 0) + 1,
        },
      }));
    },

    getUsers: async () => {
        set({ isUserLoading: true });
        try {
            const lastOffline = useAuthStore.getState().lastOffline || 0;
const res = await axiosInstance.get(`messages/users?lastOffline=${lastOffline}&unreadOnly=true`);
            const unreadCounts = res.data.reduce((acc, user) => {
              if (user.unreadCount > 0) acc[user._id] = user.unreadCount;
              return acc;
            }, {});
            set({ users: res.data, unreadCounts });
        } catch (error) {
            toast.error(error.response?.data?.message ?? error.message);
        } finally {
            set({ isUserLoading: false });
        }
    },

    getMessages: async (userId) => {
        set({ isMessagesLoading: true });
        try {
            const res = await axiosInstance.get(`messages/${userId}`);
            const authUserId = useAuthStore.getState().authUser?._id;
            const lastSeen = get().chatLastSeen[userId] || 0;
            const lastOffline = useAuthStore.getState().lastOffline || 0;
            const messagesWithFlags = res.data.map((message) => {
                const createdAt = new Date(message.createdAt).getTime();
                const hasSelectedLastSeen = lastSeen > 0 && createdAt > lastSeen;
                const hasOfflineNewMessages = lastSeen === 0 && lastOffline > 0 && createdAt > lastOffline;
                return {
                    ...message,
                    isNew: message.senderId !== authUserId && (hasSelectedLastSeen || hasOfflineNewMessages),
                };
            });
            set({ messages: messagesWithFlags });
        } catch (error) {
            toast.error(error.response?.data?.message ?? error.message);
        } finally {
            set({ isMessagesLoading: false });
        }
    },

    subscribeToMessages: () => {
      const socket = useAuthStore.getState().socket;
      if (!socket) return;

      get().unsubscribeFromMessages();

      socket.on("newMessage", (newMessage) => {
        const selectedUser = get().selectedUser;
        const authUserId = useAuthStore.getState().authUser?._id;
        if (!authUserId || newMessage.senderId === authUserId) return;

        const isCurrentChat = selectedUser?._id === newMessage.senderId;
        if (isCurrentChat) {
          set({ messages: [...get().messages, { ...newMessage, isNew: true }] });
        } else {
          get().incrementUnreadCount(newMessage.senderId);
        }
      });

      socket.on("deletedMessages", ({ messageIds }) => {
        set({ messages: get().messages.filter((message) => !messageIds.includes(message._id)) });
      });
    },

    unsubscribeFromMessages: () => {
      const socket = useAuthStore.getState().socket;
      if (!socket) return;
      socket.off("newMessage");
      socket.off("deletedMessages");
    },

    sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      // ✅ Auto-detect FormData (axios sets multipart headers automatically)
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData, {
        headers: messageData instanceof FormData 
          ? { 'Content-Type': 'multipart/form-data' }
          : {}
      });
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response?.data?.message ?? error.message ?? "Failed to send message");
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`messages/${messageId}`);
      set({ messages: get().messages.filter((message) => message._id !== messageId) });
      toast.success("Message deleted");
    } catch (error) {
      toast.error(error.response?.data?.message ?? "Failed to delete message");
    }
  },

  deleteMessages: async (messageIds) => {
    try {
      await axiosInstance.delete(`messages`, { data: { ids: messageIds } });
      set({ messages: get().messages.filter((message) => !messageIds.includes(message._id)) });
      toast.success("Selected messages deleted");
    } catch (error) {
      toast.error(error.response?.data?.message ?? "Failed to delete selected messages");
    }
  },

  setSelectedUser: (selectedUser) => {
    const previousSelectedUser = get().selectedUser;
    if (previousSelectedUser && previousSelectedUser._id !== selectedUser?._id) {
      set((state) => ({
        chatLastSeen: {
          ...state.chatLastSeen,
          [previousSelectedUser._id]: Date.now(),
        },
      }));
    }
    set({ selectedUser });
    if (selectedUser) {
      get().clearUnreadCount(selectedUser._id);
    }
  },
}));


