<?php
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/auth.php';

start_session();
current_user(); // richiede solo di essere loggati

$userId = $_GET['userId'] ?? '';
if (!$userId) error_response('Parametro mancante', 400);

$stmt = db()->prepare('SELECT avatar_path FROM users WHERE id = ?');
$stmt->execute([$userId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$row || !$row['avatar_path']) error_response('Nessun avatar', 404);

$path = __DIR__ . '/data/avatars/' . $row['avatar_path'];
if (!file_exists($path)) error_response('File non trovato', 404);

$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$mime = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'][$ext] ?? 'application/octet-stream';

header('Content-Type: ' . $mime);
header('Cache-Control: private, max-age=300');
readfile($path);
exit;
