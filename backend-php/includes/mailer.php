<?php
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/crypto.php';
require_once __DIR__ . '/smtp_mailer.php';

// Ritorna ['sent' => bool, 'simulated' => bool, 'error' => ?string]
// Se non e' stata configurata alcuna SMTP, l'invio resta "simulato" (solo
// loggato) esattamente come si comportava il nodo email prima di questa
// funzionalita' — nessuna regressione per chi non configura nulla.
function send_mail(string $toEmail, string $subject, string $bodyText): array
{
    $config = get_setting('mail_smtp');
    if (empty($config['host'])) {
        return ['sent' => false, 'simulated' => true, 'error' => null];
    }

    $plainConfig = $config;
    if (!empty($config['password'])) {
        $plainConfig['password'] = decrypt_data($config['password']);
    }

    $mailer = new SmtpMailer($plainConfig);
    $ok = $mailer->send($toEmail, $subject, $bodyText);
    return ['sent' => $ok, 'simulated' => false, 'error' => $ok ? null : $mailer->lastError];
}
