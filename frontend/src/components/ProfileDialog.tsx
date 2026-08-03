import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack } from "@mui/material";
import { api, getAvatarUrl } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../i18n";
import { AvatarPicker } from "./AvatarPicker";
import { PasswordField } from "./PasswordField";

export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [avatar, setAvatar] = useState<{ base64: string; mimeType: string } | null>(null);

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.put("/auth/profile", {
          fullName,
          password,
          phone,
          jobTitle,
          notes,
          ...(avatar ? { avatarBase64: avatar.base64, avatarMimeType: avatar.mimeType } : {}),
        })
      ).data,
    onSuccess: (updatedUser) => {
      setSession(token!, updatedUser);
      setPassword("");
      setAvatar(null);
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("edit_profile")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <AvatarPicker
            currentUrl={user?.id ? getAvatarUrl(user.id) : undefined}
            fallbackText={user?.fullName?.[0] ?? "?"}
            onPick={({ base64, mimeType }) => setAvatar({ base64, mimeType })}
          />
          <TextField label={t("full_name")} value={fullName} onChange={(e) => setFullName(e.target.value)} fullWidth />
          <TextField label="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
          <TextField label="Ruolo / posizione" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} fullWidth />
          <TextField label="Note" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} />
          <PasswordField
            label={t("new_password")}
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
