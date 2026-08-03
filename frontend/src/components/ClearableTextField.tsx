import { TextField, IconButton, InputAdornment, TextFieldProps } from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";

export function ClearableTextField(props: TextFieldProps & { onClear?: () => void }) {
  const { onClear, ...rest } = props;
  const hasValue = !!props.value && String(props.value).length > 0;

  return (
    <TextField
      {...rest}
      InputProps={{
        ...rest.InputProps,
        endAdornment: hasValue ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              tabIndex={-1}
              onClick={() => {
                if (onClear) onClear();
                else (props.onChange as any)?.({ target: { value: "" } });
              }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : (
          rest.InputProps?.endAdornment
        ),
      }}
    />
  );
}
