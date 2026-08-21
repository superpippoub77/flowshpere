import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Typography, TextField, Button, Paper, Divider, Chip, CircularProgress } from "@mui/material";
import ReactMarkdown from "react-markdown";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api } from "../../api/client";
import { useStatusStore } from "../../store/statusStore";

// Trasforma i [[Titolo]] in link markdown riconoscibili (schema "wikilink:"),
// cosi' il renderer sottostante puo' intercettarli e aprirli senza uscire
// dall'app (esattamente come i link interni di Obsidian).
function toRenderableMarkdown(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_match, title) => `[${title}](wikilink:${encodeURIComponent(title)})`);
}

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

  const { data: graph } = useQuery({
    queryKey: ["notes-graph"],
    queryFn: async () => (await api.get("/notes/graph")).data,
  });
  const titleToId: Record<string, string> = {};
  (graph?.nodes ?? []).forEach((n: any) => {
    titleToId[n.title.toLowerCase()] = n.id;
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

  function handleWikilinkClick(rawHref: string) {
    const title = decodeURIComponent(rawHref.replace(/^wikilink:/, ""));
    const targetId = titleToId[title.toLowerCase()];
    if (targetId) navigate(`/notes/${targetId}`);
  }

  if (!note) {
    return (
      <Box sx={{ p: 3, display: "grid", placeItems: "center", height: "100%" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
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

      <Stack direction="row" spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        <Paper sx={{ flex: 1, p: 2, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Typography variant="overline" color="text.secondary" sx={{ mb: 1 }}>
            Markdown — usa [[Titolo]] per collegare un'altra nota
          </Typography>
          <TextField
            value={content}
            onChange={(e) => setContent(e.target.value)}
            multiline
            fullWidth
            variant="outlined"
            placeholder="Scrivi qui... **grassetto**, *corsivo*, [[Altra nota]], [link](https://...)"
            sx={{ flex: 1, "& .MuiInputBase-root": { height: "100%", alignItems: "flex-start" }, "& textarea": { height: "100% !important", overflow: "auto !important" } }}
          />
        </Paper>

        <Paper sx={{ flex: 1, p: 2, overflow: "auto", minHeight: 0 }}>
          <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: "block" }}>
            Anteprima
          </Typography>
          <Box
            sx={{
              "& p": { m: 0, mb: 1 },
              "& ul, & ol": { mt: 0, mb: 1 },
              "& a[href^='wikilink:']": { color: "secondary.main", fontWeight: 600, textDecoration: "none", borderBottom: "1px dashed", cursor: "pointer" },
            }}
          >
            <ReactMarkdown
              components={{
                a: ({ href, children }) => {
                  if (href?.startsWith("wikilink:")) {
                    return (
                      <a href="#" onClick={(e) => { e.preventDefault(); handleWikilinkClick(href); }}>
                        {children}
                      </a>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noreferrer">
                      {children}
                    </a>
                  );
                },
              }}
            >
              {toRenderableMarkdown(content)}
            </ReactMarkdown>
          </Box>
        </Paper>
      </Stack>

      {note.backlinks?.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Divider sx={{ mb: 1.5 }} />
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
