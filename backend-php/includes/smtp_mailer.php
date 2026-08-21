<?php
// Client SMTP scritto da zero: parla il protocollo SMTP direttamente via
// socket (fsockopen), senza dipendenze esterne (niente Composer/PHPMailer
// disponibili su questo hosting). Supporta connessione in chiaro, SSL
// implicito (porta 465) e STARTTLS (porta 587), con autenticazione AUTH LOGIN.
class SmtpMailer
{
    private $socket;
    private array $config;
    public string $lastError = '';

    public function __construct(array $config)
    {
        $this->config = $config;
    }

    private function readResponse(): string
    {
        $data = '';
        while ($line = fgets($this->socket, 515)) {
            $data .= $line;
            // Le righe di continuazione hanno un trattino dopo il codice (es. "250-"),
            // l'ultima riga ha uno spazio (es. "250 ").
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $data;
    }

    private function command(string $cmd, int $expectedCode): string
    {
        fwrite($this->socket, $cmd . "\r\n");
        $response = $this->readResponse();
        $code = (int) substr($response, 0, 3);
        if ($code !== $expectedCode) {
            throw new Exception("Risposta SMTP inattesa a \"$cmd\": $response");
        }
        return $response;
    }

    // Invia una singola email. Ritorna true/false; in caso di errore il
    // dettaglio e' in $this->lastError.
    public function send(string $toEmail, string $subject, string $bodyText): bool
    {
        try {
            $host = $this->config['host'];
            $port = (int) ($this->config['port'] ?? 587);
            $encryption = $this->config['encryption'] ?? 'tls'; // none | ssl | tls

            $transport = $encryption === 'ssl' ? 'ssl://' : '';
            $this->socket = @fsockopen($transport . $host, $port, $errno, $errstr, 10);
            if (!$this->socket) throw new Exception("Impossibile connettersi a $host:$port ($errstr)");

            $this->readResponse(); // saluto 220
            $this->command('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'), 250);

            if ($encryption === 'tls') {
                $this->command('STARTTLS', 220);
                if (!stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new Exception('Impossibile avviare TLS');
                }
                $this->command('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'), 250);
            }

            if (!empty($this->config['username'])) {
                $this->command('AUTH LOGIN', 334);
                $this->command(base64_encode($this->config['username']), 334);
                $this->command(base64_encode($this->config['password'] ?? ''), 235);
            }

            $fromEmail = $this->config['fromEmail'] ?? $this->config['username'] ?? 'noreply@example.com';
            $fromName = $this->config['fromName'] ?? '';

            $this->command('MAIL FROM:<' . $fromEmail . '>', 250);
            $this->command('RCPT TO:<' . $toEmail . '>', 250);
            $this->command('DATA', 354);

            $headers = [];
            $headers[] = 'From: ' . ($fromName ? "\"$fromName\" <$fromEmail>" : $fromEmail);
            $headers[] = 'To: <' . $toEmail . '>';
            $headers[] = 'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=';
            $headers[] = 'MIME-Version: 1.0';
            $headers[] = 'Content-Type: text/plain; charset=UTF-8';
            $headers[] = 'Date: ' . date('r');

            // Le righe che iniziano con "." vanno raddoppiate per non essere
            // scambiate per il terminatore del messaggio.
            $escapedBody = preg_replace('/^\./m', '..', $bodyText);
            $message = implode("\r\n", $headers) . "\r\n\r\n" . $escapedBody . "\r\n.";
            $this->command($message, 250);

            fwrite($this->socket, "QUIT\r\n");
            fclose($this->socket);
            return true;
        } catch (Exception $e) {
            $this->lastError = $e->getMessage();
            if ($this->socket) { @fclose($this->socket); }
            return false;
        }
    }
}
