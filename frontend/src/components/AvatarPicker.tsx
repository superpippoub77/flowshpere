import { useRef, useState } from "react";
import { Avatar, Box, IconButton, Tooltip } from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCameraOutlined";

function readAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ base64: (reader.result as string).split(",")[1] ?? "", mimeType: file.type || "image/jpeg" });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AvatarPicker({
  currentUrl,
  fallbackText,
  onPick,
}: {
  currentUrl?: string;
  fallbackText: string;
  onPick: (data: { base64: string; mimeType: string; previewUrl: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const { base64, mimeType } = await readAsBase64(file);
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    onPick({ base64, mimeType, previewUrl });
  }

  return (
    <Box sx={{ position: "relative", width: 72, height: 72 }}>
      <Avatar src={preview ?? currentUrl} sx={{ width: 72, height: 72, fontSize: 24 }}>
        {fallbackText}
      </Avatar>
      <Tooltip title="Cambia immagine">
        <IconButton
          size="small"
          onClick={() => inputRef.current?.click()}
          sx={{
            position: "absolute",
            bottom: -4,
            right: -4,
            background: "var(--ink-navy)",
            border: "1px solid rgba(127,184,217,0.3)",
            "&:hover": { background: "var(--ink-navy)" },
          }}
        >
          <PhotoCameraIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files)} />
    </Box>
  );
}
