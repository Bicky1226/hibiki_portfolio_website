<?php
declare(strict_types=1);

function startSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_set_cookie_params([
        'lifetime'  => 14400, // 4 hours
        'path'      => '/',
        'domain'    => '',
        'secure'    => $isSecure,
        'httponly'   => true,
        'samesite'  => 'Strict',
    ]);
    session_name('blog_sess');
    session_start();
}

function isAuthenticated(): bool
{
    startSession();
    return isset($_SESSION['blog_admin']) && $_SESSION['blog_admin'] === true;
}

function requireAuth(): void
{
    if (!isAuthenticated()) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'message' => 'Unauthorized'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

function getCsrfToken(): string
{
    startSession();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrf(): void
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals(getCsrfToken(), $token)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'message' => 'CSRF token mismatch'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
