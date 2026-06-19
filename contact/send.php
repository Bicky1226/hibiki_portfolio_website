<?php
/**
 * send.php — Contact form mailer
 * hibikishimizu.com
 *
 * - Honeypot spam guard
 * - Basic input validation
 * - mb_send_mail via xserver SMTP
 * - Auto-reply to sender
 * - JSON response for AJAX
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

// -----------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------
const OWNER_EMAIL   = 'hibiki.shimizu.jp@gmail.com';
const OWNER_NAME    = '志水響 / Hibiki Shimizu';
const SITE_NAME     = 'hibikishimizu.com';
const ALLOWED_ORIGINS = ['https://hibikishimizu.com'];

// -----------------------------------------------------------------------
// CORS — only accept from own domain
// -----------------------------------------------------------------------
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ALLOWED_ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// -----------------------------------------------------------------------
// Only accept POST
// -----------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed.']);
    exit;
}

// -----------------------------------------------------------------------
// Honeypot check
// -----------------------------------------------------------------------
if (!empty($_POST['website'])) {
    // Silent success to confuse bots
    echo json_encode(['ok' => true]);
    exit;
}

// -----------------------------------------------------------------------
// Timestamp check — block submissions faster than 3s or older than 1h
// -----------------------------------------------------------------------
$t       = (int)($_POST['_t'] ?? 0);
$elapsed = (int)(microtime(true) * 1000) - $t;
if ($t === 0 || $elapsed < 3000 || $elapsed > 3600000) {
    // Silent success to confuse bots
    echo json_encode(['ok' => true]);
    exit;
}

// -----------------------------------------------------------------------
// Sanitise & validate inputs
// -----------------------------------------------------------------------
function clean(string $v): string {
    return htmlspecialchars(strip_tags(trim($v)), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$name     = clean($_POST['name']     ?? '');
$email    = trim($_POST['email']     ?? '');
$subject  = clean($_POST['subject']  ?? '');
$category = clean($_POST['category'] ?? '');
$message  = clean($_POST['message']  ?? '');

$errors = [];

if (mb_strlen($name) < 1) {
    $errors[] = 'name';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'email';
}
if (mb_strlen($subject) < 1) {
    $errors[] = 'subject';
}
if (mb_strlen($message) < 5) {
    $errors[] = 'message';
}

if (!empty($errors)) {
    http_response_code(422);
    echo json_encode([
        'ok'     => false,
        'errors' => $errors,
        'message' => 'Validation failed. Please check the highlighted fields.'
    ]);
    exit;
}

// -----------------------------------------------------------------------
// Category label map
// -----------------------------------------------------------------------
$categoryLabels = [
    'web_dev'       => 'Web開発の依頼 / Web Development',
    'consulting'    => '技術相談 / Technical Consulting',
    'collaboration' => 'コラボレーション / Collaboration',
    'other'         => 'その他 / Other',
];
$categoryLabel = $categoryLabels[$category] ?? $category;

// -----------------------------------------------------------------------
// Build owner notification email
// -----------------------------------------------------------------------
$ownerSubject = '[hibikishimizu.com] お問い合わせ: ' . $subject;

$ownerBody  = "新しいお問い合わせが届きました。\n";
$ownerBody .= "=======================================================\n";
$ownerBody .= "お名前　　: {$name}\n";
$ownerBody .= "メール　　: {$email}\n";
$ownerBody .= "種類　　　: {$categoryLabel}\n";
$ownerBody .= "件名　　　: {$subject}\n";
$ownerBody .= "=======================================================\n\n";
$ownerBody .= "メッセージ:\n{$message}\n\n";
$ownerBody .= "=======================================================\n";
$ownerBody .= "送信日時: " . date('Y-m-d H:i:s T') . "\n";
$ownerBody .= "IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . "\n";

$ownerHeaders  = "From: " . SITE_NAME . " <noreply@hibikishimizu.com>\r\n";
$ownerHeaders .= "Reply-To: {$name} <{$email}>\r\n";
$ownerHeaders .= "MIME-Version: 1.0\r\n";
$ownerHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";
$ownerHeaders .= "Content-Transfer-Encoding: base64\r\n";

// -----------------------------------------------------------------------
// Build auto-reply email (Japanese/English bilingual)
// -----------------------------------------------------------------------
$replySubject = 'お問い合わせを受け付けました — ' . SITE_NAME;

$replyBody  = "{$name} 様\n\n";
$replyBody .= "この度はお問い合わせいただきありがとうございます。\n";
$replyBody .= "通常2営業日以内にご返信いたします。\n\n";
$replyBody .= "Dear {$name},\n";
$replyBody .= "Thank you for reaching out. I will get back to you within 2 business days.\n\n";
$replyBody .= "---\n";
$replyBody .= "件名 / Subject: {$subject}\n\n";
$replyBody .= mb_substr($message, 0, 300) . (mb_strlen($message) > 300 ? '...' : '') . "\n\n";
$replyBody .= "---\n";
$replyBody .= OWNER_NAME . "\n";
$replyBody .= SITE_NAME . "\n";

$replyHeaders  = "From: " . OWNER_NAME . " <noreply@hibikishimizu.com>\r\n";
$replyHeaders .= "Reply-To: " . OWNER_NAME . " <" . OWNER_EMAIL . ">\r\n";
$replyHeaders .= "MIME-Version: 1.0\r\n";
$replyHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";
$replyHeaders .= "Content-Transfer-Encoding: base64\r\n";

// -----------------------------------------------------------------------
// Send emails
// -----------------------------------------------------------------------
$ownerSent = mb_send_mail(OWNER_EMAIL, $ownerSubject, $ownerBody, $ownerHeaders);
$replySent = mb_send_mail($email, $replySubject, $replyBody, $replyHeaders);

if ($ownerSent) {
    echo json_encode([
        'ok'      => true,
        'message' => 'お問い合わせを受け付けました。ご返信までしばらくお待ちください。 / Your message has been received. I\'ll be in touch shortly.'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'ok'      => false,
        'message' => 'メール送信に失敗しました。直接メールにてご連絡ください。 / Failed to send. Please contact me directly by email.'
    ]);
}
