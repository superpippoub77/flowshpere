<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/crypto.php';
require_once __DIR__ . '/audit.php';

// Crea un nuovo ticket. $data puo' includere: categoryId, subject, description,
// priority, createdById (utente interno) oppure customerName/customerEmail
// (invio esterno via API pubblica, senza account).
function create_ticket(string $companyId, array $data): array
{
    $cStmt = db()->prepare('SELECT COUNT(*) as c FROM tickets WHERE company_id = ?');
    $cStmt->execute([$companyId]);
    $count = (int) $cStmt->fetch(PDO::FETCH_ASSOC)['c'];
    $code = 'Ticket #' . (2000 + $count + 1);

    $category = null;
    if (!empty($data['categoryId'])) {
        $catStmt = db()->prepare('SELECT * FROM ticket_categories WHERE id = ? AND company_id = ?');
        $catStmt->execute([$data['categoryId'], $companyId]);
        $category = $catStmt->fetch(PDO::FETCH_ASSOC);
    }
    $assignedToId = $category['default_assignee_id'] ?? null;

    $id = new_id('tkt');
    db()->prepare('
        INSERT INTO tickets (id, company_id, category_id, code, subject, description, priority, customer_name, customer_email, created_by_id, assigned_to_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $id, $companyId, $data['categoryId'] ?? null, $code, $data['subject'],
        encrypt_data($data['description'] ?? ''), $data['priority'] ?? 'MEDIA',
        $data['customerName'] ?? null, $data['customerEmail'] ?? null,
        $data['createdById'] ?? null, $assignedToId,
    ]);

    log_audit($companyId, $data['createdById'] ?? null, null, 'Ticket creato: "' . $code . '" — ' . $data['subject']);
    return ['id' => $id, 'code' => $code];
}
