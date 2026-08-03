<?php
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/crypto.php';
require_once __DIR__ . '/includes/jwt.php';
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

    case 'auth.updateProfile':
        $fields = [];
        $params = [];
        if (!empty($input['fullName'])) { $fields[] = 'full_name = ?'; $params[] = $input['fullName']; }
        if (!empty($input['password'])) { $fields[] = 'password_hash = ?'; $params[] = password_hash($input['password'], PASSWORD_DEFAULT); }
        if (isset($input['phone'])) { $fields[] = 'phone = ?'; $params[] = $input['phone']; }
        if (isset($input['jobTitle'])) { $fields[] = 'job_title = ?'; $params[] = $input['jobTitle']; }
        if (isset($input['notes'])) { $fields[] = 'notes = ?'; $params[] = encrypt_data($input['notes']); }
        if (!empty($input['avatarBase64'])) {
            $avatarName = save_avatar($input['avatarBase64'], $input['avatarMimeType'] ?? 'image/jpeg');
            if ($avatarName) { $fields[] = 'avatar_path = ?'; $params[] = $avatarName; }
        }
        if (!empty($fields)) {
            $params[] = $user['id'];
            db()->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
        }
        $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $u = $stmt->fetch(PDO::FETCH_ASSOC);
        json_response([
            'id' => $u['id'], 'email' => $u['email'], 'fullName' => $u['full_name'], 'isSuperAdmin' => (bool) $u['is_super_admin'],
            'phone' => $u['phone'], 'jobTitle' => $u['job_title'], 'notes' => decrypt_data($u['notes']), 'hasAvatar' => !empty($u['avatar_path']),
        ]);
        break;

    case 'search.global':
        require_fields($input, ['query']);
        $ctx = require_company($user, $input['companyId'] ?? null);
        $q = '%' . $input['query'] . '%';
        $results = [];

        $stmt = db()->prepare('SELECT id, name, status FROM workflows WHERE company_id = ? AND name LIKE ? LIMIT 8');
        $stmt->execute([$ctx['companyId'], $q]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $w) {
            $results[] = ['type' => 'workflow', 'id' => $w['id'], 'label' => $w['name'], 'subtitle' => $w['status'], 'link' => '/workflow/designer/' . $w['id']];
        }

        $stmt = db()->prepare('
            SELECT wi.id, wi.code, wi.status, wi.data_json, w.name as workflow_name FROM workflow_instances wi
            JOIN workflows w ON w.id = wi.workflow_id
            WHERE w.company_id = ? ORDER BY wi.updated_at DESC LIMIT 200
        ');
        $stmt->execute([$ctx['companyId']]);
        $needle = strtolower($input['query']);
        $matches = 0;
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $i) {
            if ($matches >= 8) break;
            $codeMatches = stripos($i['code'], $input['query']) !== false;
            $dataMatches = strpos(strtolower(decrypt_data($i['data_json'])), $needle) !== false;
            if ($codeMatches || $dataMatches) {
                $results[] = ['type' => 'instance', 'id' => $i['id'], 'label' => $i['code'], 'subtitle' => $i['workflow_name'] . ' — ' . $i['status'], 'link' => '/workflow/instances'];
                $matches++;
            }
        }

        if ($user['is_super_admin']) {
            $stmt = db()->prepare('SELECT id, full_name, email FROM users WHERE full_name LIKE ? OR email LIKE ? LIMIT 8');
            $stmt->execute([$q, $q]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
                $results[] = ['type' => 'user', 'id' => $u['id'], 'label' => $u['full_name'], 'subtitle' => $u['email'], 'link' => '/admin/users'];
            }

            $stmt = db()->prepare('SELECT id, name FROM companies WHERE name LIKE ? LIMIT 8');
            $stmt->execute([$q]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $c) {
                $results[] = ['type' => 'company', 'id' => $c['id'], 'label' => $c['name'], 'subtitle' => 'Azienda', 'link' => '/admin/companies'];
            }
        }

        json_response($results);
        break;

    case 'auth.meCompanies':
        if ($user['is_super_admin']) {
            $companies = db()->query('SELECT * FROM companies ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);
            $apps = db()->query('SELECT * FROM applications WHERE enabled = 1')->fetchAll(PDO::FETCH_ASSOC);
            $appList = array_map(fn($a) => ['key' => $a['app_key'], 'name' => $a['name'], 'category' => $a['category']], $apps);
            json_response(array_map(fn($c) => [
                'id' => $c['id'], 'name' => $c['name'], 'role' => 'Super Amministratore', 'roleKey' => 'SUPER_ADMIN', 'applications' => $appList,
            ], $companies));
        }

        $stmt = db()->prepare("
            SELECT uc.id as uc_id, c.id as c_id, c.name as c_name, r.name as r_name, r.role_key as r_key, a.id as a_id, a.app_key, a.name as a_name, a.category as a_category
            FROM user_companies uc
            JOIN companies c ON c.id = uc.company_id
            JOIN user_company_applications uca ON uca.user_company_id = uc.id AND uca.role_id IS NOT NULL
            JOIN applications a ON a.id = uca.application_id AND a.enabled = 1
            JOIN roles r ON r.id = uca.role_id
            WHERE uc.user_id = ?
        ");
        $stmt->execute([$user['id']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Un'azienda puo' comparire piu' volte (una per app abilitata): le raggruppiamo,
        // usando il ruolo dell'app "workflow" come ruolo mostrato per quell'azienda.
        $byCompany = [];
        foreach ($rows as $row) {
            if (!isset($byCompany[$row['c_id']])) {
                $byCompany[$row['c_id']] = ['id' => $row['c_id'], 'name' => $row['c_name'], 'role' => $row['r_name'], 'roleKey' => $row['r_key'], 'applications' => []];
            }
            if ($row['app_key'] === 'workflow') {
                $byCompany[$row['c_id']]['role'] = $row['r_name'];
                $byCompany[$row['c_id']]['roleKey'] = $row['r_key'];
            }
            $byCompany[$row['c_id']]['applications'][] = ['key' => $row['app_key'], 'name' => $row['a_name'], 'category' => $row['a_category']];
        }
        json_response(array_values($byCompany));
        break;

    // ---------------- WORKFLOWS ----------------

    case 'workflows.list':
        $ctx = require_company($user, $input['companyId'] ?? null);
        $stmt = db()->prepare('
            SELECT w.*, c.name as company_name FROM workflows w
            JOIN companies c ON c.id = w.company_id
            WHERE w.company_id = ? ORDER BY w.updated_at DESC
        ');
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
                'companyId' => $w['company_id'], 'companyName' => $w['company_name'],
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

    case 'workflows.updateCompany':
        require_super_admin($user);
        require_fields($input, ['id', 'newCompanyId']);
        $stmt = db()->prepare('SELECT * FROM workflows WHERE id = ?');
        $stmt->execute([$input['id']]);
        $w = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$w) error_response('Workflow non trovato', 404);

        db()->prepare('UPDATE workflows SET company_id = ?, updated_at = datetime("now") WHERE id = ?')
            ->execute([$input['newCompanyId'], $input['id']]);
        log_audit($input['newCompanyId'], $user['id'], null, 'Workflow "' . $w['name'] . '" spostato a questa azienda');
        json_response(['ok' => true]);
        break;

    // ---------------- ISTANZE ----------------

    case 'instances.list':
        $ctx = require_company($user, $input['companyId'] ?? null);
        $pageSize = 10;
        $page = max(1, (int) ($input['page'] ?? 1));
        $offset = ($page - 1) * $pageSize;
        $isOperator = $ctx['roleKey'] === 'OPERATOR';

        $where = ['w.company_id = ?'];
        $params = [$ctx['companyId']];

        if (!empty($input['workflowId'])) { $where[] = 'wi.workflow_id = ?'; $params[] = $input['workflowId']; }
        if (!empty($input['status'])) { $where[] = 'wi.status = ?'; $params[] = $input['status']; }
        if (!empty($input['openClosed']) && $input['openClosed'] === 'open') { $where[] = "wi.status NOT IN ('COMPLETATO', 'ANNULLATO')"; }
        if (!empty($input['openClosed']) && $input['openClosed'] === 'closed') { $where[] = "wi.status IN ('COMPLETATO', 'ANNULLATO')"; }
        if (!empty($input['code'])) { $where[] = 'wi.code LIKE ?'; $params[] = '%' . $input['code'] . '%'; }
        if (!empty($input['dateFrom'])) { $where[] = 'date(wi.created_at) >= date(?)'; $params[] = $input['dateFrom']; }
        if (!empty($input['dateTo'])) { $where[] = 'date(wi.created_at) <= date(?)'; $params[] = $input['dateTo']; }

        $whereSql = implode(' AND ', $where);

        $stmt = db()->prepare("
            SELECT wi.*, w.name as workflow_name, wv.nodes_json, wv.edges_json FROM workflow_instances wi
            JOIN workflows w ON w.id = wi.workflow_id
            JOIN workflow_versions wv ON wv.id = wi.workflow_version_id
            WHERE $whereSql ORDER BY wi.updated_at DESC
        ");
        $stmt->execute($params);
        $allRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // I dati dell'ordine sono cifrati a riposo: la ricerca per anagrafica
        // decifra e confronta lato PHP invece di un LIKE diretto in SQL.
        if (!empty($input['anagrafica'])) {
            $needle = strtolower($input['anagrafica']);
            $allRows = array_values(array_filter($allRows, function ($r) use ($needle) {
                $plain = decrypt_data($r['data_json']);
                return strpos(strtolower($plain), $needle) !== false;
            }));
        }

        if ($isOperator) {
            // Un operatore vede un'istanza se l'ha creata, se ha gia' risolto un
            // passo in passato, OPPURE se il passo attualmente aperto lo ha tra
            // i responsabili (anche se non ha ancora agito: prima doveva averlo
            // gia' fatto per poterla vedere, il che non aveva senso).
            $instanceIds = array_map(fn($r) => $r['id'], $allRows);
            $resolvedByMe = [];
            if (!empty($instanceIds)) {
                $ph = implode(',', array_fill(0, count($instanceIds), '?'));
                $rStmt = db()->prepare("SELECT DISTINCT instance_id FROM workflow_tasks WHERE assigned_to_id = ? AND instance_id IN ($ph)");
                $rStmt->execute(array_merge([$user['id']], $instanceIds));
                foreach ($rStmt->fetchAll(PDO::FETCH_ASSOC) as $r) $resolvedByMe[$r['instance_id']] = true;
            }

            $allRows = array_values(array_filter($allRows, function ($r) use ($user, $resolvedByMe) {
                if ($r['created_by_id'] === $user['id']) return true;
                if (isset($resolvedByMe[$r['id']])) return true;
                if (!$r['current_node_id']) return false;
                $nodes = json_decode($r['nodes_json'], true);
                $node = null;
                foreach ($nodes as $n) if ($n['id'] === $r['current_node_id']) { $node = $n; break; }
                if (!$node) return false;
                $responsibleIds = $node['data']['config']['responsibleUserIds'] ?? [];
                return in_array($user['id'], $responsibleIds, true);
            }));
        }

        $total = count($allRows);
        $rows = array_slice($allRows, $offset, $pageSize);

        $ids = array_map(fn($r) => $r['id'], $rows);
        $tasksByInstance = [];
        $commentNodesByInstance = [];
        $attachmentNodesByInstance = [];
        if (!empty($ids)) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $tStmt = db()->prepare("SELECT * FROM workflow_tasks WHERE instance_id IN ($placeholders) ORDER BY created_at ASC");
            $tStmt->execute($ids);
            foreach ($tStmt->fetchAll(PDO::FETCH_ASSOC) as $t) {
                $tasksByInstance[$t['instance_id']][] = $t;
            }

            $cStmt = db()->prepare("SELECT instance_id, node_id FROM workflow_comments WHERE instance_id IN ($placeholders) AND node_id IS NOT NULL");
            $cStmt->execute($ids);
            foreach ($cStmt->fetchAll(PDO::FETCH_ASSOC) as $c) {
                $commentNodesByInstance[$c['instance_id']][$c['node_id']] = true;
            }

            $atStmt = db()->prepare("SELECT instance_id, node_id FROM attachments WHERE instance_id IN ($placeholders) AND node_id IS NOT NULL");
            $atStmt->execute($ids);
            foreach ($atStmt->fetchAll(PDO::FETCH_ASSOC) as $a) {
                $attachmentNodesByInstance[$a['instance_id']][$a['node_id']] = true;
            }
        }

        json_response([
            'items' => array_map(function ($i) use ($tasksByInstance, $commentNodesByInstance, $attachmentNodesByInstance, $user, $ctx) {
                $nodes = json_decode($i['nodes_json'], true);
                $nodeById = [];
                foreach ($nodes as $n) $nodeById[$n['id']] = $n;
                $tasks = array_map(function ($t) use ($nodeById, $user, $ctx, $commentNodesByInstance, $attachmentNodesByInstance, $i) {
                    $node = $nodeById[$t['node_id']] ?? null;
                    return [
                        'nodeId' => $t['node_id'], 'nodeType' => $t['node_type'], 'status' => $t['status'],
                        'canRead' => $node ? can_read_node($node, $user['id'], $ctx['roleKey']) : true,
                        'hasComment' => isset($commentNodesByInstance[$i['id']][$t['node_id']]),
                        'hasAttachment' => isset($attachmentNodesByInstance[$i['id']][$t['node_id']]),
                    ];
                }, $tasksByInstance[$i['id']] ?? []);

                return [
                    'id' => $i['id'], 'code' => $i['code'], 'status' => $i['status'],
                    'updatedAt' => $i['updated_at'], 'createdAt' => $i['created_at'],
                    'currentNodeId' => $i['current_node_id'],
                    'workflow' => ['id' => $i['workflow_id'], 'name' => $i['workflow_name']],
                    'nodesJson' => $i['nodes_json'], 'edgesJson' => $i['edges_json'],
                    'tasks' => $tasks,
                ];
            }, $rows),
            'total' => $total, 'page' => $page, 'pageSize' => $pageSize,
        ]);
        break;

    case 'instances.create':
        require_fields($input, ['workflowId']);
        $ctx = require_company($user, $input['companyId'] ?? null);

        $result = create_instance($ctx['companyId'], $input['workflowId'], $user['id']);
        if (isset($result['error'])) error_response($result['error'], 404);
        json_response($result, 201);
        break;

    case 'instances.get':
        require_fields($input, ['id']);
        $ctx = require_company($user, $input['companyId'] ?? null);
        json_response(fetch_instance_detail($input['id'], $ctx['companyId'], $user['id'], $ctx['roleKey']));
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

        $data = array_merge(json_decode(decrypt_data($instance['data_json']), true) ?: [], $input['values'] ?? []);
        db()->prepare('UPDATE workflow_instances SET data_json = ? WHERE id = ?')->execute([encrypt_data(json_encode($data)), $instance['id']]);
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

        db()->prepare('INSERT INTO workflow_comments (id, instance_id, node_id, author_id, body) VALUES (?, ?, ?, ?, ?)')
            ->execute([new_id('cmt'), $instance['id'], $input['nodeId'] ?? null, $user['id'], $input['body']]);
        log_audit($ctx['companyId'], $user['id'], $instance['id'], 'Commento aggiunto' . (!empty($input['nodeId']) ? ' sul passo' : ''));
        json_response(['ok' => true], 201);
        break;

    case 'instances.attachments.upload':
        require_fields($input, ['instanceId', 'nodeId', 'fileName', 'mimeType', 'dataBase64']);
        $ctx = require_company($user, $input['companyId'] ?? null);
        $instance = fetch_instance_row($input['instanceId'], $ctx['companyId']);

        $node = find_node_in_instance($instance['id'], $input['nodeId']);
        if ($node && !can_act_on_node($node, $user['id'], $ctx['roleKey'], $instance['created_by_id'])) {
            error_response('Non sei tra i responsabili di questo passaggio', 403);
        }

        $binary = base64_decode($input['dataBase64'], true);
        if ($binary === false) error_response('File non valido', 400);
        if (strlen($binary) > 8 * 1024 * 1024) error_response('File troppo grande (max 8MB)', 400);

        $attachDir = __DIR__ . '/data/attachments';
        if (!is_dir($attachDir)) mkdir($attachDir, 0755, true);
        $storedName = new_id('file') . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $input['fileName']);
        file_put_contents($attachDir . '/' . $storedName, encrypt_bytes($binary));

        $id = new_id('att');
        db()->prepare('
            INSERT INTO attachments (id, company_id, instance_id, node_id, uploaded_by_id, file_name, stored_name, mime_type, size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ')->execute([$id, $ctx['companyId'], $instance['id'], $input['nodeId'], $user['id'], $input['fileName'], $storedName, $input['mimeType'], strlen($binary)]);

        log_audit($ctx['companyId'], $user['id'], $instance['id'], 'Allegato caricato: "' . $input['fileName'] . '"');
        json_response(['id' => $id], 201);
        break;

    case 'nodeTemplates.list':
        $ctx = require_company($user, $input['companyId'] ?? null);
        $stmt = db()->prepare('SELECT * FROM node_templates WHERE company_id = ? ORDER BY created_at DESC');
        $stmt->execute([$ctx['companyId']]);
        json_response(array_map(fn($t) => [
            'id' => $t['id'], 'nodeType' => $t['node_type'], 'label' => $t['label'], 'config' => json_decode($t['config_json'], true),
        ], $stmt->fetchAll(PDO::FETCH_ASSOC)));
        break;

    case 'nodeTemplates.create':
        $ctx = require_company($user, $input['companyId'] ?? null);
        require_role($ctx['roleKey'], ['ADMIN']);
        require_fields($input, ['nodeType', 'label', 'config']);
        $id = new_id('tmpl');
        db()->prepare('INSERT INTO node_templates (id, company_id, node_type, label, config_json, created_by_id) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$id, $ctx['companyId'], $input['nodeType'], $input['label'], json_encode($input['config']), $user['id']]);
        json_response(['id' => $id], 201);
        break;

    case 'nodeTemplates.delete':
        $ctx = require_company($user, $input['companyId'] ?? null);
        require_role($ctx['roleKey'], ['ADMIN']);
        require_fields($input, ['id']);
        db()->prepare('DELETE FROM node_templates WHERE id = ? AND company_id = ?')->execute([$input['id'], $ctx['companyId']]);
        json_response(['ok' => true]);
        break;

    case 'apiTokens.list':
        $ctx = require_company($user, $input['companyId'] ?? null);
        require_role($ctx['roleKey'], ['ADMIN']);
        $stmt = db()->prepare('
            SELECT t.id, t.label, t.workflow_id, t.created_at, t.revoked, w.name as workflow_name
            FROM api_tokens t LEFT JOIN workflows w ON w.id = t.workflow_id
            WHERE t.company_id = ? ORDER BY t.created_at DESC
        ');
        $stmt->execute([$ctx['companyId']]);
        json_response(array_map(fn($t) => [
            'id' => $t['id'], 'label' => $t['label'], 'workflowId' => $t['workflow_id'], 'workflowName' => $t['workflow_name'],
            'createdAt' => $t['created_at'], 'revoked' => (bool) $t['revoked'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC)));
        break;

    case 'apiTokens.create':
        $ctx = require_company($user, $input['companyId'] ?? null);
        require_role($ctx['roleKey'], ['ADMIN']);
        require_fields($input, ['label']);

        $workflowId = !empty($input['workflowId']) ? $input['workflowId'] : null;
        if ($workflowId) {
            $stmt = db()->prepare('SELECT id FROM workflows WHERE id = ? AND company_id = ?');
            $stmt->execute([$workflowId, $ctx['companyId']]);
            if (!$stmt->fetch()) error_response('Workflow non trovato', 404);
        }

        $id = new_id('tok');
        $jti = new_id('jti');
        db()->prepare('INSERT INTO api_tokens (id, company_id, workflow_id, label, jti, created_by_id) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$id, $ctx['companyId'], $workflowId, $input['label'], $jti, $user['id']]);

        // Token senza scadenza (revocabile in qualsiasi momento tramite jti):
        // funziona quindi sia come JWT "vero" sia come API key stabile per integrazioni esterne.
        $token = jwt_encode(['type' => 'external_order', 'companyId' => $ctx['companyId'], 'workflowId' => $workflowId, 'jti' => $jti]);
        log_audit($ctx['companyId'], $user['id'], null, 'Token API creato: "' . $input['label'] . '"');
        json_response(['id' => $id, 'token' => $token], 201);
        break;

    case 'apiTokens.revoke':
        $ctx = require_company($user, $input['companyId'] ?? null);
        require_role($ctx['roleKey'], ['ADMIN']);
        require_fields($input, ['id']);
        db()->prepare('UPDATE api_tokens SET revoked = 1 WHERE id = ? AND company_id = ?')->execute([$input['id'], $ctx['companyId']]);
        json_response(['ok' => true]);
        break;

    case 'customers.search':
        $ctx = require_company($user, $input['companyId'] ?? null);
        $q = '%' . ($input['query'] ?? '') . '%';
        $stmt = db()->prepare('SELECT id, name FROM customers WHERE company_id = ? AND name LIKE ? ORDER BY name LIMIT 10');
        $stmt->execute([$ctx['companyId'], $q]);
        json_response($stmt->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'customers.create':
        $ctx = require_company($user, $input['companyId'] ?? null);
        require_fields($input, ['name']);
        $name = trim($input['name']);

        $stmt = db()->prepare('SELECT id, name FROM customers WHERE company_id = ? AND name = ?');
        $stmt->execute([$ctx['companyId'], $name]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) json_response($existing);

        $id = new_id('cust');
        db()->prepare('INSERT INTO customers (id, company_id, name) VALUES (?, ?, ?)')->execute([$id, $ctx['companyId'], $name]);
        json_response(['id' => $id, 'name' => $name], 201);
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

    // ---------------- AMMINISTRAZIONE (solo Super Amministratore) ----------------

    case 'admin.users.list':
        require_super_admin($user);
        $rows = db()->query('SELECT id, email, full_name, user_type, is_super_admin, phone, job_title, avatar_path FROM users ORDER BY full_name')->fetchAll(PDO::FETCH_ASSOC);
        json_response(array_map(fn($u) => [
            'id' => $u['id'], 'email' => $u['email'], 'fullName' => $u['full_name'],
            'userType' => $u['user_type'], 'isSuperAdmin' => (bool) $u['is_super_admin'],
            'phone' => $u['phone'], 'jobTitle' => $u['job_title'], 'hasAvatar' => !empty($u['avatar_path']),
        ], $rows));
        break;

    case 'admin.users.create':
        require_super_admin($user);
        require_fields($input, ['email', 'password', 'fullName', 'userType']);
        $userType = in_array($input['userType'], ['SUPERADMIN', 'ADMIN', 'UTENTE'], true) ? $input['userType'] : 'UTENTE';

        $stmt = db()->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$input['email']]);
        if ($stmt->fetch()) error_response('Esiste gia\' un utente con questa email', 409);

        $avatarName = !empty($input['avatarBase64']) ? save_avatar($input['avatarBase64'], $input['avatarMimeType'] ?? 'image/jpeg') : null;

        $newId = new_id('user');
        db()->prepare('
            INSERT INTO users (id, email, password_hash, full_name, is_super_admin, user_type, phone, job_title, notes, avatar_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            $newId, $input['email'], password_hash($input['password'], PASSWORD_DEFAULT), $input['fullName'],
            $userType === 'SUPERADMIN' ? 1 : 0, $userType,
            $input['phone'] ?? null, $input['jobTitle'] ?? null, !empty($input['notes']) ? encrypt_data($input['notes']) : null, $avatarName,
        ]);
        json_response(['id' => $newId], 201);
        break;

    case 'admin.users.update':
        require_super_admin($user);
        require_fields($input, ['id']);
        $fields = [];
        $params = [];
        if (!empty($input['fullName'])) { $fields[] = 'full_name = ?'; $params[] = $input['fullName']; }
        if (!empty($input['email'])) { $fields[] = 'email = ?'; $params[] = $input['email']; }
        if (!empty($input['userType'])) {
            $userType = in_array($input['userType'], ['SUPERADMIN', 'ADMIN', 'UTENTE'], true) ? $input['userType'] : 'UTENTE';
            $fields[] = 'user_type = ?'; $params[] = $userType;
            $fields[] = 'is_super_admin = ?'; $params[] = $userType === 'SUPERADMIN' ? 1 : 0;
        }
        if (!empty($input['password'])) { $fields[] = 'password_hash = ?'; $params[] = password_hash($input['password'], PASSWORD_DEFAULT); }
        if (isset($input['phone'])) { $fields[] = 'phone = ?'; $params[] = $input['phone']; }
        if (isset($input['jobTitle'])) { $fields[] = 'job_title = ?'; $params[] = $input['jobTitle']; }
        if (isset($input['notes'])) { $fields[] = 'notes = ?'; $params[] = encrypt_data($input['notes']); }
        if (!empty($input['avatarBase64'])) {
            $avatarName = save_avatar($input['avatarBase64'], $input['avatarMimeType'] ?? 'image/jpeg');
            if ($avatarName) { $fields[] = 'avatar_path = ?'; $params[] = $avatarName; }
        }
        if (empty($fields)) json_response(['ok' => true]);
        $params[] = $input['id'];
        db()->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
        json_response(['ok' => true]);
        break;

    case 'admin.users.delete':
        require_super_admin($user);
        require_fields($input, ['id']);
        if ($input['id'] === $user['id']) error_response('Non puoi eliminare il tuo stesso account', 400);

        foreach (['workflow_instances' => 'created_by_id', 'workflow_comments' => 'author_id', 'attachments' => 'uploaded_by_id'] as $table => $col) {
            $stmt = db()->prepare("SELECT COUNT(*) as c FROM $table WHERE $col = ?");
            $stmt->execute([$input['id']]);
            if ((int) $stmt->fetch(PDO::FETCH_ASSOC)['c'] > 0) {
                error_response('Impossibile eliminare: l\'utente ha attivita\' collegate (istanze create, commenti o allegati). Rimuovi i suoi permessi invece.', 409);
            }
        }

        db()->prepare('UPDATE workflow_tasks SET assigned_to_id = NULL WHERE assigned_to_id = ?')->execute([$input['id']]);
        db()->prepare('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?')->execute([$input['id']]);
        db()->prepare('DELETE FROM user_company_applications WHERE user_company_id IN (SELECT id FROM user_companies WHERE user_id = ?)')->execute([$input['id']]);
        db()->prepare('DELETE FROM user_companies WHERE user_id = ?')->execute([$input['id']]);
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$input['id']]);
        json_response(['ok' => true]);
        break;

    case 'admin.companies.list':
        require_super_admin($user);
        $rows = db()->query('SELECT id, name, slug FROM companies ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);
        json_response($rows);
        break;

    case 'admin.companies.create':
        require_super_admin($user);
        require_fields($input, ['name']);
        $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $input['name']), '-'));
        $stmt = db()->prepare('SELECT id FROM companies WHERE slug = ?');
        $stmt->execute([$slug]);
        if ($stmt->fetch()) $slug .= '-' . substr(new_id(), -6);

        $id = new_id('co');
        db()->prepare('INSERT INTO companies (id, name, slug) VALUES (?, ?, ?)')->execute([$id, $input['name'], $slug]);
        // predispone subito i ruoli standard, cosi' l'azienda e' pronta per assegnare permessi
        ensure_company_role(db(), $id, 'ADMIN');
        ensure_company_role(db(), $id, 'SUPERVISOR');
        ensure_company_role(db(), $id, 'OPERATOR');
        json_response(['id' => $id], 201);
        break;

    case 'admin.companies.update':
        require_super_admin($user);
        require_fields($input, ['id', 'name']);
        db()->prepare('UPDATE companies SET name = ? WHERE id = ?')->execute([$input['name'], $input['id']]);
        json_response(['ok' => true]);
        break;

    case 'admin.companies.delete':
        require_super_admin($user);
        require_fields($input, ['id']);
        $stmt = db()->prepare('SELECT COUNT(*) as c FROM workflows WHERE company_id = ?');
        $stmt->execute([$input['id']]);
        if ((int) $stmt->fetch(PDO::FETCH_ASSOC)['c'] > 0) {
            error_response('Impossibile eliminare: l\'azienda ha workflow collegati.', 409);
        }
        db()->prepare('DELETE FROM user_company_applications WHERE user_company_id IN (SELECT id FROM user_companies WHERE company_id = ?)')->execute([$input['id']]);
        db()->prepare('DELETE FROM user_companies WHERE company_id = ?')->execute([$input['id']]);
        db()->prepare('DELETE FROM roles WHERE company_id = ?')->execute([$input['id']]);
        db()->prepare('DELETE FROM companies WHERE id = ?')->execute([$input['id']]);
        json_response(['ok' => true]);
        break;

    case 'admin.applications.list':
        require_super_admin($user);
        $rows = db()->query('SELECT id, app_key, name, category FROM applications WHERE enabled = 1 ORDER BY category, name')->fetchAll(PDO::FETCH_ASSOC);
        json_response($rows);
        break;

    case 'admin.permissions.get':
        require_super_admin($user);
        require_fields($input, ['userId']);

        $companies = db()->query('SELECT id, name FROM companies ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);
        $applications = db()->query('SELECT id, app_key, name, category FROM applications WHERE enabled = 1 ORDER BY category, name')->fetchAll(PDO::FETCH_ASSOC);
        $stmt = db()->prepare("
            SELECT c.id as company_id, a.app_key, r.role_key
            FROM user_companies uc
            JOIN companies c ON c.id = uc.company_id
            JOIN user_company_applications uca ON uca.user_company_id = uc.id
            JOIN applications a ON a.id = uca.application_id
            LEFT JOIN roles r ON r.id = uca.role_id
            WHERE uc.user_id = ?
        ");
        $stmt->execute([$input['userId']]);
        $assignments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        json_response(['companies' => $companies, 'applications' => $applications, 'assignments' => $assignments]);
        break;

    case 'admin.permissions.set':
        require_super_admin($user);
        require_fields($input, ['userId', 'companyId', 'applicationKey', 'roleKey']);
        $roleKey = in_array($input['roleKey'], ['ADMIN', 'SUPERVISOR', 'OPERATOR'], true) ? $input['roleKey'] : 'OPERATOR';

        $app = db()->prepare("SELECT id FROM applications WHERE app_key = ?");
        $app->execute([$input['applicationKey']]);
        $app = $app->fetch(PDO::FETCH_ASSOC);
        if (!$app) error_response('Applicazione non trovata', 404);
        $roleId = ensure_company_role(db(), $input['companyId'], $roleKey);

        $stmt = db()->prepare('SELECT id FROM user_companies WHERE user_id = ? AND company_id = ?');
        $stmt->execute([$input['userId'], $input['companyId']]);
        $uc = $stmt->fetch(PDO::FETCH_ASSOC);
        $ucId = $uc['id'] ?? null;
        if (!$ucId) {
            $ucId = new_id('uc');
            db()->prepare('INSERT INTO user_companies (id, user_id, company_id, role_id) VALUES (?, ?, ?, ?)')
                ->execute([$ucId, $input['userId'], $input['companyId'], $roleId]);
        }

        $stmt = db()->prepare('SELECT id FROM user_company_applications WHERE user_company_id = ? AND application_id = ?');
        $stmt->execute([$ucId, $app['id']]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            db()->prepare('UPDATE user_company_applications SET role_id = ? WHERE id = ?')->execute([$roleId, $existing['id']]);
        } else {
            db()->prepare('INSERT INTO user_company_applications (id, user_company_id, application_id, role_id) VALUES (?, ?, ?, ?)')
                ->execute([new_id('uca'), $ucId, $app['id'], $roleId]);
        }
        json_response(['ok' => true]);
        break;

    case 'admin.permissions.revoke':
        require_super_admin($user);
        require_fields($input, ['userId', 'companyId', 'applicationKey']);
        $app = db()->prepare("SELECT id FROM applications WHERE app_key = ?");
        $app->execute([$input['applicationKey']]);
        $app = $app->fetch(PDO::FETCH_ASSOC);
        if (!$app) error_response('Applicazione non trovata', 404);
        $stmt = db()->prepare('SELECT id FROM user_companies WHERE user_id = ? AND company_id = ?');
        $stmt->execute([$input['userId'], $input['companyId']]);
        $uc = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($uc) {
            db()->prepare('DELETE FROM user_company_applications WHERE user_company_id = ? AND application_id = ?')
                ->execute([$uc['id'], $app['id']]);
        }
        json_response(['ok' => true]);
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

// Trova il ruolo standard (ADMIN/SUPERVISOR/OPERATOR) per l'azienda, creandolo
// al volo se l'azienda non lo avesse ancora (es. azienda aggiunta dopo il seed).
function ensure_company_role(PDO $pdo, string $companyId, string $roleKey): string
{
    $names = ['ADMIN' => 'Amministratore Aziendale', 'SUPERVISOR' => 'Supervisore', 'OPERATOR' => 'Operatore'];
    $stmt = $pdo->prepare('SELECT id FROM roles WHERE company_id = ? AND role_key = ?');
    $stmt->execute([$companyId, $roleKey]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) return $row['id'];

    $id = new_id('role');
    $pdo->prepare('INSERT INTO roles (id, company_id, role_key, name, is_system) VALUES (?, ?, ?, ?, 1)')
        ->execute([$id, $companyId, $roleKey, $names[$roleKey] ?? $roleKey]);
    return $id;
}

function fetch_instance_detail(string $id, string $companyId, ?string $requestingUserId = null, ?string $requestingRoleKey = null): array
{
    $instance = fetch_instance_row($id, $companyId);

    $wStmt = db()->prepare('SELECT * FROM workflows WHERE id = ?');
    $wStmt->execute([$instance['workflow_id']]);
    $workflow = $wStmt->fetch(PDO::FETCH_ASSOC);

    $vStmt = db()->prepare('SELECT * FROM workflow_versions WHERE id = ?');
    $vStmt->execute([$instance['workflow_version_id']]);
    $version = $vStmt->fetch(PDO::FETCH_ASSOC);
    $nodes = json_decode($version['nodes_json'], true);
    $nodeById = [];
    foreach ($nodes as $n) $nodeById[$n['id']] = $n;

    $tStmt = db()->prepare('
        SELECT t.*, u.full_name as assigned_name FROM workflow_tasks t
        LEFT JOIN users u ON u.id = t.assigned_to_id
        WHERE t.instance_id = ? ORDER BY t.created_at ASC
    ');
    $tStmt->execute([$id]);
    $tasks = array_map(function ($t) use ($nodeById, $requestingUserId, $requestingRoleKey) {
        $node = $nodeById[$t['node_id']] ?? null;
        $canRead = ($node && $requestingRoleKey !== null)
            ? can_read_node($node, $requestingUserId ?? '', $requestingRoleKey)
            : true;
        return [
            'id' => $t['id'], 'nodeId' => $t['node_id'], 'nodeType' => $t['node_type'], 'nodeLabel' => $t['node_label'],
            'status' => $t['status'], 'assignedTo' => $t['assigned_name'] ? ['fullName' => $t['assigned_name']] : null,
            'createdAt' => $t['created_at'], 'resolvedAt' => $t['resolved_at'], 'canRead' => $canRead,
        ];
    }, $tStmt->fetchAll(PDO::FETCH_ASSOC));

    $cStmt = db()->prepare('
        SELECT c.*, u.full_name FROM workflow_comments c
        JOIN users u ON u.id = c.author_id
        WHERE c.instance_id = ? ORDER BY c.created_at ASC
    ');
    $cStmt->execute([$id]);
    $comments = array_map(fn($c) => [
        'id' => $c['id'], 'body' => $c['body'], 'createdAt' => $c['created_at'], 'nodeId' => $c['node_id'],
        'author' => ['fullName' => $c['full_name']],
    ], $cStmt->fetchAll(PDO::FETCH_ASSOC));

    $atStmt = db()->prepare('
        SELECT a.*, u.full_name FROM attachments a
        JOIN users u ON u.id = a.uploaded_by_id
        WHERE a.instance_id = ? ORDER BY a.created_at ASC
    ');
    $atStmt->execute([$id]);
    $attachments = array_map(fn($a) => [
        'id' => $a['id'], 'nodeId' => $a['node_id'], 'fileName' => $a['file_name'], 'mimeType' => $a['mime_type'],
        'size' => (int) $a['size'], 'createdAt' => $a['created_at'], 'uploadedBy' => ['fullName' => $a['full_name']],
    ], $atStmt->fetchAll(PDO::FETCH_ASSOC));

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
        'originInstanceId' => $instance['origin_instance_id'],
        'workflow' => ['id' => $workflow['id'], 'name' => $workflow['name']],
        'workflowVersion' => ['nodesJson' => $version['nodes_json'], 'edgesJson' => $version['edges_json']],
        'tasks' => $tasks, 'comments' => $comments, 'attachments' => $attachments, 'aiDecisions' => $aiDecisions, 'auditLogs' => $auditLogs,
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
