<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

// Ritorna ['companyId' => ..., 'roleKey' => ...] oppure termina con 403
function require_company(array $user, ?string $companyId): array
{
    if (!$companyId) error_response('Azienda non specificata', 400);

    if ($user['is_super_admin']) {
        return ['companyId' => $companyId, 'roleKey' => 'SUPER_ADMIN'];
    }

    // Il ruolo e' specifico per applicazione: lo stesso utente puo' avere un
    // ruolo diverso per Workflow rispetto ad altre app future, anche nella
    // stessa azienda.
    $stmt = db()->prepare("
        SELECT r.role_key FROM user_companies uc
        JOIN user_company_applications uca ON uca.user_company_id = uc.id
        JOIN applications a ON a.id = uca.application_id AND a.app_key = 'workflow'
        JOIN roles r ON r.id = uca.role_id
        WHERE uc.user_id = ? AND uc.company_id = ?
    ");
    $stmt->execute([$user['id'], $companyId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) error_response('Nessun accesso a questa azienda', 403);

    return ['companyId' => $companyId, 'roleKey' => $row['role_key']];
}

function require_super_admin(array $user): void
{
    if (!$user['is_super_admin']) error_response('Riservato al Super Amministratore', 403);
}

// Verifica se l'utente puo' LEGGERE i dettagli di un determinato step
// (storico, commenti associati). Se non ci sono lettori specifici assegnati,
// chiunque abbia accesso all'azienda puo' leggere (comportamento di base).
function can_read_node(array $node, string $userId, string $roleKey): bool
{
    if ($roleKey === 'SUPERVISOR' || $roleKey === 'SUPER_ADMIN' || $roleKey === 'ADMIN') return true;

    $readerIds = $node['data']['config']['readerUserIds'] ?? [];
    if (empty($readerIds)) return true;

    $responsibleIds = $node['data']['config']['responsibleUserIds'] ?? [];
    return in_array($userId, $readerIds, true) || in_array($userId, $responsibleIds, true);
}

function require_role(string $roleKey, array $allowed): void
{
    if ($roleKey === 'SUPER_ADMIN' || in_array($roleKey, $allowed, true)) return;
    error_response('Permessi insufficienti per questa azione', 403);
}

// Verifica se l'utente puo' agire su un determinato step del workflow.
// Il Supervisore (e il Super Amministratore) possono sempre agire su tutto.
// Se il nodo ha responsabili assegnati, solo loro possono agire. Se non ne
// ha: sui passi di raccolta dati (form/upload) puo' agire anche chi ha
// creato l'istanza, sui passi di decisione (approvazione/AI) serve ADMIN.
function can_act_on_node(array $node, string $userId, string $roleKey, ?string $creatorId = null): bool
{
    if ($roleKey === 'SUPERVISOR' || $roleKey === 'SUPER_ADMIN') return true;

    $responsibleIds = $node['data']['config']['responsibleUserIds'] ?? [];
    if (!empty($responsibleIds)) {
        return in_array($userId, $responsibleIds, true);
    }

    if (in_array($node['type'], ['form', 'upload'], true)) {
        return $roleKey === 'ADMIN' || ($creatorId !== null && $userId === $creatorId);
    }
    return $roleKey === 'ADMIN';
}
