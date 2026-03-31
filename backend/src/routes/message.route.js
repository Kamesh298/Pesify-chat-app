import express from "express";
import multer from "multer";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage, deleteMessage, deleteMessages } from "../controllers/message.controller.js";

const router = express.Router();

// ✅ Multer setup for file uploads - max 10 files, 10MB each
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Allow images, audio, documents (no videos)
    if (file.mimetype.startsWith("video/")) {
      return cb(new Error("Video files not supported"), false);
    }
    cb(null, true);
  }
});

// Routes
router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.delete("/:id", protectRoute, deleteMessage);
router.delete("/", protectRoute, deleteMessages);
router.post("/send/:id", protectRoute, upload.array("attachments", 10), sendMessage);

export default router;
