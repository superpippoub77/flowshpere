<?php
require_once __DIR__ . '/db.php';

function log_audit(?string $companyId, ?string $userId, ?string $instanceId, string $action, $previousValue = null, $newValue = null): void
{
    $stmt = db()->prepare('
        INSERT INTO audit_logs (id, company_id, user_id, instance_id, action, previous_value, new_value, ip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        new_id('log'),
        $companyId,
        $userId,
        $instanceId,
        $action,
        $previousValue !== null ? json_encode($previousValue, JSON_UNESCAPED_UNICODE) : null,
        $newValue !== null ? json_encode($newValue, JSON_UNESCAPED_UNICODE) : null,
        $_SERVER['REMOTE_ADDR'] ?? null,
    ]);
}
