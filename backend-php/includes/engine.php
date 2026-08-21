<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/crypto.php';
require_once __DIR__ . '/mailer.php';

// Se il responsabile di uno step e' impostato esattamente su "AI", il passo
// si risolve da solo (nessun umano deve intervenire).
function is_ai_responsible(array $node): bool
{
    $ids = $node['data']['config']['responsibleUserIds'] ?? [];
    return count($ids) === 1 && $ids[0] === 'AI';
}

// Crea una nuova istanza (workflow pubblicato), con dati iniziali opzionali
// (es. da un ordine esterno gia' pronto) e un riferimento opzionale
// all'istanza di origine (concatenamento tra workflow). Ritorna
// ['id'=>..., 'code'=>...] oppure ['error'=>...].
function create_instance(string $companyId, string $workflowId, string $createdByUserId, array $initialData = [], ?string $originInstanceId = null): array
{
    $stmt = db()->prepare('SELECT * FROM workflows WHERE id = ? AND company_id = ? AND status = "PUBLISHED"');
    $stmt->execute([$workflowId, $companyId]);
    $w = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$w) return ['error' => 'Workflow pubblicato non trovato'];

    $vStmt = db()->prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC LIMIT 1');
    $vStmt->execute([$w['id']]);
    $version = $vStmt->fetch(PDO::FETCH_ASSOC);
    if (!$version) return ['error' => 'Nessuna versione pubblicata'];

    $cStmt = db()->prepare('SELECT COUNT(*) as c FROM workflow_instances wi JOIN workflows w2 ON w2.id = wi.workflow_id WHERE w2.company_id = ?');
    $cStmt->execute([$companyId]);
    $count = (int) $cStmt->fetch(PDO::FETCH_ASSOC)['c'];
    $code = 'Richiesta #' . (1000 + $count + 1);

    $id = new_id('inst');
    db()->prepare('
        INSERT INTO workflow_instances (id, workflow_id, workflow_version_id, code, data_json, origin_instance_id, created_by_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, "BOZZA")
    ')->execute([$id, $w['id'], $version['id'], $code, encrypt_data(json_encode($initialData)), $originInstanceId, $createdByUserId]);

    log_audit($companyId, $createdByUserId, $id, 'Creazione istanza "' . $code . '"' . ($originInstanceId ? ' (collegata automaticamente da un workflow precedente)' : ''));
    advance_instance($id);
    return ['id' => $id, 'code' => $code];
}

function find_outgoing(array $edges, string $nodeId, ?string $handle = null): ?array
{
    if ($handle) {
        foreach ($edges as $e) {
            if ($e['source'] === $nodeId && ($e['sourceHandle'] ?? null) === $handle) return $e;
        }
    }
    foreach ($edges as $e) {
        if ($e['source'] === $nodeId) return $e;
    }
    return null;
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

// Trova l'arco che porta AL nodo indicato (per tornare al passo precedente in caso di rifiuto)
function find_incoming(array $edges, string $nodeId): ?array
{
    foreach ($edges as $e) {
        if ($e['target'] === $nodeId) return $e;
    }
    return null;
}

// In caso di rifiuto: non si va avanti, si torna al passo precedente
// REALMENTE azionabile da un umano (form/upload/approval/ai) e lo si riapre
// per una nuova iterazione. Se nel mezzo ci sono nodi automatici (decisione
// automatica, email, webhook, commento) li salta, perche' nessuno puo'
// "risolverli" manualmente: verranno ricalcolati da soli quando il flusso
// ripassera' di li'.
function send_back(string $instanceId): void
{
    $stmt = db()->prepare('
        SELECT wi.current_node_id, wv.nodes_json, wv.edges_json
        FROM workflow_instances wi
        JOIN workflow_versions wv ON wv.id = wi.workflow_version_id
        WHERE wi.id = ?
    ');
    $stmt->execute([$instanceId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || !$row['current_node_id']) return;

    $edges = json_decode($row['edges_json'], true);
    $nodes = json_decode($row['nodes_json'], true);
    $findNode = function (string $id) use ($nodes) {
        foreach ($nodes as $n) if ($n['id'] === $id) return $n;
        return null;
    };

    $actionable = ['form', 'upload', 'approval', 'ai'];
    $cursor = $row['current_node_id'];
    $guard = 0;
    $prevNode = null;

    while ($guard < 50) {
        $guard++;
        $incoming = find_incoming($edges, $cursor);
        if (!$incoming) break;
        $candidate = $findNode($incoming['source']);
        if (!$candidate) break;
        if (in_array($candidate['type'], $actionable, true)) { $prevNode = $candidate; break; }
        $cursor = $candidate['id'];
    }

    if (!$prevNode) return;

    ensure_task($instanceId, $prevNode);
    $status = $prevNode['type'] === 'form' ? 'IN_CORSO' : 'IN_ATTESA';
    set_current_node($instanceId, $prevNode['id'], $status);
}

function evaluate_rule(?array $rule, array $data): bool
{
    if (empty($rule['field'])) return true;
    $value = floatval($data[$rule['field']] ?? 0);
    $target = floatval($rule['value'] ?? 0);
    switch ($rule['operator'] ?? 'gt') {
        case 'gt': return $value > $target;
        case 'gte': return $value >= $target;
        case 'lt': return $value < $target;
        case 'lte': return $value <= $target;
        case 'eq': return $value === $target;
        default: return true;
    }
}

function ensure_task(string $instanceId, array $node): void
{
    // Se esiste gia' un task APERTO per questo nodo, non farne un altro.
    $stmt = db()->prepare('SELECT id FROM workflow_tasks WHERE instance_id = ? AND node_id = ? AND status = "APERTO"');
    $stmt->execute([$instanceId, $node['id']]);
    if ($stmt->fetch()) return;

    // Altrimenti crea sempre un nuovo task (anche se il nodo era gia' stato
    // completato in un passaggio precedente): serve per gestire i ritorni
    // indietro dopo un rifiuto, mantenendo la storia dei tentativi passati.
    db()->prepare('
        INSERT INTO workflow_tasks (id, instance_id, node_id, node_type, node_label, status)
        VALUES (?, ?, ?, ?, ?, "APERTO")
    ')->execute([new_id('task'), $instanceId, $node['id'], $node['type'], $node['data']['label'] ?? $node['type']]);
}

function set_current_node(string $instanceId, ?string $nodeId, string $status): void
{
    db()->prepare('UPDATE workflow_instances SET current_node_id = ?, status = ?, updated_at = datetime("now") WHERE id = ?')
        ->execute([$nodeId, $status, $instanceId]);
}

// Avanza automaticamente su tutti i nodi "di passaggio" finche' non trova un nodo
// che richiede intervento umano (form, approval, upload) o la fine del processo.
function advance_instance(string $instanceId): void
{
    $stmt = db()->prepare('
        SELECT wi.*, wv.nodes_json, wv.edges_json, w.company_id
        FROM workflow_instances wi
        JOIN workflow_versions wv ON wv.id = wi.workflow_version_id
        JOIN workflows w ON w.id = wi.workflow_id
        WHERE wi.id = ?
    ');
    $stmt->execute([$instanceId]);
    $instance = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$instance) return;

    $nodes = json_decode($instance['nodes_json'], true);
    $edges = json_decode($instance['edges_json'], true);
    $data = json_decode(decrypt_data($instance['data_json']), true) ?: [];
    $companyId = $instance['company_id'];

    $findNode = function (?string $id) use ($nodes) {
        if (!$id) return null;
        foreach ($nodes as $n) if ($n['id'] === $id) return $n;
        return null;
    };

    $currentId = $instance['current_node_id'];
    if (!$currentId) {
        foreach ($nodes as $n) if ($n['type'] === 'start') { $currentId = $n['id']; break; }
    }

    $guard = 0;
    while ($currentId && $guard < 50) {
        $guard++;
        $node = $findNode($currentId);
        if (!$node) break;
        $type = $node['type'];

        if ($type === 'start') {
            $next = find_outgoing($edges, $node['id']);
            $currentId = $next['target'] ?? null;
            continue;
        }

        if ($type === 'form') {
            $fields = $node['data']['config']['fields'] ?? [];
            $allProvided = count($fields) > 0;
            foreach ($fields as $f) {
                if (!isset($data[$f['id']]) || $data[$f['id']] === '') { $allProvided = false; break; }
            }
            if ($allProvided) {
                log_audit($companyId, null, $instanceId, 'Form "' . ($node['data']['label'] ?? '') . '" gia\' compilato dai dati forniti (es. da un ordine esterno)');
                $next = find_outgoing($edges, $node['id']);
                $currentId = $next['target'] ?? null;
                continue;
            }
            ensure_task($instanceId, $node);
            set_current_node($instanceId, $node['id'], 'IN_CORSO');
            return;
        }

        if ($type === 'upload') {
            if (is_ai_responsible($node)) {
                log_audit($companyId, null, $instanceId, 'Allegato simulato automaticamente dall\'AI per "' . ($node['data']['label'] ?? '') . '"');
                $next = find_outgoing($edges, $node['id']);
                $currentId = $next['target'] ?? null;
                continue;
            }
            ensure_task($instanceId, $node);
            set_current_node($instanceId, $node['id'], 'IN_ATTESA');
            return;
        }

        if ($type === 'approval') {
            if (is_ai_responsible($node)) {
                $confidence = round((0.7 + (mt_rand() / mt_getrandmax()) * 0.3), 2);
                $decision = $confidence > 0.5 ? 'approve' : 'reject';
                db()->prepare('
                    INSERT INTO ai_decisions (id, instance_id, node_id, suggestion, confidence, auto_applied, reasoning)
                    VALUES (?, ?, ?, ?, ?, 1, ?)
                ')->execute([new_id('ai'), $instanceId, $node['id'], $decision === 'approve' ? 'APPROVA' : 'RIFIUTA', $confidence, 'Decisione automatica AI (nodo impostato con responsabile AI).']);
                log_audit($companyId, null, $instanceId, 'AI decide su "' . ($node['data']['label'] ?? '') . '": ' . ($decision === 'approve' ? 'Approvato' : 'Rifiutato') . ' (confidenza ' . round($confidence * 100) . '%)');
                if ($decision === 'approve') {
                    $next = find_outgoing($edges, $node['id'], 'approve');
                    $currentId = $next['target'] ?? null;
                    continue;
                }
                set_current_node($instanceId, $node['id'], 'IN_ATTESA');
                send_back($instanceId);
                return;
            }
            ensure_task($instanceId, $node);
            set_current_node($instanceId, $node['id'], 'IN_ATTESA');
            return;
        }

        if ($type === 'autoDecision') {
            $rule = $node['data']['config']['rule'] ?? null;
            $passes = evaluate_rule($rule, $data);
            log_audit($companyId, null, $instanceId, 'Decisione automatica "' . ($node['data']['label'] ?? '') . '": ' . ($passes ? 'condizione vera' : 'condizione falsa'));
            $next = find_outgoing($edges, $node['id'], $passes ? 'approve' : 'reject');
            $currentId = $next['target'] ?? null;
            continue;
        }

        if ($type === 'ai') {
            $confidence = round((0.7 + (mt_rand() / mt_getrandmax()) * 0.3), 2);
            $suggestion = $confidence > 0.5 ? 'APPROVA' : 'RICHIEDI_REVISIONE';
            $autoApplied = $confidence > 0.9;
            db()->prepare('
                INSERT INTO ai_decisions (id, instance_id, node_id, suggestion, confidence, auto_applied, reasoning)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ')->execute([new_id('ai'), $instanceId, $node['id'], $suggestion, $confidence, $autoApplied ? 1 : 0, 'Valutazione automatica basata sui dati raccolti (demo).']);
            log_audit($companyId, null, $instanceId, 'AI valuta "' . ($node['data']['label'] ?? '') . '": ' . $suggestion . ' (confidenza ' . round($confidence * 100) . '%)');

            if ($autoApplied) {
                $next = find_outgoing($edges, $node['id'], 'approve');
                $currentId = $next['target'] ?? null;
                continue;
            }
            ensure_task($instanceId, $node);
            set_current_node($instanceId, $node['id'], 'IN_ATTESA');
            return;
        }

        if ($type === 'email') {
            $label = $node['data']['label'] ?? 'Notifica';
            $body = $node['data']['config']['template'] ?? 'Aggiornamento sul processo in corso.';

            db()->prepare('
                INSERT INTO notifications (id, company_id, user_id, channel, title, body)
                VALUES (?, ?, ?, "email", ?, ?)
            ')->execute([new_id('notif'), $companyId, $instance['created_by_id'], $label, $body]);

            $uStmt = db()->prepare('SELECT email FROM users WHERE id = ?');
            $uStmt->execute([$instance['created_by_id']]);
            $recipient = $uStmt->fetch(PDO::FETCH_ASSOC)['email'] ?? null;

            if ($recipient) {
                $result = send_mail($recipient, $label, $body);
                if ($result['simulated']) {
                    log_audit($companyId, null, $instanceId, 'Email simulata (SMTP non configurato): "' . $label . '"');
                } elseif ($result['sent']) {
                    log_audit($companyId, null, $instanceId, 'Email inviata a ' . $recipient . ': "' . $label . '"');
                } else {
                    log_audit($companyId, null, $instanceId, 'Email NON inviata a ' . $recipient . ' (' . $result['error'] . '): "' . $label . '"');
                }
            } else {
                log_audit($companyId, null, $instanceId, 'Email simulata (nessun destinatario): "' . $label . '"');
            }

            $next = find_outgoing($edges, $node['id']);
            $currentId = $next['target'] ?? null;
            continue;
        }

        if ($type === 'webhook') {
            log_audit($companyId, null, $instanceId, 'Chiamata webhook simulata: "' . ($node['data']['label'] ?? '') . '"');
            $next = find_outgoing($edges, $node['id']);
            $currentId = $next['target'] ?? null;
            continue;
        }

        if ($type === 'comment') {
            $next = find_outgoing($edges, $node['id']);
            $currentId = $next['target'] ?? null;
            continue;
        }

        if ($type === 'end') {
            db()->prepare('UPDATE workflow_instances SET status = "COMPLETATO", current_node_id = ?, updated_at = datetime("now") WHERE id = ?')
                ->execute([$node['id'], $instanceId]);
            log_audit($companyId, null, $instanceId, 'Processo completato');

            $nextWorkflowId = $node['data']['config']['nextWorkflowId'] ?? null;
            if ($nextWorkflowId) {
                $result = create_instance($companyId, $nextWorkflowId, $instance['created_by_id'], $data, $instanceId);
                if (!isset($result['error'])) {
                    log_audit($companyId, null, $instanceId, 'Collegato automaticamente al workflow successivo: "' . $result['code'] . '"');
                }
            }
            return;
        }

        break;
    }
}

// Trova l'arco uscente da $nodeId (con eventuale $handle) e avanza da li'
function advance_from(string $instanceId, ?string $nodeId, ?string $handle): void
{
    if (!$nodeId) { advance_instance($instanceId); return; }

    $stmt = db()->prepare('SELECT wv.edges_json FROM workflow_instances wi JOIN workflow_versions wv ON wv.id = wi.workflow_version_id WHERE wi.id = ?');
    $stmt->execute([$instanceId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return;

    $edges = json_decode($row['edges_json'], true);
    $next = find_outgoing($edges, $nodeId, $handle);

    db()->prepare('UPDATE workflow_instances SET current_node_id = ? WHERE id = ?')
        ->execute([$next['target'] ?? null, $instanceId]);

    advance_instance($instanceId);
}
