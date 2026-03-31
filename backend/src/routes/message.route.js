import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage, deleteMessage, deleteMessages } from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.delete("/:id", protectRoute, deleteMessage);
router.delete("/", protectRoute, deleteMessages);
router.post("/send/:id", protectRoute, sendMessage );

export default router;