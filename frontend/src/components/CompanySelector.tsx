import { useQueryClient } from "@tanstack/react-query";
import { TextField, MenuItem } from "@mui/material";
import { useAuthStore } from "../store/authStore";

export function CompanySelector({ appKey, sx }: { appKey: string; sx?: any }) {
  const queryClient = useQueryClient();
  const companies = useAuthStore((s) => s.companies);
  const getCurrentCompanyForApp = useAuthStore((s) => s.getCurrentCompanyForApp);
  const setCurrentCompanyForApp = useAuthStore((s) => s.setCurrentCompanyForApp);
  const currentCompanyId = getCurrentCompanyForApp(appKey);

  const list = companies.filter((c) => c.applications?.some((a) => a.key === appKey));

  if (list.length <= 1) return null;

  return (
    <TextField
      select
      size="small"
      label="Azienda"
      value={currentCompanyId ?? ""}
      onChange={(e) => {
        setCurrentCompanyForApp(appKey, e.target.value);
        // Il client API risolve l'azienda da localStorage, non dalla query key:
        // senza invalidare, le liste già in pagina non si accorgerebbero del cambio.
        queryClient.invalidateQueries();
      }}
      sx={{ minWidth: 220, ...sx }}
    >
      {list.map((c) => (
        <MenuItem key={c.id} value={c.id}>
          {c.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
