import { useEffect, useRef, useState } from "react";
import { Box, Typography, TextField, MenuItem } from "@mui/material";
import { GridFilterModel } from "@mui/x-data-grid";

export interface GridHeaderFilterOption {
  value: string;
  label: string;
}

// Sostituisce l'header standard della DataGrid (che nasconde il filtro dietro
// il menu a tre puntini) con etichetta + campo di ricerca sempre visibile,
// come nelle griglie stile DevExtreme. Il valore si sincronizza col
// filterModel controllato dalla pagina, con un piccolo debounce per non
// interrogare il server ad ogni tasto premuto.
export function GridHeaderFilter({
  field,
  label,
  filterModel,
  setFilterModel,
  options,
  operator = "contains",
}: {
  field: string;
  label: string;
  filterModel: GridFilterModel;
  setFilterModel: (model: GridFilterModel) => void;
  options?: GridHeaderFilterOption[];
  operator?: string;
}) {
  const existing = filterModel.items.find((i) => i.field === field);
  const [value, setValue] = useState(existing?.value ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(existing?.value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.value]);

  function commit(newValue: string) {
    setFilterModel({
      items: [...filterModel.items.filter((i) => i.field !== field), ...(newValue ? [{ field, operator, value: newValue, id: field }] : [])],
    });
  }

  function handleTextChange(newValue: string) {
    setValue(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commit(newValue), 400);
  }

  function handleSelectChange(newValue: string) {
    setValue(newValue);
    commit(newValue);
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, overflow: "hidden", pt: 0.4, pb: 0.2 }}>
      <Typography
        variant="caption"
        title={label}
        sx={{
          fontWeight: 700,
          display: "block",
          lineHeight: 1.3,
          mb: 0.2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </Typography>
      {options ? (
        <TextField
          select
          size="small"
          variant="standard"
          value={value}
          onChange={(e) => handleSelectChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          fullWidth
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">Tutti</MenuItem>
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField
          size="small"
          variant="standard"
          placeholder="Cerca..."
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          fullWidth
        />
      )}
    </Box>
  );
}
