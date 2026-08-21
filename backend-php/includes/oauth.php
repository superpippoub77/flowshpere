<?php
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/crypto.php';

const OAUTH_PROVIDERS = [
    'google' => [
        'authorizeUrl' => 'https://accounts.google.com/o/oauth2/v2/auth',
        'tokenUrl' => 'https://oauth2.googleapis.com/token',
        'userInfoUrl' => 'https://www.googleapis.com/oauth2/v3/userinfo',
        'scope' => 'openid email profile',
    ],
    'facebook' => [
        'authorizeUrl' => 'https://www.facebook.com/v19.0/dialog/oauth',
        'tokenUrl' => 'https://graph.facebook.com/v19.0/oauth/access_token',
        'userInfoUrl' => 'https://graph.facebook.com/me?fields=id,name,email',
        'scope' => 'email public_profile',
    ],
];

// Esegue una richiesta HTTP semplice (GET o POST con corpo url-encoded) senza
// dipendenze esterne: usa curl se disponibile, altrimenti stream context.
function http_request(string $url, array $postFields = [], array $headers = []): ?array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        if (!empty($postFields)) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postFields));
        }
        if (!empty($headers)) curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $body = curl_exec($ch);
        curl_close($ch);
    } else {
        $opts = ['http' => ['header' => implode("\r\n", array_merge($headers, ['Accept: application/json'])), 'timeout' => 15]];
        if (!empty($postFields)) {
            $opts['http']['method'] = 'POST';
            $opts['http']['content'] = http_build_query($postFields);
            $opts['http']['header'] .= "\r\nContent-Type: application/x-www-form-urlencoded";
        }
        $body = @file_get_contents($url, false, stream_context_create($opts));
    }
    if ($body === false || $body === null) return null;
    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : null;
}

function oauth_authorize_url(string $provider, string $clientId, string $redirectUri, string $state): ?string
{
    if (!isset(OAUTH_PROVIDERS[$provider])) return null;
    $cfg = OAUTH_PROVIDERS[$provider];
    $params = [
        'client_id' => $clientId, 'redirect_uri' => $redirectUri, 'response_type' => 'code',
        'scope' => $cfg['scope'], 'state' => $state,
    ];
    return $cfg['authorizeUrl'] . '?' . http_build_query($params);
}

// Scambia il code con un access token e recupera email/nome dal provider.
// Ritorna ['email'=>..., 'name'=>...] oppure null se qualcosa fallisce.
function oauth_fetch_profile(string $provider, string $code, string $redirectUri): ?array
{
    if (!isset(OAUTH_PROVIDERS[$provider])) return null;
    $config = get_setting('oauth_' . $provider, []);
    if (empty($config['clientId']) || empty($config['clientSecret'])) return null;

    $cfg = OAUTH_PROVIDERS[$provider];
    $clientSecret = decrypt_data($config['clientSecret']);

    $tokenResponse = http_request($cfg['tokenUrl'], [
        'client_id' => $config['clientId'], 'client_secret' => $clientSecret,
        'code' => $code, 'redirect_uri' => $redirectUri, 'grant_type' => 'authorization_code',
    ]);
    if (!$tokenResponse || empty($tokenResponse['access_token'])) return null;

    $userInfoUrl = $cfg['userInfoUrl'];
    $sep = strpos($userInfoUrl, '?') === false ? '?' : '&';
    $profile = http_request($userInfoUrl . $sep . 'access_token=' . urlencode($tokenResponse['access_token']));
    if (!$profile || empty($profile['email'])) return null;

    return ['email' => $profile['email'], 'name' => $profile['name'] ?? $profile['email']];
}
