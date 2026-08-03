<?php
require_once __DIR__ . '/config.php';

// Cifra una stringa. Il risultato include IV e tag di autenticazione, tutto
// in un'unica stringa base64 pronta da salvare in un campo TEXT.
function encrypt_data(string $plaintext): string
{
    $key = hex2bin(encryption_key());
    $iv = random_bytes(12); // GCM: 12 byte e' lo standard
    $tag = '';
    $cipher = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return base64_encode($iv . $tag . $cipher);
}

// Decifra. Ritorna stringa vuota se il valore non e' cifrato (compatibilita'
// con dati creati prima di questa modifica) o se la decifratura fallisce.
function decrypt_data(?string $encoded): string
{
    if ($encoded === null || $encoded === '') return '';
    $raw = base64_decode($encoded, true);
    if ($raw === false || strlen($raw) < 28) return $encoded; // non sembra cifrato: ritorna cosi' com'e'

    $key = hex2bin(encryption_key());
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $cipher = substr($raw, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return $plain === false ? $encoded : $plain;
}

// Varianti binarie (nessun base64): usate per i file su disco, per non
// gonfiare le dimensioni di ~33% come farebbe la variante testuale.
function encrypt_bytes(string $data): string
{
    $key = hex2bin(encryption_key());
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($data, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return $iv . $tag . $cipher;
}

function decrypt_bytes(string $raw): string
{
    if (strlen($raw) < 28) return $raw;
    $key = hex2bin(encryption_key());
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $cipher = substr($raw, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return $plain === false ? $raw : $plain;
}
