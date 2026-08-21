<?php
// Due modalita', in base al parametro "action" in querystring:
//   ?action=start&provider=google   -> reindirizza l'utente al consenso del provider
//   ?action=callback&provider=...&code=...&state=...  -> il provider torna qui dopo il consenso
//
// Il redirect_uri usato con Google/Facebook deve essere ESATTAMENTE questo
// file (es. https://tuodominio/progetto/api/oauth.php), configurato anche
// lato Google/Facebook Console quando si registra l'app OAuth.

require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/settings.php';
require_once __DIR__ . '/includes/crypto.php';
require_once __DIR__ . '/includes/oauth.php';
require_once __DIR__ . '/includes/auth.php';

start_session();

$action = $_GET['action'] ?? '';
$provider = $_GET['provider'] ?? '';
$redirectUri = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'];

// Dove riportare il browser nell'app dopo il login (la SPA, non questo script).
function app_base_url(): string
{
    // .../progetto/api/oauth.php -> .../progetto/
    $path = preg_replace('#api/oauth\.php$#', '', $_SERVER['SCRIPT_NAME']);
    return (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . $path;
}

if ($action === 'start') {
    if (!in_array($provider, ['google', 'facebook'], true)) {
        http_response_code(400);
        echo 'Provider non valido';
        exit;
    }
    $config = get_setting('oauth_' . $provider, []);
    if (empty($config['enabled']) || empty($config['clientId'])) {
        http_response_code(400);
        echo 'Questo provider non e\' configurato';
        exit;
    }
    $state = bin2hex(random_bytes(16));
    $_SESSION['oauth_state'] = $state;
    $url = oauth_authorize_url($provider, $config['clientId'], $redirectUri, $state);
    header('Location: ' . $url);
    exit;
}

if ($action === 'callback') {
    $code = $_GET['code'] ?? '';
    $state = $_GET['state'] ?? '';

    if (empty($code) || empty($state) || !isset($_SESSION['oauth_state']) || !hash_equals($_SESSION['oauth_state'], $state)) {
        header('Location: ' . app_base_url() . '#/login?oauth_error=1');
        exit;
    }
    unset($_SESSION['oauth_state']);

    $profile = oauth_fetch_profile($provider, $code, $redirectUri);
    if (!$profile) {
        header('Location: ' . app_base_url() . '#/login?oauth_error=1');
        exit;
    }

    $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$profile['email']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        // Primo accesso con questo provider: crea un account "Utente" senza
        // alcuna azienda assegnata. Un Amministratore dovra' comunque
        // concedergli l'accesso a un'azienda dalla pagina Permessi.
        $newId = new_id('user');
        db()->prepare('INSERT INTO users (id, email, password_hash, full_name, is_super_admin, user_type) VALUES (?, ?, ?, ?, 0, ?)')
            ->execute([$newId, $profile['email'], password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT), $profile['name'], 'UTENTE']);
        $_SESSION['user_id'] = $newId;
    } else {
        $_SESSION['user_id'] = $user['id'];
    }

    header('Location: ' . app_base_url() . '#/workflow/dashboard');
    exit;
}

http_response_code(400);
echo 'Richiesta non valida';
