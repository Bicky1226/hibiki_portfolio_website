<?php
declare(strict_types=1);

require_once __DIR__ . '/Parsedown.php';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
define('DATA_FILE', __DIR__ . '/../data/posts.json');
define('UPLOAD_DIR', __DIR__ . '/../uploads/');

// ---------------------------------------------------------------------------
// JSON I/O with file locking
// ---------------------------------------------------------------------------
function readPosts(): array
{
    if (!file_exists(DATA_FILE)) {
        return [];
    }
    $json = file_get_contents(DATA_FILE);
    if ($json === false || $json === '') {
        return [];
    }
    $data = json_decode($json, true);
    return is_array($data) ? $data : [];
}

function writePosts(array $posts): bool
{
    $dir = dirname(DATA_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $json = json_encode($posts, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $fp = fopen(DATA_FILE, 'c');
    if ($fp === false) {
        return false;
    }
    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    return true;
}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------
function clean(string $str): string
{
    return htmlspecialchars(trim($str), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function isValidSlug(string $slug): bool
{
    return (bool) preg_match('/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/', $slug) && mb_strlen($slug) <= 80;
}

function generateId(): string
{
    return bin2hex(random_bytes(4)); // 8-char hex
}

// ---------------------------------------------------------------------------
// Markdown → HTML
// ---------------------------------------------------------------------------
function renderMarkdown(string $md): string
{
    $parsedown = new Parsedown();
    $parsedown->setSafeMode(true);
    $parsedown->setBreaksEnabled(true);
    return $parsedown->text($md);
}

// ---------------------------------------------------------------------------
// TOC generation from rendered HTML
// ---------------------------------------------------------------------------
function generateToc(string &$html): string
{
    $tocItems = [];
    // Find h2 and h3 headings
    $html = preg_replace_callback(
        '/<(h[23])([^>]*)>(.*?)<\/\1>/si',
        function ($m) use (&$tocItems) {
            $tag   = $m[1];
            $attrs = $m[2];
            $text  = strip_tags($m[3]);
            $id    = slugifyHeading($text);

            // Ensure unique IDs
            static $usedIds = [];
            $origId = $id;
            $n = 1;
            while (isset($usedIds[$id])) {
                $id = $origId . '-' . (++$n);
            }
            $usedIds[$id] = true;

            $level = ($tag === 'h2') ? 2 : 3;
            $tocItems[] = ['level' => $level, 'id' => $id, 'text' => $text];

            return "<{$tag}{$attrs} id=\"{$id}\">{$m[3]}</{$tag}>";
        },
        $html
    );

    if (empty($tocItems)) {
        return '';
    }

    $out = '<ul class="toc-list">';
    $inSub = false;
    foreach ($tocItems as $item) {
        if ($item['level'] === 3) {
            if (!$inSub) {
                $out .= '<ul>';
                $inSub = true;
            }
            $out .= '<li><a href="#' . $item['id'] . '">' . clean($item['text']) . '</a></li>';
        } else {
            if ($inSub) {
                $out .= '</ul>';
                $inSub = false;
            }
            $out .= '<li><a href="#' . $item['id'] . '">' . clean($item['text']) . '</a></li>';
        }
    }
    if ($inSub) {
        $out .= '</ul>';
    }
    $out .= '</ul>';
    return $out;
}

function slugifyHeading(string $text): string
{
    $text = mb_strtolower($text, 'UTF-8');
    $text = preg_replace('/[^\p{L}\p{N}\s-]/u', '', $text);
    $text = preg_replace('/[\s]+/', '-', $text);
    $text = trim($text, '-');
    return $text ?: 'section';
}

// ---------------------------------------------------------------------------
// Process a post's markdown fields → HTML + TOC
// ---------------------------------------------------------------------------
function processPostContent(array &$post): void
{
    // JA
    $htmlJa = renderMarkdown($post['body_md_ja'] ?? '');
    $tocJa  = generateToc($htmlJa);
    $post['body_html_ja'] = $htmlJa;
    if (empty($post['toc_custom_ja'])) {
        $post['toc_html_ja'] = $tocJa;
    }

    // EN
    $htmlEn = renderMarkdown($post['body_md_en'] ?? '');
    $tocEn  = generateToc($htmlEn);
    $post['body_html_en'] = $htmlEn;
    if (empty($post['toc_custom_en'])) {
        $post['toc_html_en'] = $tocEn;
    }
}

// ---------------------------------------------------------------------------
// Get published posts sorted by published_at descending
// ---------------------------------------------------------------------------
function getPublishedPosts(): array
{
    $posts = readPosts();
    $published = array_filter($posts, fn($p) => ($p['status'] ?? '') === 'published');
    usort($published, fn($a, $b) => strcmp($b['published_at'] ?? '', $a['published_at'] ?? ''));
    return array_values($published);
}

// ---------------------------------------------------------------------------
// Find a post by slug (published only)
// ---------------------------------------------------------------------------
function findPublishedBySlug(string $slug): ?array
{
    $posts = getPublishedPosts();
    foreach ($posts as $post) {
        if (($post['slug'] ?? '') === $slug) {
            return $post;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Get prev/next posts relative to a given post (by published_at)
// ---------------------------------------------------------------------------
function getPrevNext(string $slug): array
{
    $posts = getPublishedPosts(); // sorted desc by published_at
    $idx = null;
    foreach ($posts as $i => $p) {
        if ($p['slug'] === $slug) {
            $idx = $i;
            break;
        }
    }
    if ($idx === null) {
        return ['prev' => null, 'next' => null];
    }
    // In desc order: prev (newer) = idx-1, next (older) = idx+1
    $newer = ($idx > 0) ? $posts[$idx - 1] : null;
    $older = ($idx < count($posts) - 1) ? $posts[$idx + 1] : null;
    return ['prev' => $older, 'next' => $newer];
}

// ---------------------------------------------------------------------------
// JSON response helper
// ---------------------------------------------------------------------------
function jsonResponse(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
