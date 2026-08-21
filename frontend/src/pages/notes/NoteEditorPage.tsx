import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Typography, TextField, Button, Paper, Divider, Chip, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api } from "../../api/client";
import { useStatusStore } from "../../store/statusStore";
import { RichTextEditor } from "../workflow/RichTextEditor";

export function NoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setStatus = useStatusStore((s) => s.set);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: note } = useQuery({
    queryKey: ["note", id],
    queryFn: async () => (await api.get(`/notes/${id}`)).data,
    enabled: !!id,
  });

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content ?? "");
    }
  }, [note]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setStatus("saving", "Salvataggio nota...");
      return api.put(`/notes/${id}`, { title, content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", id] });
      queryClient.invalidateQueries({ queryKey: ["notes-table"] });
      queryClient.invalidateQueries({ queryKey: ["notes-graph"] });
      setStatus("saved", "Nota salvata");
    },
    onError: () => setStatus("error", "Errore nel salvataggio della nota"),
  });

  if (!note) {
    return (
      <Box sx={{ p: 3, display: "grid", placeItems: "center", height: "100%" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", overflow: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/notes/list")}>
          Tutte le note
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          startIcon={saveMutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          Salva
        </Button>
      </Stack>

      <TextField
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        variant="standard"
        placeholder="Titolo della nota"
        InputProps={{ sx: { fontSize: 26, fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600 } }}
        sx={{ mb: 2 }}
      />

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
        Scrivi [[Titolo]] per collegare un'altra nota — se non esiste ancora, viene creata da sola al salvataggio. I
        collegamenti compaiono qui sotto dopo aver salvato.
      </Typography>

      <Paper sx={{ p: 2 }}>
        <RichTextEditor key={`note-${id}`} value={content} onChange={setContent} placeholder="Scrivi qui il contenuto della nota..." />
      </Paper>

      {(note.outgoingLinks?.length > 0 || note.backlinks?.length > 0) && <Divider sx={{ my: 2 }} />}

      {note.outgoingLinks?.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Collegamenti in uscita ({note.outgoingLinks.length})
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
            {note.outgoingLinks.map((l: any) => (
              <Chip key={l.id} label={l.title} onClick={() => navigate(`/notes/${l.id}`)} sx={{ cursor: "pointer" }} />
            ))}
          </Stack>
        </Box>
      )}

      {note.backlinks?.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            Collegamenti in entrata ({note.backlinks.length})
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
            {note.backlinks.map((b: any) => (
              <Chip key={b.id} label={b.title} onClick={() => navigate(`/notes/${b.id}`)} sx={{ cursor: "pointer" }} />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
