<?php
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/settings.php';

// Invia un'email a ciascun responsabile (reale, esclude "AI") del passo
// attualmente attivo di un'istanza, con un link diretto a quel punto esatto
// del workflow. Non blocca mai il chiamante: eventuali errori di invio
// vengono solo registrati nell'audit log.
function notify_current_node_responsible(string $companyId, array $instance, ?string $eventLabel = null): void
{
    if (empty($instance['current_node_id'])) return;

    $vStmt = db()->prepare('SELECT nodes_json FROM workflow_versions WHERE id = ?');
    $vStmt->execute([$instance['workflow_version_id']]);
    $version = $vStmt->fetch(PDO::FETCH_ASSOC);
    if (!$version) return;

    $nodes = json_decode($version['nodes_json'], true) ?: [];
    $node = null;
    foreach ($nodes as $n) { if ($n['id'] === $instance['current_node_id']) { $node = $n; break; } }
    if (!$node) return;

    $responsibleIds = $node['data']['config']['responsibleUserIds'] ?? [];
    $realIds = array_filter($responsibleIds, fn($id) => $id !== 'AI');
    if (empty($realIds)) return; // "Tutti" o solo AI: nessun destinatario specifico da avvisare

    $baseUrl = get_setting('app_base_url', '');
    $link = $baseUrl ? $baseUrl . '/#/workflow/instances?openInstance=' . $instance['id'] . '&openNode=' . $node['id'] : null;

    $placeholders = implode(',', array_fill(0, count($realIds), '?'));
    $stmt = db()->prepare("SELECT id, email, full_name FROM users WHERE id IN ($placeholders)");
    $stmt->execute(array_values($realIds));

    $label = $node['data']['label'] ?? 'un passo del workflow';
    $subject = 'Azione richiesta: "' . $label . '" — ' . $instance['code'];

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
        if (empty($u['email'])) continue;
        $body = "Ciao " . $u['full_name'] . ",\n\n"
            . ($eventLabel ? $eventLabel . "\n\n" : "")
            . "Il passo \"" . $label . "\" dell'istanza " . $instance['code'] . " e' ora in attesa della tua azione.\n"
            . ($link ? "\nApri direttamente questo passo:\n" . $link . "\n" : "")
            . "\nSe il link non funziona, accedi normalmente e cerca l'istanza " . $instance['code'] . ".";
        $result = send_mail($u['email'], $subject, $body);
        if (!$result['simulated'] && !$result['sent']) {
            log_audit($companyId, null, $instance['id'], 'Notifica email non inviata a ' . $u['email'] . ' (' . $result['error'] . ')');
        }
    }
}
