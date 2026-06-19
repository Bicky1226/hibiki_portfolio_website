<?php
declare(strict_types=1);

/*
 * auth.example.php — template for auth.php
 * ---------------------------------------------------------------
 * The real auth.php is intentionally NOT committed (see .gitignore),
 * because it holds the bcrypt hash of the blog admin password.
 *
 * Setup:
 *   1. Copy this file to auth.php (same directory).
 *   2. Generate a bcrypt hash of your chosen password:
 *        php -r "echo password_hash('your-password', PASSWORD_BCRYPT), PHP_EOL;"
 *   3. Paste the result into ADMIN_PASS_HASH below.
 */

require_once __DIR__ . '/../lib/session.php';
require_once __DIR__ . '/../lib/helpers.php';

// Bcrypt hash of the admin password — replace with your own.
define('ADMIN_PASS_HASH', '$2y$10$REPLACE_THIS_WITH_YOUR_OWN_BCRYPT_HASH______________________');

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];

// ---- GET: check session ----
if ($method === 'GET' && ($_GET['action'] ?? '') === 'check') {
    startSession();
    jsonResponse([
        'ok'            => true,
        'authenticated' => isAuthenticated(),
        'csrf_token'    => getCsrfToken(),
    ]);
}

// ---- POST: login / logout ----
if ($method !== 'POST') {
    jsonResponse(['ok' => false, 'message' => 'Method not allowed'], 405);
}

startSession();

// Read action from JSON body for POST requests
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? $_POST['action'] ?? '';

if ($action === 'login') {
    $password = $input['password'] ?? '';

    if (!password_verify($password, ADMIN_PASS_HASH)) {
        jsonResponse(['ok' => false, 'message' => 'Invalid password'], 401);
    }

    // Regenerate session on login
    session_regenerate_id(true);
    $_SESSION['blog_admin'] = true;
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

    jsonResponse([
        'ok'         => true,
        'csrf_token' => $_SESSION['csrf_token'],
    ]);
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    jsonResponse(['ok' => true]);
}

jsonResponse(['ok' => false, 'message' => 'Unknown action'], 400);
