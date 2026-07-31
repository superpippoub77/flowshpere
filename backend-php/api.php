<?php
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/tenant.php';
require_once __DIR__ . '/includes/audit.php';
require_once __DIR__ . '/includes/engine.php';

start_session();

$input = read_json_body();
$action = $input['action'] ?? ($_GET['action'] ?? '');
if (!$action) error_response('Azione non specificata', 400);

// Azioni pubbliche (non richiedono sessione attiva)
$public = ['auth.login'];

if (!in_array($action, $public, true)) {
    $user = current_user();
}

switch ($action) {

    // ---------------- AUTH ----------------

    case 'auth.login':
        require_fields($input, ['email', 'password']);
        $u = login_user($input['email'], $input['password']);
        json_response(['token' => $u['id'], 'user' => $u]);
        break;

    case 'auth.meCompanies':
        if ($user['is_super_admin']) {
            $companies = db()->query('SELECT * FROM companies ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);
            $apps = db()->query('SELECT * FROM applications WHERE enabled = 1')->fetchAll(PDO::FETCH_ASSOC);
            $appList = array_map(fn($a) => ['key' => $a['app_key'], 'name' => $a['name']], $apps);
            json_response(array_map(fn($c) => [
                'id' => $c['id'], 'name' => $c['name'], 'role' => 'Super Amministratore', 'roleKey' => 'SUPER_ADMIN', 'applications' => $appList,
            ], $companies));
        }

        $stmt = db()->prepare('
            SELECT uc.id as uc_id, c.id as c_id, c.name as c_name, r.name as r_name, r.role_key as r_key
            FROM user_companies uc
            JOIN companies c ON c.id = uc.company_id
            JOIN roles r ON r.id = uc.role_id
            WHERE uc.user_id = ?
        ');
        $stmt->execute([$user['id']]);
        $memberships = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($memberships as $m) {
            $appsStmt = db()->prepare('
                SELECT a.app_key, a.name FROM user_company_applications uca
                JOIN applications a ON a.id = uca.application_id
                WHERE uca.user_company_id = ? AND a.enabled = 1
            ');
            $appsStmt->execute([$m['uc_id']]);
            $apps = $appsStmt->fetchAll(PDO::FETCH_ASSOC);
            $result[] = [
                'id' => $m['c_id'],
                'name' => $m['c_name'],
                'role' => $m['r_name'],
                'roleKey' => $m['r_key'],
                'applications' => array_map(fn($a) => ['key' => $a['app_key'], 'name' => $a['name']], $apps),
            ];
        }
        json_response($result);
        break;

    // ---------------- WORKFLOWS ----------------

    case 'workflows.list':
        $ctx = require_company($user, $input['companyId'] ?? null);
        $stmt = db()->prepare('SELECT * FROM workflows WHERE company_id = ? ORDER BY updated_at DESC');
        $stmt->execute([$ctx['companyId']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $out = [];
        foreach ($rows as $w) {
            $vStmt = db()->prepare('SELECT MAX(version) as v FROM workflow_versions WHERE workflow_id = ?');
            $vStmt->execute([$w['id']]);
            $latest = $vStmt->fetch(PDO::FETCH_ASSOC)['v'];

            $cStmt = db()->prepare('SELECT COUNT(*) as c FROM workflow_instances WHERE workflow_id = ?');
            $cStmt->execute([$w['id']]);
            $count = $cStmt->fetch(PDO::FETCH_ASSOC)['c'];

            $out[] = [
                'id' => $w['id'], 'name' => $w['name'], 'description' => $w['description'],
                'status' => $w['status'], 'instanceCount' => (int) $count,
                'latestVersion' => $latest ? (int) $latest : null, 'updatedAt' => $w['updated_at'],
            ];
        }
        json_response($out);
        break;

    case 'workflows.get':
        require_fields($input, ['id']);
        $ctx = require_company($user, $input['companyId'] ?? null);
        $stmt = db()->prepare('SELECT * FROM workflows WHERE id = ? AND company_id = ?');
        $stmt->execute([$input['id'], $ctx['companyId']]);
        $w = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$w) error_response('Workflow non trovato', 404);

        $vStmt = db()->prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC');
        $vStmt->execute([$w['id']]);
        $versions = array_map(fn($v) => [
            'id' => $v['id'], 'version' => (int) $v['version'],
            'nodesJson' => $v['nodes_json'], 'edgesJson' => $v['edges_json'], 'formsJson' => $v['forms_json'],
        ], $vStmt->fetchAll(PDO::FETCH_ASSOC));

        json_response([
            'id' => $w['id'], 'name' => $w['name'], 'description' => $w['description'],
            'status' => $w['status'], 'versions' => $versions,
        ]);
        break;

    case 'workflows.create':
        $ctx = require_company($user, $input['companyId'] ?? null);
        require_role($ctx['roleKey'], ['ADMIN']);
        require_fields($input, ['name']);

        $id = new_id('wf');
        db()->prepare('INSERT INTO workflows (id, company_id, name, description, status) VALUES (?, ?, ?, ?, "DRAFT")')
            ->execute([$id, $ctx['companyId'], $input['name'], $input['description'] ?? null]);
        db()->prepare('INSERT INTO workflow_versions (id, workflow_id, version, nodes_json, edges_json, forms_json) VALUES (?, ?, 1, ?, ?, ?)')
            ->execute([new_id('wfv'), $id, json_encode($input['nodes'] ?? []), json_encode($input['edges'] ?? []), json_encode($input['forms'] ?? (object)[])]);

        log_audit($ctx['companyId'], $user['id'], null, 'Workflow creato: "' . $input['name'] . '"');
        json_response(['id' => $id], 201);
        break;

    case 'workflows.saveDraft':
        require_fields($input, ['id', 'name']);
        $ctx = require_company($user, $input['companyId'] ?? null);
        require_role($ctx['roleKey'], ['ADMIN']);

        $stmt = db()->prepare('SELECT * FROM workflows WHERE id = ? AND company_id = ?');
        $stmt->execute([$input['id'], $ctx['companyId']]);
        $w = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$w) error_response('Workflow non trovato', 404);

        $vStmt = db()->prepare('SELECT MAX(version) as v FROM workflow_versions WHERE workflow_id = ?');
        $vStmt->execute([$w['id']]);
        $nextVersion = ((int) $vStmt->fetch(PDO::FETCH_ASSOC)['v']) + 1;

        db()->prepare('INSERT INTO workflow_versions (id, workflow_id, version, nodes_json, edges_json, forms_json) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([new_id('wfv'), $w['id'], $nextVersion, json_encode($input['nodes'] ?? []), json_encode($input['edges'] ?? []), json_encode($input['forms'] ?? (object)[])]);
        db()->prepare('UPDATE workflows SET name = ?, description = ?, updated_at = datetime("now") WHERE id = ?')
            ->execute([$input['name'], $input['description'] ?? null, $w['id']]);

        log_audit($ctx['companyId'], $user['id'], null, 'Bozza salvata per "' . $input['name'] . '" (v' . $nextVersion . ')');
        json_response(['ok' => true]);
        break;

    case 'workflows.publish':
        require_fields($input, ['id']);
        $ctx = require_company($user, $input['companyId'] ?? null);
        require_role($ctx['roleKey'], ['ADMIN']);

        $stmt = db()->prepare('SELECT * FROM workflows WHERE id = ? AND company_id = ?');
        $stmt->execute([$input['id'], $ctx['companyId']]);
        $w = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$w) error_response('Workflow non trovato', 404);

        db()->prepare('UPDATE workflows SET status = "PUBLISHED", updated_at = datetime("now") WHERE id = ?')->execute([$w['id']]);
        log_audit($ctx['companyId'], $user['id'], null, 'Workflow pubblicato: "' . $w['name'] . '"');
        json_response(['ok' => true]);
        break;

    // ---------------- ISTANZE ----------------

    case 'instances.list':
        $ctx = require_company($user, $input['companyId'] ?? null);
        if ($ctx['roleKey'] === 'OPERATOR') {
            $stmt = db()->prepare('
                SELECT DISTINCT wi.*, w.name as workflow_name FROM workflow_instances wi
                JOIN workflows w ON w.id = wi.workflow_id
                LEFT JOIN workflow_tasks t ON t.instance_id = wi.id
                WHERE w.company_id = ? AND (wi.created_by_id = ? OR t.assigned_to_id = ?)
                ORDER BY wi.updated_at DESC
            ');
            $stmt->execute([$ctx['companyId'], $user['id'], $user['id']]);
        } else {
            $stmt = db()->prepare('
                SELECT wi.*, w.name as workflow_name FROM workflow_instances wi
                JOIN workflows w ON w.id = wi.workflow_id
                WHERE w.company_id = ? ORDER BY wi.updated_at DESC
            ');
            $stmt->execute([$ctx['companyId']]);
        }
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        json_response(array_map(fn($i) => [
            'id' => $i['id'], 'code' => $i['code'], 'status' => $i['status'],
            'updatedAt' => $i['updated_at'], 'workflow' => ['name' => $i['workflow_name']],
        ], $rows));
        break;

    case 'instances.create':
        require_fields($input, ['workflowId']);
        $ctx = require_company($user, $input['companyId'] ?? null);

        $stmt = db()->prepare('SELECT * FROM workflows WHERE id = ? AND company_id = ? AND status = "PUBLISHED"');
        $stmt->execute([$input['workflowId'], $ctx['companyId']]);
        $w = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$w) error_response('Workflow pubblicato non trovato', 404);

        $vStmt = db()->prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC LIMIT 1');
        $vStmt->execute([$w['id']]);
        $version = $vStmt->fetch(PDO::FETCH_ASSOC);
        if (!$version) error_response('Nessuna versione pubblicata', 404);

        $cStmt = db()->prepare('SELECT COUNT(*) as c FROM workflow_instances wi JOIN workflows w2 ON w2.id = wi.workflow_id WHERE w2.company_id = ?');
        $cStmt->execute([$ctx['companyId']]);
        $count = (int) $cStmt->fetch(PDO::FETCH_ASSOC)['c'];
        $code = 'Richiesta #' . (1000 + $count + 1);

        $id = new_id('inst');
        db()->prepare('
            INSERT INTO workflow_instances (id, workflow_id, workflow_version_id, code, data_json, created_by_id, status)
            VALUES (?, ?, ?, ?, "{}", ?, "BOZZA")
        ')->execute([$id, $w['id'], $version['id'], $code, $user['id']]);

        log_audit($ctx['companyId'], $user['id'], $id, 'Creazione istanza "' . $code . '"');
        advance_instance($id);
        json_response(['id' => $id, 'code' => $code], 201);
        break;

    case 'instances.get':
        require_fields($input, ['id']);
        $ctx = require_company($user, $input['companyId'] ?? null);
        json_response(fetch_instance_detail($input['id'], $ctx['companyId']));
        break;

    case 'instances.formSubmit':
        require_fields($input, ['instanceId', 'taskId']);
        $ctx = require_company($user, $input['companyId'] ?? null);
        $instance = fetch_instance_row($input['instanceId'], $ctx['companyId']);

        $taskStmt = db()->prepare('SELECT * FROM workflow_tasks WHERE id = ?');
        $taskStmt->execute([$input['taskId']]);
        $task = $taskStmt->fetch(PDO::FETCH_ASSOC);
        if (!$task) error_response('Attivita\' non trovata', 404);

        $node = find_node_in_instance($instance['id'], $task['node_id']);
        if (!$node || !can_act_on_node($node, $user['id'], $ctx['roleKey'], $instance['created_by_id'])) {
            error_response('Non sei tra i responsabili di questo passaggio', 403);
        }

        $data = array_merge(json_decode($instance['data_json'], true) ?: [], $input['values'] ?? []);
        db()->prepare('UPDATE workflow_instances SET data_json = ? WHERE id = ?')->execute([json_encode($data), $instance['id']]);
        db()->prepare('UPDATE workflow_tasks SET status = "COMPLETATO", resolved_at = datetime("now"), assigned_to_id = ? WHERE id = ?')
            ->execute([$user['id'], $input['taskId']]);

        log_audit($ctx['companyId'], $user['id'], $instance['id'], 'Form compilato', null, $input['values'] ?? []);
        advance_from($instance['id'], $task['node_id'], null);
        json_response(['ok' => true]);
        break;

    case 'instances.decision':
        require_fields($input, ['instanceId', 'taskId', 'decision', 'comment']);
        $ctx = require_company($user, $input['companyId'] ?? null);
        $instance = fetch_instance_row($input['instanceId'], $ctx['companyId']);

        $taskStmt = db()->prepare('SELECT * FROM workflow_tasks WHERE id = ?');
        $taskStmt->execute([$input['taskId']]);
        $task = $taskStmt->fetch(PDO::FETCH_ASSOC);
        if (!$task) error_response('Attivita\' non trovata', 404);

        $node = find_node_in_instance($instance['id'], $task['node_id']);
        if (!$node || !can_act_on_node($node, $user['id'], $ctx['roleKey'], $instance['created_by_id'])) {
            error_response('Non sei tra i responsabili di questo passaggio', 403);
        }

        $decision = $input['decision'] === 'approve' ? 'approve' : 'reject';
        $newStatus = $decision === 'approve' ? 'APPROVATO' : 'RIFIUTATO';
        db()->prepare('UPDATE workflow_tasks SET status = ?, resolved_at = datetime("now"), assigned_to_id = ? WHERE id = ?')
            ->execute([$newStatus, $user['id'], $input['taskId']]);

        db()->prepare('INSERT INTO workflow_comments (id, instance_id, author_id, body) VALUES (?, ?, ?, ?)')
            ->execute([new_id('cmt'), $instance['id'], $user['id'], $input['comment']]);

        log_audit($ctx['companyId'], $user['id'], $instance['id'], 'Decisione "' . $task['node_label'] . '": ' . ($decision === 'approve' ? 'Approvato' : 'Rifiutato') . ' — ' . $input['comment']);

        if ($decision === 'approve') {
            advance_from($instance['id'], $task['node_id'], 'approve');
        } else {
            send_back($instance['id']);
        }
        json_response(['ok' => true]);
        break;

    case 'instances.complete':
        require_fields($input, ['instanceId', 'taskId']);
        $ctx = require_company($user, $input['companyId'] ?? null);
        $instance = fetch_instance_row($input['instanceId'], $ctx['companyId']);

        $taskStmt = db()->prepare('SELECT * FROM workflow_tasks WHERE id = ?');
        $taskStmt->execute([$input['taskId']]);
        $task = $taskStmt->fetch(PDO::FETCH_ASSOC);
        if (!$task) error_response('Attivita\' non trovata', 404);

        $node = find_node_in_instance($instance['id'], $task['node_id']);
        if (!$node || !can_act_on_node($node, $user['id'], $ctx['roleKey'], $instance['created_by_id'])) {
            error_response('Non sei tra i responsabili di questo passaggio', 403);
        }

        db()->prepare('UPDATE workflow_tasks SET status = "COMPLETATO", resolved_at = datetime("now"), assigned_to_id = ? WHERE id = ?')
            ->execute([$user['id'], $input['taskId']]);

        log_audit($ctx['companyId'], $user['id'], $instance['id'], 'Attivita\' completata: "' . $task['node_label'] . '"');
        advance_from($instance['id'], $task['node_id'], null);
        json_response(['ok' => true]);
        break;

    case 'instances.comment':
        require_fields($input, ['instanceId', 'body']);
        $ctx = require_company($user, $input['companyId'] ?? null);
        $instance = fetch_instance_row($input['instanceId'], $ctx['companyId']);

        db()->prepare('INSERT INTO workflow_comments (id, instance_id, author_id, body) VALUES (?, ?, ?, ?)')
            ->execute([new_id('cmt'), $instance['id'], $user['id'], $input['body']]);
        log_audit($ctx['companyId'], $user['id'], $instance['id'], 'Commento aggiunto');
        json_response(['ok' => true], 201);
        break;

    case 'companies.users':
        $ctx = require_company($user, $input['companyId'] ?? null);
        $stmt = db()->prepare('
            SELECT u.id, u.full_name, u.email, r.name as role_name FROM user_companies uc
            JOIN users u ON u.id = uc.user_id
            JOIN roles r ON r.id = uc.role_id
            WHERE uc.company_id = ? ORDER BY u.full_name
        ');
        $stmt->execute([$ctx['companyId']]);
        json_response(array_map(fn($u) => [
            'id' => $u['id'], 'fullName' => $u['full_name'], 'email' => $u['email'], 'role' => $u['role_name'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC)));
        break;

    // ---------------- DASHBOARD ----------------

    case 'dashboard.kpi':
        $ctx = require_company($user, $input['companyId'] ?? null);
        json_response(compute_kpi($ctx['companyId']));
        break;

    default:
        error_response('Azione sconosciuta: ' . $action, 404);
}

// ==================== helper di query condivisi ====================

function fetch_instance_row(string $id, string $companyId): array
{
    $stmt = db()->prepare('
        SELECT wi.* FROM workflow_instances wi
        JOIN workflows w ON w.id = wi.workflow_id
        WHERE wi.id = ? AND w.company_id = ?
    ');
    $stmt->execute([$id, $companyId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) error_response('Istanza non trovata', 404);
    return $row;
}

function find_node_in_instance(string $instanceId, string $nodeId): ?array
{
    $stmt = db()->prepare('
        SELECT wv.nodes_json FROM workflow_instances wi
        JOIN workflow_versions wv ON wv.id = wi.workflow_version_id
        WHERE wi.id = ?
    ');
    $stmt->execute([$instanceId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return null;
    $nodes = json_decode($row['nodes_json'], true);
    foreach ($nodes as $n) if ($n['id'] === $nodeId) return $n;
    return null;
}

function fetch_instance_detail(string $id, string $companyId): array
{
    $instance = fetch_instance_row($id, $companyId);

    $wStmt = db()->prepare('SELECT * FROM workflows WHERE id = ?');
    $wStmt->execute([$instance['workflow_id']]);
    $workflow = $wStmt->fetch(PDO::FETCH_ASSOC);

    $vStmt = db()->prepare('SELECT * FROM workflow_versions WHERE id = ?');
    $vStmt->execute([$instance['workflow_version_id']]);
    $version = $vStmt->fetch(PDO::FETCH_ASSOC);

    $tStmt = db()->prepare('
        SELECT t.*, u.full_name as assigned_name FROM workflow_tasks t
        LEFT JOIN users u ON u.id = t.assigned_to_id
        WHERE t.instance_id = ? ORDER BY t.created_at ASC
    ');
    $tStmt->execute([$id]);
    $tasks = array_map(fn($t) => [
        'id' => $t['id'], 'nodeId' => $t['node_id'], 'nodeType' => $t['node_type'], 'nodeLabel' => $t['node_label'],
        'status' => $t['status'], 'assignedTo' => $t['assigned_name'] ? ['fullName' => $t['assigned_name']] : null,
        'createdAt' => $t['created_at'], 'resolvedAt' => $t['resolved_at'],
    ], $tStmt->fetchAll(PDO::FETCH_ASSOC));

    $cStmt = db()->prepare('
        SELECT c.*, u.full_name FROM workflow_comments c
        JOIN users u ON u.id = c.author_id
        WHERE c.instance_id = ? ORDER BY c.created_at ASC
    ');
    $cStmt->execute([$id]);
    $comments = array_map(fn($c) => [
        'id' => $c['id'], 'body' => $c['body'], 'createdAt' => $c['created_at'],
        'author' => ['fullName' => $c['full_name']],
    ], $cStmt->fetchAll(PDO::FETCH_ASSOC));

    $aStmt = db()->prepare('SELECT * FROM ai_decisions WHERE instance_id = ? ORDER BY created_at ASC');
    $aStmt->execute([$id]);
    $aiDecisions = array_map(fn($a) => [
        'id' => $a['id'], 'suggestion' => $a['suggestion'], 'confidence' => (float) $a['confidence'],
        'autoApplied' => (bool) $a['auto_applied'],
    ], $aStmt->fetchAll(PDO::FETCH_ASSOC));

    $logStmt = db()->prepare('
        SELECT l.*, u.full_name FROM audit_logs l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.instance_id = ? ORDER BY l.created_at ASC
    ');
    $logStmt->execute([$id]);
    $auditLogs = array_map(fn($l) => [
        'id' => $l['id'], 'action' => $l['action'], 'createdAt' => $l['created_at'],
        'user' => $l['full_name'] ? ['fullName' => $l['full_name']] : null,
    ], $logStmt->fetchAll(PDO::FETCH_ASSOC));

    return [
        'id' => $instance['id'], 'code' => $instance['code'], 'status' => $instance['status'],
        'currentNodeId' => $instance['current_node_id'], 'createdById' => $instance['created_by_id'],
        'workflow' => ['id' => $workflow['id'], 'name' => $workflow['name']],
        'workflowVersion' => ['nodesJson' => $version['nodes_json'], 'edgesJson' => $version['edges_json']],
        'tasks' => $tasks, 'comments' => $comments, 'aiDecisions' => $aiDecisions, 'auditLogs' => $auditLogs,
    ];
}

function compute_kpi(string $companyId): array
{
    $stmt = db()->prepare('
        SELECT wi.status, wi.created_at, wi.updated_at FROM workflow_instances wi
        JOIN workflows w ON w.id = wi.workflow_id WHERE w.company_id = ?
    ');
    $stmt->execute([$companyId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $attivi = 0; $conclusi = 0; $bloccati = 0; $approvals = 0; $totalMs = 0; $completedCount = 0;
    foreach ($rows as $r) {
        if (in_array($r['status'], ['IN_CORSO', 'IN_ATTESA', 'BOZZA'], true)) $attivi++;
        if ($r['status'] === 'COMPLETATO') { $conclusi++; $completedCount++; $approvals++; $totalMs += strtotime($r['updated_at']) - strtotime($r['created_at']); }
        if ($r['status'] === 'ANNULLATO') $bloccati++;
        if ($r['status'] === 'APPROVATO') $approvals++;
    }
    $total = count($rows);

    $aiStmt = db()->prepare('
        SELECT a.* FROM ai_decisions a
        JOIN workflow_instances wi ON wi.id = a.instance_id
        JOIN workflows w ON w.id = wi.workflow_id WHERE w.company_id = ?
    ');
    $aiStmt->execute([$companyId]);
    $aiRows = $aiStmt->fetchAll(PDO::FETCH_ASSOC);

    return [
        'attivi' => $attivi, 'conclusi' => $conclusi, 'bloccati' => $bloccati,
        'tempoMedioOre' => $completedCount > 0 ? round(($totalMs / $completedCount) / 3600, 1) : 0,
        'percentualeApprovazioni' => $total > 0 ? round(($approvals / $total) * 100) : 0,
        'decisioniAi' => count($aiRows),
        'decisioniAiAutomatiche' => count(array_filter($aiRows, fn($a) => (bool) $a['auto_applied'])),
    ];
}
