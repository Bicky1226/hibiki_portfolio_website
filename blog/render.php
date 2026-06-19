<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';

// -------------------------------------------------------------------------
// Parse request
// -------------------------------------------------------------------------
$lang = $_GET['lang'] ?? 'ja';
$slug = $_GET['slug'] ?? '';

if (!in_array($lang, ['ja', 'en'], true) || !$slug) {
    http_response_code(404);
    header('Location: /404.html');
    exit;
}

// -------------------------------------------------------------------------
// Find post
// -------------------------------------------------------------------------
$post = findPublishedBySlug($slug);
if (!$post) {
    http_response_code(404);
    header('Location: /404.html');
    exit;
}

$prevNext = getPrevNext($slug);
$prev = $prevNext['prev'];
$next = $prevNext['next'];

// -------------------------------------------------------------------------
// Language-specific fields
// -------------------------------------------------------------------------
$title       = $post['title_' . $lang] ?: $post['title_ja'];
$excerpt     = $post['excerpt_' . $lang] ?: $post['excerpt_ja'];
$bodyHtml    = $post['body_html_' . $lang] ?: $post['body_html_ja'];
$tocHtml     = $post['toc_custom_' . $lang] ?: ($post['toc_html_' . $lang] ?? '');
$tocEnabled  = (bool)($post['toc_enabled'] ?? false);
$thumbnail   = $post['thumbnail'] ?? '';
$tags        = $post['tags'] ?? [];
$publishedAt = $post['published_at'] ?? $post['created_at'];

$dateFormatted = date('Y.m.d', strtotime($publishedAt));
$dateIso       = date('c', strtotime($publishedAt));

$canonicalUrl  = 'https://hibikishimizu.com/' . $lang . '/blog/' . $slug . '/';
$altLang       = $lang === 'ja' ? 'en' : 'ja';
$altUrl        = 'https://hibikishimizu.com/' . $altLang . '/blog/' . $slug . '/';

$ogImage = $thumbnail
    ? 'https://hibikishimizu.com' . $thumbnail
    : 'https://hibikishimizu.com/assets/images/og-home.jpg';

// Navigation labels
$isJa = $lang === 'ja';
$siteName     = $isJa ? '志水 響' : 'Hibiki Shimizu';
$navLogo      = $isJa ? '陳腐なエンジニアの巣' : 'A nest of a banal engineer';
$blogLabel    = 'Blog';
$skipLabel    = $isJa ? 'メインコンテンツへスキップ' : 'Skip to main content';
$cookieText   = $isJa
    ? 'このサイトはアクセス解析のためCookieを使用します。詳しくは<a href="/' . $lang . '/privacy/">プライバシーポリシー</a>をご覧ください。'
    : 'This site uses cookies for analytics. See our <a href="/' . $lang . '/privacy/">Privacy Policy</a>.';
$cookieAccept = $isJa ? '同意する' : 'Accept';
$cookieReject = $isJa ? '拒否する' : 'Reject';
$tocLabel     = $isJa ? '目次' : 'Contents';
$shareLabel   = $isJa ? 'URLをコピー' : 'Copy URL';
$shareCopied  = $isJa ? 'コピーしました' : 'Copied!';
$shareXLabel  = 'Share on X';
$prevLabel    = $isJa ? '前の記事' : 'Previous';
$nextLabel    = $isJa ? '次の記事' : 'Next';
$backLabel    = $isJa ? 'ブログ一覧へ戻る' : 'Back to Blog';
$footerTag    = $isJa ? '陳腐なエンジニアの巣 — hibikishimizu.com' : 'A nest of a banal engineer — hibikishimizu.com';

$prevTitle = $prev ? ($prev['title_' . $lang] ?: $prev['title_ja']) : '';
$prevSlug  = $prev['slug'] ?? '';
$nextTitle = $next ? ($next['title_' . $lang] ?: $next['title_ja']) : '';
$nextSlug  = $next['slug'] ?? '';

$encodedUrl   = rawurlencode($canonicalUrl);
$encodedTitle = rawurlencode($title);

// Escape HTML helper
function e(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="<?= $lang ?>">
<head>
  <!-- GA4 loaded dynamically after cookie consent (see main.js) -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title><?= e($title) ?> — <?= e($siteName) ?></title>
  <meta name="description" content="<?= e($excerpt) ?>">
  <link rel="canonical" href="<?= e($canonicalUrl) ?>">

  <meta property="og:type"        content="article">
  <meta property="og:url"         content="<?= e($canonicalUrl) ?>">
  <meta property="og:title"       content="<?= e($title) ?>">
  <meta property="og:description" content="<?= e($excerpt) ?>">
  <meta property="og:image"       content="<?= e($ogImage) ?>">
  <meta property="og:locale"      content="<?= $isJa ? 'ja_JP' : 'en_GB' ?>">
  <meta property="article:published_time" content="<?= e($dateIso) ?>">

  <link rel="alternate" hreflang="ja" href="https://hibikishimizu.com/ja/blog/<?= e($slug) ?>/">
  <link rel="alternate" hreflang="en" href="https://hibikishimizu.com/en/blog/<?= e($slug) ?>/">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;500;600;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">

  <script src="https://unpkg.com/@phosphor-icons/web@2.1.1/src/index.js" defer></script>

  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/assets/css/pages/blog-article.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
</head>

<body class="blog-article-page" data-lang="<?= $lang ?>">
  <a href="#main-content" class="skip-link"><?= $skipLabel ?></a>

  <div id="cookie-banner" role="dialog" aria-label="Cookie notice">
    <p class="cookie-text"><?= $cookieText ?></p>
    <div class="cookie-actions">
      <button class="cookie-accept" id="cookie-accept"><?= e($cookieAccept) ?></button>
      <button class="cookie-reject" id="cookie-reject"><?= e($cookieReject) ?></button>
    </div>
  </div>

  <nav id="main-nav" role="navigation" aria-label="<?= $isJa ? 'メインナビゲーション' : 'Main navigation' ?>">
    <a href="/<?= $lang ?>/" class="nav-logo" aria-label="<?= $isJa ? '響 — ホームへ' : 'Hibiki — Home' ?>"><?= e($navLogo) ?></a>
    <button class="nav-hamburger" aria-label="<?= $isJa ? 'メニューを開く' : 'Open menu' ?>" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <ul class="nav-links" role="list">
      <li><a href="/<?= $lang ?>/">Home</a></li>
      <li><a href="/<?= $lang ?>/works/">Works</a></li>
      <li><a href="/<?= $lang ?>/about/">About</a></li>
      <li><a href="/<?= $lang ?>/blog/" class="active">Blog</a></li>
      <li><a href="/<?= $lang ?>/contact/">Contact</a></li>
    </ul>
    <div class="nav-lang" aria-label="<?= $isJa ? '言語切替' : 'Language switcher' ?>">
      <button class="lang-btn <?= $isJa ? 'active' : '' ?>" data-lang="ja" aria-label="日本語">日</button>
      <span class="lang-divider" aria-hidden="true">|</span>
      <button class="lang-btn <?= !$isJa ? 'active' : '' ?>" data-lang="en" aria-label="English">EN</button>
    </div>
  </nav>

  <div id="main-content"></div>

  <article class="blog-article" itemscope itemtype="https://schema.org/BlogPosting">
    <!-- Back link -->
    <div class="container">
      <a href="/<?= $lang ?>/blog/" class="article-back">
        <i class="ph ph-arrow-left" aria-hidden="true"></i> <?= e($backLabel) ?>
      </a>
    </div>

    <!-- Header -->
    <header class="article-header">
      <div class="container">
        <div class="article-meta">
          <time datetime="<?= e($dateIso) ?>" itemprop="datePublished"><?= e($dateFormatted) ?></time>
          <div class="article-tags">
            <?php foreach ($tags as $tag): ?>
              <span class="post-tag"><?= e($tag) ?></span>
            <?php endforeach; ?>
          </div>
        </div>
        <h1 class="article-title" itemprop="headline"><?= e($title) ?></h1>
        <?php if ($thumbnail): ?>
        <figure class="article-hero-image">
          <img src="<?= e($thumbnail) ?>" alt="<?= e($title) ?>" itemprop="image" loading="lazy">
        </figure>
        <?php endif; ?>
      </div>
    </header>

    <!-- Body -->
    <div class="container article-layout">
      <?php if ($tocEnabled && $tocHtml): ?>
      <aside class="article-toc" aria-label="<?= e($tocLabel) ?>">
        <p class="toc-label"><?= e($tocLabel) ?></p>
        <?= $tocHtml ?>
      </aside>
      <?php endif; ?>

      <div class="article-content prose" itemprop="articleBody">
        <?= $bodyHtml ?>
      </div>
    </div>

    <!-- Footer: Share + Prev/Next -->
    <footer class="article-footer">
      <div class="container">
        <div class="article-share">
          <button class="share-btn share-copy-btn" data-url="<?= e($canonicalUrl) ?>" data-label="<?= e($shareLabel) ?>" data-copied="<?= e($shareCopied) ?>">
            <i class="ph ph-link" aria-hidden="true"></i> <span><?= e($shareLabel) ?></span>
          </button>
          <a href="https://twitter.com/intent/tweet?url=<?= $encodedUrl ?>&text=<?= $encodedTitle ?>"
             target="_blank" rel="noopener" class="share-btn share-x-btn">
            <i class="ph ph-x-logo" aria-hidden="true"></i> <?= e($shareXLabel) ?>
          </a>
        </div>

        <?php if ($prev || $next): ?>
        <nav class="article-prevnext" aria-label="<?= $isJa ? '関連記事' : 'Related articles' ?>">
          <?php if ($prev): ?>
          <a href="/<?= $lang ?>/blog/<?= e($prevSlug) ?>/" class="prevnext-link prevnext-prev">
            <span class="prevnext-label"><i class="ph ph-arrow-left" aria-hidden="true"></i> <?= e($prevLabel) ?></span>
            <span class="prevnext-title"><?= e($prevTitle) ?></span>
          </a>
          <?php endif; ?>
          <?php if ($next): ?>
          <a href="/<?= $lang ?>/blog/<?= e($nextSlug) ?>/" class="prevnext-link prevnext-next">
            <span class="prevnext-label"><?= e($nextLabel) ?> <i class="ph ph-arrow-right" aria-hidden="true"></i></span>
            <span class="prevnext-title"><?= e($nextTitle) ?></span>
          </a>
          <?php endif; ?>
        </nav>
        <?php endif; ?>
      </div>
    </footer>
  </article>

  <!-- Site Footer -->
  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <div class="footer-inner">
        <div class="footer-brand">
          <p class="footer-tagline text-muted" style="font-size:var(--fs-xs);margin-top:4px;">
            <?= e($footerTag) ?>
          </p>
        </div>
        <nav class="footer-links" aria-label="<?= $isJa ? 'フッターナビゲーション' : 'Footer navigation' ?>">
          <a href="/<?= $lang ?>/works/">Works</a>
          <a href="/<?= $lang ?>/about/">About</a>
          <a href="/<?= $lang ?>/blog/">Blog</a>
          <a href="/<?= $lang ?>/contact/">Contact</a>
          <a href="/<?= $lang ?>/privacy/">Privacy</a>
          <a href="/<?= $lang ?>/patch-notes/">Patch Notes</a>
        </nav>
        <div class="footer-lang" aria-label="<?= $isJa ? '言語切替' : 'Language switcher' ?>">
          <button class="lang-btn <?= $isJa ? 'active' : '' ?>" data-lang="ja" aria-label="日本語">日</button>
          <span class="lang-divider" aria-hidden="true">|</span>
          <button class="lang-btn <?= !$isJa ? 'active' : '' ?>" data-lang="en" aria-label="English">EN</button>
        </div>
      </div>
      <div class="footer-bottom">
        <p class="footer-copy font-en">&copy; 2026 Hibiki Shimizu. All rights reserved.</p>
        <a href="https://github.com/HibikiShimizu" target="_blank" rel="noopener" class="footer-social" aria-label="GitHub">
          <i class="ph ph-github-logo" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </footer>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/bundled/lenis.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
  <script src="/assets/js/pages/blog-article.js"></script>
  <script src="/assets/js/main.js"></script>
</body>
</html>
