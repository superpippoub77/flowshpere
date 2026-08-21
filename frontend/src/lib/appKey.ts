const KNOWN_APPS = ["workflow", "ticket", "timesheet", "crm", "notes"];

export function appKeyFromPath(pathname: string): string {
  const seg = pathname.replace(/^\/+/, "").split("/")[0];
  return KNOWN_APPS.includes(seg) ? seg : "_default";
}

// Per l'uso fuori da React (es. client.ts), legge il percorso corrente
// dall'hash dato che l'app usa HashRouter.
export function currentAppKeyFromLocation(): string {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  return appKeyFromPath(hash);
}
