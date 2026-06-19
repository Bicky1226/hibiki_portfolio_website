<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/session.php';
require_once __DIR__ . '/../lib/helpers.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['ok' => false, 'message' => 'Method not allowed'], 405);
}

requireAuth();

// CSRF via header (multipart can't use JSON body)
$token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!hash_equals(getCsrfToken(), $token)) {
    jsonResponse(['ok' => false, 'message' => 'CSRF token mismatch'], 403);
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(['ok' => false, 'message' => 'No file uploaded or upload error.'], 422);
}

$file = $_FILES['image'];

// Validate size (max 5MB)
if ($file['size'] > 5 * 1024 * 1024) {
    jsonResponse(['ok' => false, 'message' => 'File too large. Max 5MB.'], 422);
}

// Validate image with getimagesize
$imageInfo = getimagesize($file['tmp_name']);
if ($imageInfo === false) {
    jsonResponse(['ok' => false, 'message' => 'Invalid image file.'], 422);
}

$allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
if (!in_array($imageInfo['mime'], $allowedMimes, true)) {
    jsonResponse(['ok' => false, 'message' => 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.'], 422);
}

// Generate safe filename
$ext = match ($imageInfo['mime']) {
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
    default      => 'jpg',
};

$baseName = pathinfo($file['name'], PATHINFO_FILENAME);
$baseName = preg_replace('/[^a-z0-9_-]/i', '', str_replace(' ', '-', $baseName));
$baseName = mb_substr($baseName ?: 'image', 0, 40);
$fileName = time() . '_' . bin2hex(random_bytes(3)) . '_' . $baseName . '.' . $ext;

if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

$dest = UPLOAD_DIR . $fileName;
if (!move_uploaded_file($file['tmp_name'], $dest)) {
    jsonResponse(['ok' => false, 'message' => 'Failed to save file.'], 500);
}

jsonResponse([
    'ok'  => true,
    'url' => '/blog/uploads/' . $fileName,
]);
