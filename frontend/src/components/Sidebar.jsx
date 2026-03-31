import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

const Sidebar = () => {
    const { getUsers, users, selectedUser, setSelectedUser, isUserLoading, unreadCounts, subscribeToMessages, unsubscribeFromMessages } = useChatStore();

    const { onlineUsers, socket, authUser, lastOffline } = useAuthStore();
    const [showOnlineOnly, setShowOnlineOnly] = useState(false);

    useEffect(() => {
        if (!authUser) return;
        getUsers();
    }, [authUser, lastOffline, getUsers]);

    // Ensure users are loaded after auth
    useEffect(() => {
        if (authUser && users.length === 0) {
            getUsers();
        }
    }, [authUser, users.length, getUsers]);

    useEffect(() => {
      if (!socket) return;
      subscribeToMessages();
      return () => unsubscribeFromMessages();
    }, [socket, subscribeToMessages, unsubscribeFromMessages]);

    const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

    if (isUserLoading) return <SidebarSkeleton />;
  return (
    <aside className="h-full w-16 sm:w-20 md:w-64 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200 min-h-0 flex-shrink-0">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <span className="font-medium hidden lg:block">Contacts</span>
        </div>
        {/*TODO: Online filter toggle */}
         <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
        </div>
      </div>
      <div className="overflow-y-auto w-full py-3 flex-1">
        {filteredUsers.map((user) => (
          <button
            key={user._id}
            onClick={() => setSelectedUser(user)}
            className={`
              w-full p-2 sm:p-3 flex items-center gap-2 sm:gap-3
              hover:bg-base-300 transition-colors
              ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <div className="relative flex-shrink-0 mx-auto w-10 sm:w-12 lg:w-auto lg:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.fullname}
                className="size-10 sm:size-12 object-cover rounded-full"
              />
              {onlineUsers.includes(user._id) && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
                />
              )}
            </div>

            {/* User info - now visible on mobile with truncate */}
            <div className="flex flex-col text-left min-w-0 flex-1 truncate lg:flex-row lg:items-center">
              <div className="font-medium truncate text-sm lg:text-base">{user.fullname}</div>
              <div className="text-xs lg:text-sm text-zinc-400 hidden sm:block truncate">
                {onlineUsers.includes(user._id) ? "Online" : "Offline"}
              </div>
            </div>
            {(unreadCounts[user._id] || user.unreadCount) > 0 && (
              <span className="badge badge-sm badge-error whitespace-nowrap">{(unreadCounts[user._id] || user.unreadCount) > 9 ? "9+" : (unreadCounts[user._id] || user.unreadCount)}</span>
            )}
          </button>
        ))}
        {filteredUsers.length === 0 && (
          <div className="text-center text-zinc-500 py-4">No online users</div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
