<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/helpers.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['ok' => false, 'message' => 'Method not allowed'], 405);
}

$posts = readPosts();
$tags = [];
foreach ($posts as $post) {
    foreach ($post['tags'] ?? [] as $tag) {
        $tags[$tag] = true;
    }
}

jsonResponse(['ok' => true, 'tags' => array_keys($tags)]);
