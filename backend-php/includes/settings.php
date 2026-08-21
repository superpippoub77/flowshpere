<?php
require_once __DIR__ . '/db.php';

function get_setting(string $key, $default = null)
{
    $stmt = db()->prepare('SELECT setting_value FROM settings WHERE setting_key = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return $default;
    $decoded = json_decode($row['setting_value'], true);
    return $decoded === null ? $default : $decoded;
}

function set_setting(string $key, $value): void
{
    $json = json_encode($value);
    $stmt = db()->prepare('SELECT setting_key FROM settings WHERE setting_key = ?');
    $stmt->execute([$key]);
    if ($stmt->fetch()) {
        db()->prepare('UPDATE settings SET setting_value = ? WHERE setting_key = ?')->execute([$json, $key]);
    } else {
        db()->prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)')->execute([$key, $json]);
    }
}
