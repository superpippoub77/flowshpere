import { Box, Stack, Typography } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useStatusStore } from "../store/statusStore";
import { useI18n } from "../i18n";

export function StatusBar({ companyName, roleName }: { companyName?: string; roleName?: string }) {
  const { state, message } = useStatusStore();
  const { t } = useI18n();

  const label = message || (state === "saving" ? t("saving") : state === "saved" ? t("saved") : state === "error" ? t("save_error") : "");

  return (
    <Box
      sx={{
        height: 28,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 2,
        borderTop: "1px solid rgba(127,184,217,0.14)",
        fontSize: 11.5,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {state === "saving" && <CircularProgress size={11} />}
        {state === "saved" && <CheckCircleIcon sx={{ fontSize: 13 }} color="success" />}
        {state === "error" && <ErrorOutlineIcon sx={{ fontSize: 13 }} color="error" />}
        {label && (
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" className="mono">
        {companyName ? `${companyName}${roleName ? " · " + roleName : ""}` : ""}
      </Typography>
    </Box>
  );
}
