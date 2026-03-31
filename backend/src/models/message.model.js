import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        text: {
            type: String,
        },
        image: {
            type: String,
        },
        audio: {
            type: String,
        },
        attachmentUrl: {
            type: String,
        },
        attachmentType: {
            type: String,
        },
        attachmentName: {
            type: String,
        },
        attachments: [
            {
                url: {
                    type: String,
                    required: true,
                },
                type: {
                    type: String,
                },
                name: {
                    type: String,
                },
            },
        ],
    },
    { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
