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

    $stmt = db()->prepare('
        SELECT r.role_key FROM user_companies uc
        JOIN roles r ON r.id = uc.role_id
        WHERE uc.user_id = ? AND uc.company_id = ?
    ');
    $stmt->execute([$user['id'], $companyId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) error_response('Nessun accesso a questa azienda', 403);

    return ['companyId' => $companyId, 'roleKey' => $row['role_key']];
}

function require_role(string $roleKey, array $allowed): void
{
    if ($roleKey === 'SUPER_ADMIN' || in_array($roleKey, $allowed, true)) return;
    error_response('Permessi insufficienti per questa azione', 403);
}
