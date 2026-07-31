import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack } from "@mui/material";
import { api } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../i18n";

export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: async () => (await api.put("/auth/profile", { fullName, password })).data,
    onSuccess: (updatedUser) => {
      setSession(token!, updatedUser);
      setPassword("");
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("edit_profile")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label={t("full_name")} value={fullName} onChange={(e) => setFullName(e.target.value)} fullWidth />
          <TextField
            label={t("new_password")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button variant="contained" disabled={!fullName || mutation.isPending} onClick={() => mutation.mutate()}>
          {t("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
