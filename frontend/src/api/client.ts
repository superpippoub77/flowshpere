import { useAuthStore } from "../store/authStore";

// Il backend e' ora un unico endpoint PHP (api.php) che riceve
// { action, ...payload } e risponde in JSON. Questo modulo espone
// una interfaccia identica a quella di axios (get/post/put che
// ritornano { data }) cosi' le pagine non hanno dovuto cambiare:
// solo qui si traduce l'URL "REST" nell'azione corrispondente.

// L'endpoint si calcola dalla posizione corrente della pagina, non da un
// percorso scritto a mano: siccome il routing usa gli hash (#/...), il
// percorso fisico della pagina resta sempre la cartella di deploy, quindi
// funziona automaticamente sia in locale sia ovunque venga depositato il
// progetto sul server, senza bisogno di configurare nulla a build time.
function computeApiEndpoint(): string {
  let path = window.location.pathname;
  if (!path.endsWith("/")) path = path.substring(0, path.lastIndexOf("/") + 1);
  return `${path}api/api.php`;
}

const ENDPOINT = computeApiEndpoint();

export function getAttachmentUrl(attachmentId: string, companyId: string): string {
  let path = window.location.pathname;
  if (!path.endsWith("/")) path = path.substring(0, path.lastIndexOf("/") + 1);
  return `${path}api/download.php?id=${encodeURIComponent(attachmentId)}&companyId=${encodeURIComponent(companyId)}`;
}

export function getAvatarUrl(userId: string): string {
  let path = window.location.pathname;
  if (!path.endsWith("/")) path = path.substring(0, path.lastIndexOf("/") + 1);
  return `${path}api/avatar.php?userId=${encodeURIComponent(userId)}`;
}

export class ApiError extends Error {
  response: { status: number; data: any };
  constructor(status: number, data: any) {
    super(data?.error ?? "Errore");
    this.response = { status, data };
  }
}

type Mapping = { pattern: RegExp; action: string; extract?: (m: RegExpMatchArray) => Record<string, string> };

const MAPPINGS: Mapping[] = [
  { pattern: /^\/auth\/login$/, action: "auth.login" },
  { pattern: /^\/auth\/me\/companies$/, action: "auth.meCompanies" },
  { pattern: /^\/auth\/profile$/, action: "auth.updateProfile" },
  { pattern: /^\/search$/, action: "search.global" },

  { pattern: /^\/workflows$/, action: "__workflows_list_or_create__" },
  { pattern: /^\/workflows\/([^/]+)$/, action: "workflows.get", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/workflows\/([^/]+)\/draft$/, action: "workflows.saveDraft", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/workflows\/([^/]+)\/publish$/, action: "workflows.publish", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/workflows\/([^/]+)\/company$/, action: "workflows.updateCompany", extract: (m) => ({ id: m[1] }) },

  { pattern: /^\/instances$/, action: "__instances_list_or_create__" },
  { pattern: /^\/instances\/([^/]+)$/, action: "instances.get", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/instances\/([^/]+)\/tasks\/([^/]+)\/form$/, action: "instances.formSubmit", extract: (m) => ({ instanceId: m[1], taskId: m[2] }) },
  { pattern: /^\/instances\/([^/]+)\/tasks\/([^/]+)\/decision$/, action: "instances.decision", extract: (m) => ({ instanceId: m[1], taskId: m[2] }) },
  { pattern: /^\/instances\/([^/]+)\/tasks\/([^/]+)\/complete$/, action: "instances.complete", extract: (m) => ({ instanceId: m[1], taskId: m[2] }) },
  { pattern: /^\/instances\/([^/]+)\/comments$/, action: "instances.comment", extract: (m) => ({ instanceId: m[1] }) },

  { pattern: /^\/instances\/([^/]+)\/attachments$/, action: "instances.attachments.upload", extract: (m) => ({ instanceId: m[1] }) },
  { pattern: /^\/dashboard\/kpi$/, action: "dashboard.kpi" },
  { pattern: /^\/companies\/users$/, action: "companies.users" },
  { pattern: /^\/node-templates$/, action: "__node_templates_list_or_create__" },
  { pattern: /^\/node-templates\/([^/]+)$/, action: "nodeTemplates.delete", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/api-tokens$/, action: "__api_tokens_list_or_create__" },
  { pattern: /^\/api-tokens\/([^/]+)\/revoke$/, action: "apiTokens.revoke", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/api-tokens\/([^/]+)\/delete$/, action: "apiTokens.delete", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/customers\/search$/, action: "customers.search" },
  { pattern: /^\/customers$/, action: "customers.create" },

  { pattern: /^\/tickets$/, action: "__tickets_list_or_create__" },
  { pattern: /^\/tickets\/([^/]+)$/, action: "tickets.get", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/tickets\/([^/]+)\/status$/, action: "tickets.updateStatus", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/tickets\/([^/]+)\/assign$/, action: "tickets.assign", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/tickets\/([^/]+)\/comments$/, action: "tickets.comment", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/ticket-categories$/, action: "__ticket_categories_list_or_create__" },
  { pattern: /^\/ticket-categories\/([^/]+)$/, action: "ticketCategories.update", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/ticket-categories\/([^/]+)\/delete$/, action: "ticketCategories.delete", extract: (m) => ({ id: m[1] }) },

  { pattern: /^\/admin\/users$/, action: "__admin_users_list_or_create__" },
  { pattern: /^\/admin\/users\/([^/]+)\/delete$/, action: "admin.users.delete", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/admin\/users\/([^/]+)$/, action: "admin.users.update", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/admin\/companies$/, action: "__admin_companies_list_or_create__" },
  { pattern: /^\/admin\/companies\/([^/]+)\/delete$/, action: "admin.companies.delete", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/admin\/companies\/([^/]+)$/, action: "admin.companies.update", extract: (m) => ({ id: m[1] }) },
  { pattern: /^\/admin\/applications$/, action: "admin.applications.list" },
  { pattern: /^\/admin\/permissions$/, action: "__admin_permissions_get_or_set__" },
  { pattern: /^\/admin\/permissions\/revoke$/, action: "admin.permissions.revoke" },
];

function resolveAction(method: "get" | "post" | "put", url: string): string {
  for (const m of MAPPINGS) {
    const match = url.match(m.pattern);
    if (!match) continue;
    if (m.action === "__workflows_list_or_create__") return method === "get" ? "workflows.list" : "workflows.create";
    if (m.action === "__instances_list_or_create__") return method === "get" ? "instances.list" : "instances.create";
    if (m.action === "__admin_users_list_or_create__") return method === "get" ? "admin.users.list" : "admin.users.create";
    if (m.action === "__admin_permissions_get_or_set__") return method === "get" ? "admin.permissions.get" : "admin.permissions.set";
    if (m.action === "__admin_companies_list_or_create__") return method === "get" ? "admin.companies.list" : "admin.companies.create";
    if (m.action === "__node_templates_list_or_create__") return method === "get" ? "nodeTemplates.list" : "nodeTemplates.create";
    if (m.action === "__api_tokens_list_or_create__") return method === "get" ? "apiTokens.list" : "apiTokens.create";
    if (m.action === "__tickets_list_or_create__") return method === "get" ? "tickets.list" : "tickets.create";
    if (m.action === "__ticket_categories_list_or_create__") return method === "get" ? "ticketCategories.list" : "ticketCategories.create";
    return m.action;
  }
  throw new Error(`Nessuna azione API mappata per ${method.toUpperCase()} ${url}`);
}

function resolveParams(url: string): Record<string, string> {
  for (const m of MAPPINGS) {
    const match = url.match(m.pattern);
    if (match && m.extract) return m.extract(match);
  }
  return {};
}

async function call(method: "get" | "post" | "put", url: string, body?: any) {
  const action = resolveAction(method, url);
  const params = resolveParams(url);
  const { currentCompanyId } = useAuthStore.getState();

  const payload = {
    action,
    ...(currentCompanyId ? { companyId: currentCompanyId } : {}),
    ...params,
    ...(body ?? {}),
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) useAuthStore.getState().logout();
    throw new ApiError(res.status, data);
  }

  return { data };
}

export const api = {
  get: (url: string, params?: any) => call("get", url, params),
  post: (url: string, body?: any) => call("post", url, body),
  put: (url: string, body?: any) => call("put", url, body),
};
