<?php
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/tenant.php';

start_session();
$user = current_user();

$attachmentId = $_GET['id'] ?? '';
$companyId = $_GET['companyId'] ?? '';
if (!$attachmentId || !$companyId) error_response('Parametri mancanti', 400);

$ctx = require_company($user, $companyId);

$stmt = db()->prepare('
    SELECT a.* FROM attachments a
    JOIN workflow_instances wi ON wi.id = a.instance_id
    JOIN workflows w ON w.id = wi.workflow_id
    WHERE a.id = ? AND w.company_id = ?
');
$stmt->execute([$attachmentId, $companyId]);
$attachment = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$attachment) error_response('Allegato non trovato', 404);

// Stesso controllo di lettura usato per lo storico dello step
if ($attachment['node_id']) {
    $node = find_node_in_instance($attachment['instance_id'], $attachment['node_id']);
    if ($node && !can_read_node($node, $user['id'], $ctx['roleKey'])) {
        error_response('Non hai i permessi di lettura per questo passaggio', 403);
    }
}

$path = __DIR__ . '/data/attachments/' . $attachment['stored_name'];
if (!file_exists($path)) error_response('File non trovato sul server', 404);

header('Content-Type: ' . $attachment['mime_type']);
header('Content-Length: ' . $attachment['size']);
header('Content-Disposition: inline; filename="' . basename($attachment['file_name']) . '"');
readfile($path);
exit;
