<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

function start_session(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
        session_start();
    }
}

function login_user(string $email, string $password): array
{
    $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($password, $user['password_hash'])) {
        error_response('Credenziali non valide', 401);
    }

    $_SESSION['user_id'] = $user['id'];
    return [
        'id' => $user['id'],
        'email' => $user['email'],
        'fullName' => $user['full_name'],
        'isSuperAdmin' => (bool) $user['is_super_admin'],
        'hasAvatar' => !empty($user['avatar_path']),
    ];
}

function current_user(): array
{
    if (empty($_SESSION['user_id'])) {
        error_response('Sessione scaduta, effettua nuovamente l\'accesso', 401);
    }
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) error_response('Utente non trovato', 401);
    return $user;
}
