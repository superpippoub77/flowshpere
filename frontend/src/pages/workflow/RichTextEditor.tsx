import { useEffect, useRef } from "react";
import { Box, Stack, IconButton, Tooltip } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";

// Nota: passare una prop "key" diversa dal componente chiamante quando si
// vuole resettare il contenuto (es. cambio di passo) - il div non e'
// pienamente "controllato" apposta, per evitare il classico bug del cursore
// che salta all'inizio nei contentEditable React ad ogni carattere digitato.
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(command: string) {
    document.execCommand(command);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  }

  return (
    <Box sx={{ border: "1px solid rgba(127,184,217,0.3)", borderRadius: 1 }}>
      <Stack direction="row" spacing={0.5} sx={{ borderBottom: "1px solid rgba(127,184,217,0.2)", px: 0.5, py: 0.3 }}>
        <Tooltip title="Grassetto">
          <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
            <FormatBoldIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Corsivo">
          <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>
            <FormatItalicIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Elenco puntato">
          <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>
            <FormatListBulletedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        data-placeholder={placeholder}
        sx={{
          minHeight: 70,
          p: 1,
          fontSize: 14,
          outline: "none",
          "&:empty:before": { content: "attr(data-placeholder)", color: "text.secondary" },
        }}
      />
    </Box>
  );
}
