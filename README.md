# 響 — Hibiki Shimizu · Portfolio

The source of my personal portfolio site, live at **[hibikishimizu.com](https://hibikishimizu.com)**.
A bilingual (日本語 / English), hand-built site with no framework — just vanilla HTML, CSS and JavaScript, with a small PHP backend for the contact form and blog.

> 志水 響のポートフォリオサイトのソースです。フレームワークを使わず、HTML / CSS / JavaScript と少量の PHP で構築しています。

---

## Highlights

- **「活版 / KAPPAN」design system** — a washi-paper × letterpress theme ([assets/css/base.css](assets/css/base.css)): unrounded corners, hard offset shadows, vermilion seal (朱印) accents, and a vertical-writing (縦書き) hero.
- **Suminagashi hero** — the home hero runs a real-time WebGL fluid simulation ([assets/js/suminagashi.js](assets/js/suminagashi.js)) that marbles a single sumi ink across the page. Headline text inverts black↔white over the ink via `mix-blend-mode`. Click / hold to add ink, or "Rinse" to wash it away. Falls back gracefully without WebGL or with `prefers-reduced-motion`.
- **Isle of Islay whisky guide** — a standalone 6-page guide (× JA/EN) on Islay and its 11 distilleries, with a Leaflet distillery map and a hand-stitched background map. Keeps its own theme, independent of the main design system.
- **Bilingual** — every page exists under `/ja/` and `/en/`, with browser-language detection and a flag/text language switch.
- **Blog** — JSON-driven, Markdown rendered with Parsedown, with a small password-protected admin panel.
- **Contact form** — PHP (`mb_send_mail`) with a honeypot, auto-reply, and CSRF-protected blog API.
- **Motion** — GSAP + ScrollTrigger for reveals, Lenis for smooth scrolling.

## Tech stack

| | |
|---|---|
| **Markup / styling** | Vanilla HTML5, CSS (custom properties, no framework) |
| **Scripting** | Vanilla JavaScript (ES modules-free), WebGL (fluid sim) |
| **Animation** | GSAP, ScrollTrigger, Lenis |
| **Fonts** | Shippori Mincho B1, Zen Kaku Gothic New, IBM Plex Mono |
| **Icons / maps** | Phosphor Icons, Leaflet (OpenStreetMap / CARTO tiles) |
| **Backend** | PHP (contact mail, blog API + admin), Parsedown |
| **Hosting** | Xserver (Apache, `.htaccess`) |

## Project structure

```
.
├── index.html              # root: language detection → /ja/ or /en/
├── ja/ , en/               # mirrored Japanese / English pages
│   ├── about/ works/ blog/ contact/ privacy/ …
│   └── Islay/              # 6-page Isle of Islay whisky guide
├── assets/
│   ├── css/
│   │   ├── base.css        # 活版 / KAPPAN design system (main pages)
│   │   ├── global.css      # legacy theme (Islay guide only)
│   │   └── pages/          # per-page styles
│   ├── js/
│   │   ├── main.js         # nav, language, cookie, GSAP/Lenis setup
│   │   ├── suminagashi.js  # WebGL ink-marbling hero background
│   │   └── pages/          # per-page scripts
│   └── images/
├── blog/                   # JSON + Parsedown blog, PHP API & admin
├── contact/                # contact form handler (PHP)
├── admin/                  # blog admin UI
├── .htaccess               # HTTPS, clean URLs, blog routing
├── sitemap.xml robots.txt 404.html
```

## Local development

It's a static site with a PHP backend, so any local server works:

```bash
# pure static preview (blog/contact backends won't run)
python -m http.server 8000

# with PHP (blog + contact work)
php -S localhost:8000
```

Then open `http://localhost:8000/ja/`.

## Deployment

Upload the contents of this repository to `public_html/` on the server (Xserver). The included `.htaccess` handles HTTPS redirection, trailing-slash cleanup, clean URLs, and blog article routing.

### Blog admin setup

For security, the real `blog/api/auth.php` (which holds the admin password hash) is **not** committed. To enable the blog admin:

```bash
cd blog/api
cp auth.example.php auth.php
# generate a hash and paste it into auth.php:
php -r "echo password_hash('your-password', PASSWORD_BCRYPT), PHP_EOL;"
```

## License

Code is shared for reference. Site content, text, photographs and design are © Hibiki Shimizu — please don't reuse them without permission.

---

*Built by hand. 洗練は、実装に宿る。*
