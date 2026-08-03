import { useState } from "react";
import { TextField, IconButton, InputAdornment, TextFieldProps, Stack } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOffOutlined";
import ClearIcon from "@mui/icons-material/Clear";

export function PasswordField(props: Omit<TextFieldProps, "type">) {
  const [visible, setVisible] = useState(false);
  const hasValue = !!props.value && String(props.value).length > 0;

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      InputProps={{
        ...props.InputProps,
        endAdornment: (
          <InputAdornment position="end">
            <Stack direction="row" spacing={0}>
              {hasValue && (
                <IconButton
                  size="small"
                  tabIndex={-1}
                  onClick={() => (props.onChange as any)?.({ target: { value: "" } })}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              )}
              <IconButton size="small" onClick={() => setVisible((v) => !v)} edge="end" tabIndex={-1}>
                {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </IconButton>
            </Stack>
          </InputAdornment>
        ),
      }}
    />
  );
}
