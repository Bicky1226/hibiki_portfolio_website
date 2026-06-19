<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/session.php';
require_once __DIR__ . '/../lib/helpers.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// =========================================================================
// GET endpoints
// =========================================================================
if ($method === 'GET') {

    // --- Public: list published posts ---
    if ($action === 'list' && ($_GET['status'] ?? '') === 'published') {
        $posts = getPublishedPosts();
        // Strip heavy fields for list view
        $lite = array_map(function ($p) {
            unset(
                $p['body_md_ja'], $p['body_md_en'],
                $p['body_html_ja'], $p['body_html_en'],
                $p['toc_html_ja'], $p['toc_html_en'],
                $p['toc_custom_ja'], $p['toc_custom_en']
            );
            return $p;
        }, $posts);
        jsonResponse(['ok' => true, 'posts' => $lite]);
    }

    // --- Admin: list all posts ---
    if ($action === 'list') {
        requireAuth();
        $posts = readPosts();
        usort($posts, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
        $lite = array_map(function ($p) {
            unset(
                $p['body_md_ja'], $p['body_md_en'],
                $p['body_html_ja'], $p['body_html_en'],
                $p['toc_html_ja'], $p['toc_html_en'],
                $p['toc_custom_ja'], $p['toc_custom_en']
            );
            return $p;
        }, $posts);
        jsonResponse(['ok' => true, 'posts' => $lite]);
    }

    // --- Admin: get single post (full data for editor) ---
    if ($action === 'get') {
        requireAuth();
        $id = $_GET['id'] ?? '';
        $posts = readPosts();
        foreach ($posts as $post) {
            if ($post['id'] === $id) {
                jsonResponse(['ok' => true, 'post' => $post]);
            }
        }
        jsonResponse(['ok' => false, 'message' => 'Post not found'], 404);
    }

    jsonResponse(['ok' => false, 'message' => 'Unknown action'], 400);
}

// =========================================================================
// POST endpoints (all require auth + CSRF)
// =========================================================================
if ($method !== 'POST') {
    jsonResponse(['ok' => false, 'message' => 'Method not allowed'], 405);
}

requireAuth();
verifyCsrf();

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? '';

// --- Create ---
if ($action === 'create') {
    $slug = trim($input['slug'] ?? '');
    if (!isValidSlug($slug)) {
        jsonResponse(['ok' => false, 'message' => 'Invalid slug. Use lowercase letters, numbers, and hyphens.'], 422);
    }

    $posts = readPosts();
    foreach ($posts as $p) {
        if ($p['slug'] === $slug) {
            jsonResponse(['ok' => false, 'message' => 'Slug already exists.'], 422);
        }
    }

    $now = date('c');
    $status = ($input['status'] ?? 'draft') === 'published' ? 'published' : 'draft';

    $post = [
        'id'            => generateId(),
        'slug'          => $slug,
        'status'        => $status,
        'created_at'    => $now,
        'updated_at'    => $now,
        'published_at'  => $status === 'published' ? $now : '',
        'title_ja'      => clean($input['title_ja'] ?? ''),
        'title_en'      => clean($input['title_en'] ?? ''),
        'excerpt_ja'    => clean($input['excerpt_ja'] ?? ''),
        'excerpt_en'    => clean($input['excerpt_en'] ?? ''),
        'body_md_ja'    => $input['body_md_ja'] ?? '',
        'body_md_en'    => $input['body_md_en'] ?? '',
        'body_html_ja'  => '',
        'body_html_en'  => '',
        'thumbnail'     => clean($input['thumbnail'] ?? ''),
        'tags'          => array_map('trim', $input['tags'] ?? []),
        'toc_enabled'   => (bool) ($input['toc_enabled'] ?? false),
        'toc_html_ja'   => '',
        'toc_html_en'   => '',
        'toc_custom_ja' => $input['toc_custom_ja'] ?? '',
        'toc_custom_en' => $input['toc_custom_en'] ?? '',
    ];

    processPostContent($post);
    $posts[] = $post;
    writePosts($posts);

    jsonResponse(['ok' => true, 'post' => $post], 201);
}

// --- Update ---
if ($action === 'update') {
    $id = $input['id'] ?? '';
    $posts = readPosts();
    $found = false;

    foreach ($posts as &$post) {
        if ($post['id'] !== $id) continue;
        $found = true;

        $oldStatus = $post['status'];
        $newStatus = ($input['status'] ?? $oldStatus) === 'published' ? 'published' : 'draft';

        // Slug change check
        $newSlug = trim($input['slug'] ?? $post['slug']);
        if ($newSlug !== $post['slug']) {
            if (!isValidSlug($newSlug)) {
                jsonResponse(['ok' => false, 'message' => 'Invalid slug.'], 422);
            }
            foreach ($posts as $p2) {
                if ($p2['id'] !== $id && $p2['slug'] === $newSlug) {
                    jsonResponse(['ok' => false, 'message' => 'Slug already exists.'], 422);
                }
            }
        }

        $post['slug']          = $newSlug;
        $post['status']        = $newStatus;
        $post['updated_at']    = date('c');
        $post['title_ja']      = clean($input['title_ja'] ?? $post['title_ja']);
        $post['title_en']      = clean($input['title_en'] ?? $post['title_en']);
        $post['excerpt_ja']    = clean($input['excerpt_ja'] ?? $post['excerpt_ja']);
        $post['excerpt_en']    = clean($input['excerpt_en'] ?? $post['excerpt_en']);
        $post['body_md_ja']    = $input['body_md_ja'] ?? $post['body_md_ja'];
        $post['body_md_en']    = $input['body_md_en'] ?? $post['body_md_en'];
        $post['thumbnail']     = clean($input['thumbnail'] ?? $post['thumbnail']);
        $post['tags']          = array_map('trim', $input['tags'] ?? $post['tags']);
        $post['toc_enabled']   = (bool) ($input['toc_enabled'] ?? $post['toc_enabled']);
        $post['toc_custom_ja'] = $input['toc_custom_ja'] ?? $post['toc_custom_ja'];
        $post['toc_custom_en'] = $input['toc_custom_en'] ?? $post['toc_custom_en'];

        // Set published_at on first publish
        if ($newStatus === 'published' && $oldStatus !== 'published') {
            $post['published_at'] = date('c');
        }

        processPostContent($post);
        break;
    }
    unset($post);

    if (!$found) {
        jsonResponse(['ok' => false, 'message' => 'Post not found'], 404);
    }

    writePosts($posts);
    jsonResponse(['ok' => true, 'post' => $posts[array_search($id, array_column($posts, 'id'))]]);
}

// --- Delete ---
if ($action === 'delete') {
    $id = $input['id'] ?? '';
    $posts = readPosts();
    $newPosts = array_values(array_filter($posts, fn($p) => $p['id'] !== $id));

    if (count($newPosts) === count($posts)) {
        jsonResponse(['ok' => false, 'message' => 'Post not found'], 404);
    }

    writePosts($newPosts);
    jsonResponse(['ok' => true]);
}

jsonResponse(['ok' => false, 'message' => 'Unknown action'], 400);
