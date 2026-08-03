<?php
// Chiavi persistenti generate al primo avvio e riusate sempre dopo (cosi' i
// token gia' emessi e i dati gia' cifrati restano validi tra un deploy e l'altro).

function get_or_create_secret(string $filename, int $bytes = 32): string
{
    $dir = __DIR__ . '/../data';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $path = $dir . '/' . $filename;
    if (file_exists($path)) {
        return trim(file_get_contents($path));
    }
    $secret = bin2hex(random_bytes($bytes));
    file_put_contents($path, $secret);
    chmod($path, 0600);
    return $secret;
}

function jwt_secret(): string
{
    return get_or_create_secret('jwt_secret.key');
}

function encryption_key(): string
{
    return get_or_create_secret('encryption.key');
}
