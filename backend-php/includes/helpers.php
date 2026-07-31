<?php

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function error_response(string $message, int $status = 400): void
{
    json_response(['error' => $message], $status);
}

function require_fields(array $data, array $fields): void
{
    foreach ($fields as $f) {
        if (!array_key_exists($f, $data) || $data[$f] === '' || $data[$f] === null) {
            error_response("Campo obbligatorio mancante: $f", 400);
        }
    }
}

// Salva un'immagine profilo (base64) su disco e ritorna il nome file da salvare in DB
function save_avatar(string $dataBase64, string $mimeType): ?string
{
    $binary = base64_decode($dataBase64, true);
    if ($binary === false || strlen($binary) > 2 * 1024 * 1024) return null;
    $ext = 'jpg';
    if (strpos($mimeType, 'png') !== false) $ext = 'png';
    if (strpos($mimeType, 'webp') !== false) $ext = 'webp';
    if (strpos($mimeType, 'gif') !== false) $ext = 'gif';

    $dir = __DIR__ . '/../data/avatars';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $name = new_id('avatar') . '.' . $ext;
    file_put_contents($dir . '/' . $name, $binary);
    return $name;
}
