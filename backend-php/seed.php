<?php
// Esegui una sola volta da riga di comando (php seed.php) oppure una volta
// via browser dopo il deploy, poi rimuovi/rinomina questo file per sicurezza.

require_once __DIR__ . '/includes/db.php';

$pdo = db();
echo "Seeding...\n";

function upsert_application(PDO $pdo, string $key, string $name, bool $enabled): string
{
    $stmt = $pdo->prepare('SELECT id FROM applications WHERE app_key = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) return $row['id'];
    $id = new_id('app');
    $pdo->prepare('INSERT INTO applications (id, app_key, name, enabled) VALUES (?, ?, ?, ?)')->execute([$id, $key, $name, $enabled ? 1 : 0]);
    return $id;
}

$workflowAppId = upsert_application($pdo, 'workflow', 'Workflow Management', true);
upsert_application($pdo, 'timesheet', 'Timesheet Dipendenti', false);
upsert_application($pdo, 'ticket', 'Gestione Ticket', false);
upsert_application($pdo, 'crm', 'CRM', false);

// ---- Azienda demo ----
$stmt = $pdo->prepare('SELECT id FROM companies WHERE slug = ?');
$stmt->execute(['demo-spa']);
$company = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$company) {
    $companyId = new_id('co');
    $pdo->prepare('INSERT INTO companies (id, name, slug) VALUES (?, ?, ?)')->execute([$companyId, 'Demo S.p.A.', 'demo-spa']);
} else {
    $companyId = $company['id'];
}

// ---- Ruoli ----
$roleDefs = [
    ['ADMIN', 'Amministratore Aziendale'],
    ['SUPERVISOR', 'Supervisore'],
    ['OPERATOR', 'Operatore'],
];
$roleIds = [];
foreach ($roleDefs as [$key, $name]) {
    $stmt = $pdo->prepare('SELECT id FROM roles WHERE company_id = ? AND role_key = ?');
    $stmt->execute([$companyId, $key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) { $roleIds[$key] = $row['id']; continue; }
    $id = new_id('role');
    $pdo->prepare('INSERT INTO roles (id, company_id, role_key, name, is_system) VALUES (?, ?, ?, ?, 1)')->execute([$id, $companyId, $key, $name]);
    $roleIds[$key] = $id;
}

// ---- Utenti demo (password uguale per tutti, solo per demo locale) ----
$passwordHash = password_hash('password123', PASSWORD_DEFAULT);
$usersDef = [
    ['admin@demo.it', 'Anna Amministratore', 'ADMIN'],
    ['supervisore@demo.it', 'Sara Supervisore', 'SUPERVISOR'],
    ['operatore@demo.it', 'Omar Operatore', 'OPERATOR'],
];
foreach ($usersDef as [$email, $fullName, $roleKey]) {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $userId = $row['id'] ?? null;
    if (!$userId) {
        $userId = new_id('user');
        $pdo->prepare('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)')->execute([$userId, $email, $passwordHash, $fullName]);
    }

    $stmt = $pdo->prepare('SELECT id FROM user_companies WHERE user_id = ? AND company_id = ?');
    $stmt->execute([$userId, $companyId]);
    $ucRow = $stmt->fetch(PDO::FETCH_ASSOC);
    $ucId = $ucRow['id'] ?? null;
    if (!$ucId) {
        $ucId = new_id('uc');
        $pdo->prepare('INSERT INTO user_companies (id, user_id, company_id, role_id) VALUES (?, ?, ?, ?)')->execute([$ucId, $userId, $companyId, $roleIds[$roleKey]]);
    }

    $stmt = $pdo->prepare('SELECT id FROM user_company_applications WHERE user_company_id = ? AND application_id = ?');
    $stmt->execute([$ucId, $workflowAppId]);
    if (!$stmt->fetch()) {
        $pdo->prepare('INSERT INTO user_company_applications (id, user_company_id, application_id) VALUES (?, ?, ?)')->execute([new_id('uca'), $ucId, $workflowAppId]);
    }
}

// Super admin globale
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute(['superadmin@platform.it']);
if (!$stmt->fetch()) {
    $pdo->prepare('INSERT INTO users (id, email, password_hash, full_name, is_super_admin) VALUES (?, ?, ?, ?, 1)')
        ->execute([new_id('user'), 'superadmin@platform.it', $passwordHash, 'Super Admin']);
}

// ---- Workflow 1: Richiesta Acquisto ----
$stmt = $pdo->prepare('SELECT id FROM workflows WHERE company_id = ? AND name = ?');
$stmt->execute([$companyId, 'Richiesta Acquisto']);
if (!$stmt->fetch()) {
    $nodes1 = [
        ['id' => 'n1', 'type' => 'start', 'position' => ['x' => 0, 'y' => 0], 'data' => ['label' => 'Inizio Processo']],
        ['id' => 'n2', 'type' => 'form', 'position' => ['x' => 0, 'y' => 120], 'data' => ['label' => 'Richiesta Acquisto', 'config' => ['fields' => [
            ['id' => 'cliente', 'label' => 'Nome Cliente', 'type' => 'text'],
            ['id' => 'importo', 'label' => 'Importo', 'type' => 'valuta'],
            ['id' => 'descrizione', 'label' => 'Descrizione', 'type' => 'textarea'],
        ]]]],
        ['id' => 'n3', 'type' => 'autoDecision', 'position' => ['x' => 0, 'y' => 240], 'data' => ['label' => 'Importo > 1000€?', 'config' => ['rule' => ['field' => 'importo', 'operator' => 'gt', 'value' => 1000]]]],
        ['id' => 'n4', 'type' => 'approval', 'position' => ['x' => -150, 'y' => 360], 'data' => ['label' => 'Approvazione Responsabile']],
        ['id' => 'n5', 'type' => 'email', 'position' => ['x' => 0, 'y' => 480], 'data' => ['label' => 'Notifica esito', 'config' => ['template' => "La tua richiesta di acquisto e' stata elaborata."]]],
        ['id' => 'n6', 'type' => 'end', 'position' => ['x' => 0, 'y' => 600], 'data' => ['label' => 'Fine Processo']],
    ];
    $edges1 = [
        ['id' => 'e1', 'source' => 'n1', 'target' => 'n2'],
        ['id' => 'e2', 'source' => 'n2', 'target' => 'n3'],
        ['id' => 'e3', 'source' => 'n3', 'target' => 'n4', 'sourceHandle' => 'approve'],
        ['id' => 'e4', 'source' => 'n3', 'target' => 'n5', 'sourceHandle' => 'reject'],
        ['id' => 'e5', 'source' => 'n4', 'target' => 'n5', 'sourceHandle' => 'approve'],
        ['id' => 'e6', 'source' => 'n4', 'target' => 'n5', 'sourceHandle' => 'reject'],
        ['id' => 'e7', 'source' => 'n5', 'target' => 'n6'],
    ];
    $wfId = new_id('wf');
    $pdo->prepare('INSERT INTO workflows (id, company_id, name, description, status) VALUES (?, ?, ?, ?, "PUBLISHED")')
        ->execute([$wfId, $companyId, 'Richiesta Acquisto', "Approvazione automatica sotto 1000€, oltre richiede il responsabile."]);
    $pdo->prepare('INSERT INTO workflow_versions (id, workflow_id, version, nodes_json, edges_json, forms_json) VALUES (?, ?, 1, ?, ?, "{}")')
        ->execute([new_id('wfv'), $wfId, json_encode($nodes1, JSON_UNESCAPED_UNICODE), json_encode($edges1)]);
}

// ---- Workflow 2: Valutazione Fornitore con AI ----
$stmt = $pdo->prepare('SELECT id FROM workflows WHERE company_id = ? AND name = ?');
$stmt->execute([$companyId, 'Valutazione Fornitore con AI']);
if (!$stmt->fetch()) {
    $nodes2 = [
        ['id' => 'm1', 'type' => 'start', 'position' => ['x' => 0, 'y' => 0], 'data' => ['label' => 'Inizio Processo']],
        ['id' => 'm2', 'type' => 'form', 'position' => ['x' => 0, 'y' => 120], 'data' => ['label' => 'Dati Fornitore', 'config' => ['fields' => [
            ['id' => 'fornitore', 'label' => 'Nome Fornitore', 'type' => 'text'],
            ['id' => 'punteggio', 'label' => "Punteggio Affidabilita'", 'type' => 'numero'],
        ]]]],
        ['id' => 'm3', 'type' => 'ai', 'position' => ['x' => 0, 'y' => 240], 'data' => ['label' => 'Valutazione AI Fornitore']],
        ['id' => 'm4', 'type' => 'approval', 'position' => ['x' => -150, 'y' => 360], 'data' => ['label' => 'Revisione Responsabile Acquisti']],
        ['id' => 'm5', 'type' => 'end', 'position' => ['x' => 0, 'y' => 480], 'data' => ['label' => 'Fine Processo']],
    ];
    $edges2 = [
        ['id' => 'f1', 'source' => 'm1', 'target' => 'm2'],
        ['id' => 'f2', 'source' => 'm2', 'target' => 'm3'],
        ['id' => 'f3', 'source' => 'm3', 'target' => 'm5', 'sourceHandle' => 'approve'],
        ['id' => 'f4', 'source' => 'm3', 'target' => 'm4', 'sourceHandle' => 'reject'],
        ['id' => 'f5', 'source' => 'm4', 'target' => 'm5', 'sourceHandle' => 'approve'],
        ['id' => 'f6', 'source' => 'm4', 'target' => 'm5', 'sourceHandle' => 'reject'],
    ];
    $wfId2 = new_id('wf');
    $pdo->prepare('INSERT INTO workflows (id, company_id, name, description, status) VALUES (?, ?, ?, ?, "PUBLISHED")')
        ->execute([$wfId2, $companyId, 'Valutazione Fornitore con AI', "L'AI valuta il fornitore; sotto una certa confidenza interviene il responsabile."]);
    $pdo->prepare('INSERT INTO workflow_versions (id, workflow_id, version, nodes_json, edges_json, forms_json) VALUES (?, ?, 1, ?, ?, "{}")')
        ->execute([new_id('wfv'), $wfId2, json_encode($nodes2, JSON_UNESCAPED_UNICODE), json_encode($edges2)]);
}

echo "Seed completato.\n";
echo "Utenti demo (password: password123):\n";
foreach ($usersDef as [$email, , $roleKey]) echo " - $email ($roleKey)\n";
echo " - superadmin@platform.it (SUPER ADMIN)\n";
