import { useEffect, useState } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import { api } from "../api/client";

export function CustomerAutocomplete({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (name: string) => void;
  label: string;
}) {
  const [inputValue, setInputValue] = useState(value ?? "");
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInputValue(value ?? "");
  }, [value]);

  useEffect(() => {
    if (inputValue.trim().length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/customers/search", { query: inputValue });
        setOptions((res.data as { id: string; name: string }[]).map((c) => c.name));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [inputValue]);

  async function commit(name: string) {
    const trimmed = name.trim();
    onChange(trimmed);
    if (trimmed) {
      // Se non esiste gia' in anagrafica la aggiunge; se esiste, l'azione e' innocua (idempotente)
      try {
        await api.post("/customers", { name: trimmed });
      } catch {
        // non bloccante: il valore resta comunque impostato sul form
      }
    }
  }

  return (
    <Autocomplete
      freeSolo
      options={options}
      inputValue={inputValue}
      loading={loading}
      onInputChange={(_, newValue) => {
        setInputValue(newValue);
        onChange(newValue);
      }}
      onChange={(_, newValue) => {
        if (newValue) commit(newValue);
      }}
      onBlur={() => commit(inputValue)}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          fullWidth
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={14} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
