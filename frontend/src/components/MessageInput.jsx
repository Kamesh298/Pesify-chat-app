import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Mic, Paperclip, Send, StopCircle, X } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const { sendMessage } = useChatStore();

  const readFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({ dataUrl: reader.result, type: file.type, name: file.name });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    const allowedFiles = selectedFiles.filter((file) => !file.type.startsWith("video/"));
    if (allowedFiles.length !== selectedFiles.length) {
      toast.error("Video files are not supported");
    }

    const loadedAttachments = await Promise.all(
      allowedFiles.map(async (file) => await readFile(file))
    );

    setAttachments((prev) => [...prev, ...loadedAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone access is not available in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-message-${Date.now()}.webm`, { type: blob.type });
        const loadedAttachment = await readFile(file);
        setAttachments((prev) => [...prev, loadedAttachment]);
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      toast.error("Unable to access microphone");
      console.error("Recording error:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && attachments.length === 0) return;

    const payload = {
      text: text.trim() || undefined,
      attachments: attachments.map(({ dataUrl, type, name }) => ({
        dataUrl,
        fileType: type,
        fileName: name,
      })),
    };

    try {
      await sendMessage(payload);
      setText("");
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="p-4 w-full">
      {attachments.length > 0 && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {attachments.map((attachment, index) => (
            <div key={`${attachment.name}-${index}`} className="relative rounded-lg border border-zinc-700 bg-base-200 p-3">
              {attachment.type.startsWith("image/") && (
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="w-full h-32 object-cover rounded-md"
                />
              )}

              {attachment.type.startsWith("audio/") && (
                <audio controls src={attachment.dataUrl} className="w-full" />
              )}

              {!attachment.type.startsWith("image/") && !attachment.type.startsWith("audio/") && (
                <div className="flex flex-col gap-2">
                  <span className="font-medium truncate">{attachment.name}</span>
                  <span className="text-xs opacity-70">{attachment.type || "file"}</span>
                </div>
              )}

              <button
                onClick={() => removeAttachment(index)}
                className="absolute -top-2 -right-2 btn btn-circle btn-sm btn-ghost"
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            type="file"
            accept="*/*"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle ${attachments.length ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={20} />
          </button>

          <button
            type="button"
            className={`btn btn-circle btn-sm ${isRecording ? "btn-error" : "btn-primary"}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && attachments.length === 0}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};
export default MessageInput;
