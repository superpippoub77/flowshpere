<?php
require_once __DIR__ . '/config.php';

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string
{
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}

// Crea un JWT firmato HS256. $expSeconds = null significa nessuna scadenza
// (usato per le API key emesse agli esterni, revocabili tramite jti nel DB).
function jwt_encode(array $payload, ?int $expSeconds = null): string
{
    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['iat'] = time();
    if ($expSeconds !== null) $payload['exp'] = time() + $expSeconds;
    $payloadEncoded = base64url_encode(json_encode($payload));
    $signature = base64url_encode(hash_hmac('sha256', "$header.$payloadEncoded", jwt_secret(), true));
    return "$header.$payloadEncoded.$signature";
}

// Verifica firma e scadenza. Ritorna il payload o null se il token non e' valido.
function jwt_decode(string $token): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $signature] = $parts;

    $expected = base64url_encode(hash_hmac('sha256', "$header.$payload", jwt_secret(), true));
    if (!hash_equals($expected, $signature)) return null;

    $data = json_decode(base64url_decode($payload), true);
    if (!is_array($data)) return null;
    if (isset($data['exp']) && $data['exp'] < time()) return null;

    return $data;
}
