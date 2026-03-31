import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "/";

export const useAuthStore = create((set, get) => ({
    authUser: null,
    lastOffline: 0,
    isSigningUp: false,
    isLoggingIn: false,
    isUpdatingProfile: false,
    isCheckingAuth: true,
    onlineUsers: [],
    socket: null,
    offlineListenerAttached: false,

    saveOfflineTimestamp: () => {
      if (typeof window === "undefined") return;
      const now = Date.now();
      const currentOffline = localStorage.getItem("pesify_lastOffline") || "0";
      if (currentOffline !== "0") {
        localStorage.setItem("pesify_lastOffline_cached", currentOffline);
      }
      localStorage.setItem("pesify_lastOffline", now.toString());
      set({ lastOffline: now });
    },

    connectSocket: () => {},

    getSavedLastOffline: () => {
      if (typeof window === "undefined") return 0;
      const rawLastOffline = localStorage.getItem("pesify_lastOffline") || "0";
      const cached = localStorage.getItem("pesify_lastOffline_cached") || "0";
      if (cached !== "0") {
        localStorage.removeItem("pesify_lastOffline_cached");
        return Number(cached);
      }
      return Number(rawLastOffline);
    },

     checkAuth: async() => {
        try {
            const res = await axiosInstance.get('/auth/check');
            const lastOffline = get().getSavedLastOffline();

            set({ authUser: res.data, lastOffline });
            get().connectSocket();

        } catch (error) {
            console.error("Error in checkAuth", error);
            set({ authUser: null });
        } finally {
            set({ isCheckingAuth: false });
        }
     },

     signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
      return res.data;

    } catch (error) {
      console.error("Signup error", error);
      const message = error?.response?.data?.message ?? error?.message ?? "Signup failed";
      toast.error(message);
      return null;
    } finally {
      set({ isSigningUp: false });
    }
     },

      login: async (data) => {
      set({ isLoggingIn: true });
      try {
        const res = await axiosInstance.post("/auth/login", data);
        const lastOffline = typeof window !== "undefined" ? Number(localStorage.getItem("pesify_lastOffline") || 0) : 0;
        set({ authUser: res.data, lastOffline });
        toast.success("Logged in successfully");

        get().connectSocket();
      } catch (error) {
        toast.error(error.response?.data?.message ?? error.message);
      } finally {
        set({ isLoggingIn: false });
      }
     },


     logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      const now = Date.now();
      if (typeof window !== "undefined") {
        localStorage.setItem("pesify_lastOffline", now.toString());
      }
      set({ authUser: null, lastOffline: now });
      toast.success("Logged out successfully");
      get().disconnectSocket();
      const { useChatStore } = await import("./useChatStore.js");
      useChatStore.getState().setSelectedUser(null);
    } catch (error) {
      toast.error(error.response?.data?.message ?? error.message);
    }
     },

      updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
      return res.data;
    } catch (error) {
      console.log("error in update profile:", error);
      const message = error?.response?.data?.message ?? error?.message ?? "Failed to update profile";
      toast.error(message);
      return null;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser, socket, offlineListenerAttached } = get();
    if (!authUser || socket?.connected) return;

    const newSocket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
    });
    newSocket.connect();

    set({ socket: newSocket });

    if (typeof window !== "undefined" && !offlineListenerAttached) {
      window.addEventListener("beforeunload", get().saveOfflineTimestamp);
      set({ offlineListenerAttached: true });
    }

    newSocket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },
  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
    if (typeof window !== "undefined" && get().offlineListenerAttached) {
      window.removeEventListener("beforeunload", get().saveOfflineTimestamp);
      set({ offlineListenerAttached: false });
    }
  },
}));