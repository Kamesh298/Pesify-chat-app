import User from "../models/user.model.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";


export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const lastOffline = Number(req.query.lastOffline) || 0;
        const { unreadOnly } = req.query;

        const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

        let unreadBySender = {};
        if (!unreadOnly || unreadOnly === 'true') {
            const cutoffDate = lastOffline > 0 ? new Date(lastOffline) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days default
            const unreadMessages = await Message.aggregate([
                {
                    $match: {
                        receiverId: loggedInUserId,
                        createdAt: { $gt: cutoffDate },
                    },
                },
                {
                    $group: {
                        _id: "$senderId",
                        count: { $sum: 1 },
                    },
                },
            ]);

            unreadBySender = unreadMessages.reduce((acc, item) => {
                acc[item._id.toString()] = item.count;
                return acc;
            }, {});
        }

        const usersWithUnread = filteredUsers.map((user) => ({
            ...user.toObject(),
            unreadCount: unreadBySender[user._id.toString()] || 0,
        }));

        res.status(200).json(usersWithUnread);
    } catch (error) {
        console.log("Error in getUsersForSidebar: ", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


export const getMessages = async (req, res) => {
    try {
        const { id:userToChatId } = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId }
            ]
        })

        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessages controller: ", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { text, image, audio, file, fileType, fileName, attachments } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        let imageUrl;
        let audioUrl;
        let attachmentUrl;
        let attachmentType;
        let attachmentName;
        const sentAttachments = [];

        if (Array.isArray(attachments) && attachments.length) {
            for (const fileData of attachments) {
                const { dataUrl, fileType: itemType, fileName: itemName } = fileData;
                if (!dataUrl || !itemType || !itemName) continue;

                let resourceType = "raw";
                if (itemType.startsWith("image/")) {
                    resourceType = "image";
                } else if (itemType.startsWith("audio/")) {
                    resourceType = "auto";
                }

                const uploadResponse = await cloudinary.uploader.upload(dataUrl, {
                    resource_type: resourceType,
                });

                const url = uploadResponse.secure_url;
                sentAttachments.push({ url, type: itemType, name: itemName });

                if (!imageUrl && itemType.startsWith("image/")) {
                    imageUrl = url;
                }
                if (!audioUrl && itemType.startsWith("audio/")) {
                    audioUrl = url;
                }
                if (!attachmentUrl && !itemType.startsWith("image/") && !itemType.startsWith("audio/")) {
                    attachmentUrl = url;
                    attachmentType = itemType;
                    attachmentName = itemName;
                }
            }
        } else {
            if (image) {
                const uploadResponse = await cloudinary.uploader.upload(image, {
                    resource_type: "image",
                });
                imageUrl = uploadResponse.secure_url;
            }

            if (audio) {
                const uploadResponse = await cloudinary.uploader.upload(audio, {
                    resource_type: "auto",
                });
                audioUrl = uploadResponse.secure_url;
            }

            if (file) {
                let resourceType = "auto";
                if (fileType?.startsWith("image/")) {
                    resourceType = "image";
                } else if (fileType?.startsWith("audio/")) {
                    resourceType = "auto";
                } else {
                    resourceType = "raw";
                }

                const uploadResponse = await cloudinary.uploader.upload(file, {
                    resource_type: resourceType,
                });
                attachmentUrl = uploadResponse.secure_url;
                attachmentType = fileType;
                attachmentName = fileName;

                if (fileType?.startsWith("image/")) {
                    imageUrl = attachmentUrl;
                }
                if (fileType?.startsWith("audio/")) {
                    audioUrl = attachmentUrl;
                }
            }
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
            audio: audioUrl,
            attachmentUrl,
            attachmentType,
            attachmentName,
            attachments: sentAttachments,
        });

        await newMessage.save();

        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", newMessage);
        }

        res.status(201).json(newMessage);
    } catch (error) {
        console.log("Error in sendMessage controller: ", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const messageId = req.params.id;
        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        const currentUserId = req.user._id.toString();
        const isSender = message.senderId.toString() === currentUserId;
        const isReceiver = message.receiverId.toString() === currentUserId;

        if (!isSender && !isReceiver) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const otherUserId = isSender ? message.receiverId.toString() : message.senderId.toString();
        await message.deleteOne();

        const otherSocketId = getReceiverSocketId(otherUserId);
        if (otherSocketId) {
            io.to(otherSocketId).emit("deletedMessages", { messageIds: [messageId] });
        }

        res.status(200).json({ message: "Message deleted successfully" });
    } catch (error) {
        console.log("Error in deleteMessage controller: ", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const deleteMessages = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "No message IDs provided" });
        }

        const currentUserId = req.user._id.toString();
        const messages = await Message.find({ _id: { $in: ids } });

        if (messages.length !== ids.length) {
            return res.status(404).json({ error: "Some messages were not found" });
        }

        const invalidMessage = messages.find((message) => {
            const senderId = message.senderId.toString();
            const receiverId = message.receiverId.toString();
            return senderId !== currentUserId && receiverId !== currentUserId;
        });

        if (invalidMessage) {
            return res.status(403).json({ error: "Forbidden to delete one or more selected messages" });
        }

        await Message.deleteMany({ _id: { $in: ids } });

        const otherUserIds = [...new Set(
            messages.map((message) => {
                const senderId = message.senderId.toString();
                const receiverId = message.receiverId.toString();
                return senderId === currentUserId ? receiverId : senderId;
            })
        )];

        otherUserIds.forEach((userId) => {
            const otherSocketId = getReceiverSocketId(userId);
            if (otherSocketId) {
                io.to(otherSocketId).emit("deletedMessages", { messageIds: ids });
            }
        });

        res.status(200).json({ message: "Messages deleted successfully", ids });
    } catch (error) {
        console.log("Error in deleteMessages controller: ", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};