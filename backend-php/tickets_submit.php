<?php
// Endpoint pubblico per aprire un ticket dall'esterno (nessuna sessione/login),
// con lo stesso meccanismo a token Bearer di orders.php.
//
//   POST /api/tickets_submit.php
//   Authorization: Bearer <token>
//   { "subject": "...", "description": "...", "priority": "ALTA",
//     "customerName": "...", "customerEmail": "..." }
//
// Se il token e' vincolato a un ramo (categoria), il ticket ci finisce dentro
// automaticamente e, se quel ramo ha un responsabile predefinito, gli viene
// assegnato subito.

require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/crypto.php';
require_once __DIR__ . '/includes/jwt.php';
require_once __DIR__ . '/includes/audit.php';
require_once __DIR__ . '/includes/tickets.php';

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
    error_response('Token mancante: usa l\'header Authorization: Bearer <token>', 401);
}
$token = trim($m[1]);

$payload = jwt_decode($token);
if (!$payload || ($payload['type'] ?? null) !== 'external_ticket') {
    error_response('Token non valido', 401);
}

$stmt = db()->prepare('SELECT * FROM api_tokens WHERE jti = ? AND company_id = ?');
$stmt->execute([$payload['jti'] ?? '', $payload['companyId'] ?? '']);
$apiToken = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$apiToken || $apiToken['revoked']) {
    error_response('Token non valido o revocato', 401);
}

$input = read_json_body();
require_fields($input, ['subject']);

$categoryId = $apiToken['category_id'] ?: ($input['categoryId'] ?? null);

$result = create_ticket($apiToken['company_id'], [
    'categoryId' => $categoryId,
    'subject' => $input['subject'],
    'description' => $input['description'] ?? '',
    'priority' => $input['priority'] ?? 'MEDIA',
    'customerName' => $input['customerName'] ?? null,
    'customerEmail' => $input['customerEmail'] ?? null,
]);

log_audit($apiToken['company_id'], null, null, 'Ticket ricevuto via API esterna (token "' . $apiToken['label'] . '")');
json_response($result, 201);
