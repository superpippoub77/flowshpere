<?php
// Endpoint pensato per essere chiamato da sistemi ESTERNI (non dal browser
// con sessione): autenticazione tramite token JWT (Authorization: Bearer ...)
// generato da un Amministratore in Amministrazione > Token API.
//
// Esempio di chiamata:
//   POST /api/orders.php
//   Authorization: Bearer <token>
//   Content-Type: application/json
//   { "workflowId": "wf_...", "data": { "cliente": "ACME", "importo": 500 } }
//
// Se il token e' gia' collegato a un workflow specifico, "workflowId" e'
// opzionale (si usa comunque quello del token). In alternativa a
// "workflowId" si puo' indicare "workflowName" (nome esatto del workflow).

require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/crypto.php';
require_once __DIR__ . '/includes/jwt.php';
require_once __DIR__ . '/includes/audit.php';
require_once __DIR__ . '/includes/engine.php';

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
    error_response('Token mancante: usa l\'header Authorization: Bearer <token>', 401);
}
$token = trim($m[1]);

$payload = jwt_decode($token);
if (!$payload || ($payload['type'] ?? null) !== 'external_order') {
    error_response('Token non valido', 401);
}

$stmt = db()->prepare('SELECT * FROM api_tokens WHERE jti = ? AND company_id = ?');
$stmt->execute([$payload['jti'] ?? '', $payload['companyId'] ?? '']);
$apiToken = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$apiToken || $apiToken['revoked']) {
    error_response('Token non valido o revocato', 401);
}

$input = read_json_body();
$companyId = $apiToken['company_id'];

$workflowId = $apiToken['workflow_id'];
if (!$workflowId) {
    if (!empty($input['workflowId'])) {
        $workflowId = $input['workflowId'];
    } elseif (!empty($_GET['workflowId'])) {
        $workflowId = $_GET['workflowId'];
    } elseif (!empty($input['workflowName'])) {
        $wStmt = db()->prepare('SELECT id FROM workflows WHERE company_id = ? AND name = ? AND status = "PUBLISHED"');
        $wStmt->execute([$companyId, $input['workflowName']]);
        $w = $wStmt->fetch(PDO::FETCH_ASSOC);
        if (!$w) error_response('Workflow non trovato: "' . $input['workflowName'] . '"', 404);
        $workflowId = $w['id'];
    } elseif ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        error_response('Specifica workflowId o workflowName (questo token non e\' vincolato a un workflow specifico)', 400);
    }
} elseif (!empty($input['workflowId']) && $input['workflowId'] !== $workflowId) {
    error_response('Questo token puo\' essere usato solo per un workflow specifico', 403);
}

// Richiesta GET: restituisce solo i campi del primo form del workflow, cosi'
// un form pubblico (senza account) sa cosa mostrare, senza creare nulla.
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!$workflowId) error_response('Specifica ?workflowId= (questo token non e\' vincolato a un workflow specifico)', 400);
    $wStmt = db()->prepare('SELECT * FROM workflows WHERE id = ? AND company_id = ? AND status = "PUBLISHED"');
    $wStmt->execute([$workflowId, $companyId]);
    $w = $wStmt->fetch(PDO::FETCH_ASSOC);
    if (!$w) error_response('Workflow pubblicato non trovato', 404);

    $vStmt = db()->prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC LIMIT 1');
    $vStmt->execute([$w['id']]);
    $version = $vStmt->fetch(PDO::FETCH_ASSOC);
    $nodes = $version ? json_decode($version['nodes_json'], true) : [];
    $formNode = null;
    foreach ($nodes as $n) { if ($n['type'] === 'form') { $formNode = $n; break; } }

    json_response([
        'workflowName' => $w['name'],
        'fields' => $formNode['data']['config']['fields'] ?? [],
    ]);
}

$result = create_instance($companyId, $workflowId, $apiToken['created_by_id'], $input['data'] ?? []);
if (isset($result['error'])) error_response($result['error'], 404);

log_audit($companyId, null, $result['id'], 'Ordine ricevuto via API esterna (token "' . $apiToken['label'] . '")');
json_response($result, 201);
