import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, InputBase, Paper, List, ListItemButton, ListItemText, Chip, ClickAwayListener } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { api } from "../api/client";
import { useI18n } from "../i18n";

const TYPE_LABEL: Record<string, string> = {
  workflow: "Workflow",
  instance: "Istanza",
  user: "Utente",
  company: "Azienda",
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: async () => (await api.get("/search", { query: debounced })).data,
    enabled: debounced.length >= 2,
  });

  const results = debounced.length >= 2 ? data ?? [] : [];

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: "relative", width: 340 }}>
        <Paper sx={{ display: "flex", alignItems: "center", px: 1.2, py: 0.4 }}>
          <SearchIcon fontSize="small" sx={{ color: "text.secondary", mr: 1 }} />
          <InputBase
            placeholder={t("search_placeholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            fullWidth
            sx={{ fontSize: 14 }}
          />
        </Paper>

        {open && debounced.length >= 2 && (
          <Paper sx={{ position: "absolute", top: "100%", left: 0, right: 0, mt: 0.5, zIndex: 20, maxHeight: 360, overflowY: "auto" }}>
            <List dense>
              {results.map((r: any) => (
                <ListItemButton
                  key={`${r.type}-${r.id}`}
                  onClick={() => {
                    navigate(r.link);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <ListItemText primary={r.label} secondary={r.subtitle} />
                  <Chip size="small" label={TYPE_LABEL[r.type] ?? r.type} />
                </ListItemButton>
              ))}
              {results.length === 0 && (
                <ListItemButton disabled>
                  <ListItemText primary={t("search_no_results")} />
                </ListItemButton>
              )}
            </List>
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  );
}
