import { useRef, useState } from "react";
import { Box, Typography, Stack, Chip, IconButton } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DownloadIcon from "@mui/icons-material/DownloadOutlined";
import { getAttachmentUrl } from "../../api/client";

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AttachmentDropzone({
  attachments,
  companyId,
  onUpload,
  uploading,
}: {
  attachments: { id: string; fileName: string; size: number; uploadedBy: { fullName: string } }[];
  companyId: string;
  onUpload: (file: { fileName: string; mimeType: string; dataBase64: string }) => void;
  uploading?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const dataBase64 = await readAsBase64(file);
    onUpload({ fileName: file.name, mimeType: file.type || "application/octet-stream", dataBase64 });
  }

  return (
    <Box>
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        sx={{
          border: "1.5px dashed",
          borderColor: dragOver ? "primary.main" : "rgba(127,184,217,0.35)",
          borderRadius: 1,
          p: 2,
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "rgba(127,184,217,0.08)" : "transparent",
        }}
      >
        <AttachFileIcon fontSize="small" sx={{ mb: 0.5, color: "text.secondary" }} />
        <Typography variant="body2" color="text.secondary">
          {uploading ? "Caricamento in corso..." : "Trascina un file qui, oppure clicca per sceglierlo (max 8MB)"}
        </Typography>
        <input ref={inputRef} type="file" hidden onChange={(e) => handleFiles(e.target.files)} />
      </Box>

      {attachments.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          {attachments.map((a) => (
            <Stack key={a.id} direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <Chip size="small" label={`${Math.round(a.size / 1024)} KB`} />
                <Typography variant="body2">{a.fileName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  — {a.uploadedBy.fullName}
                </Typography>
              </Stack>
              <IconButton size="small" component="a" href={getAttachmentUrl(a.id, companyId)} target="_blank" rel="noreferrer">
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
