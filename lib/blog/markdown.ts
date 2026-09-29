// Blog body rendering: a deliberately small Markdown subset, not MDX and
// not a general parser. MDX is executable, and health content written by a
// dozen advisors is not where we want arbitrary JSX running.
//
// SECURITY MODEL — escape-first, not sanitise-after.
//
// The entire source is HTML-escaped BEFORE any parsing happens. Everything
// after that point operates on inert text, and every tag in the output is a
// literal written here. The only author-derived values that reach an
// attribute are URLs, which must pass safeUrl()'s scheme allowlist and
// cannot contain a quote (escapeHtml already replaced them), so they cannot
// break out of the attribute. There is no path from author input to a tag
// or an attribute name.
//
// That is a stronger guarantee than running a sanitiser over
// author-supplied HTML, because unsafe markup is never constructed in the
// first place. assertAllowlisted() below then checks the finished output at
// runtime as a second line of defence, so a future edit that accidentally
// introduces an unescaped interpolation fails closed instead of shipping.
//
// (An earlier revision passed the output through isomorphic-dompurify. It
// was removed because jsdom's dependency chain is ESM-only and breaks
// `next build` with ERR_REQUIRE_ESM — and because, given the above, it was
// re-sanitising markup that this module had already proven safe.)
//
// Supported: headings (##, ###, ####), paragraphs, bold, italic, inline
// code, links, images, unordered/ordered lists, blockquotes, rules.

const ALLOWED_TAGS = new Set([
  "h2",
  "h3",
  "h4",
  "p",
  "strong",
  "em",
  "code",
  "a",
  "img",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "br",
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// R-11 — the origin a Markdown link is allowed to point at.
//
// `.invalid` is reserved by RFC 2606 and can never resolve, so this is only
// ever a yardstick for "did a relative URL stay relative", never a place a
// browser could be sent.
const RELATIVE_BASE = "https://braidr.invalid";

/**
 * Decides what a Markdown link or image may point at, and returns the URL to
 * emit — or null to refuse it.
 *
 * WHAT WAS WRONG (R-11). The old check was a prefix test:
 *
 *     /^(https?:\/\/|\/|#|mailto:)/i
 *
 * `//evil.com` starts with `/`, so it passed — and a protocol-relative URL is
 * an EXTERNAL navigation, not a path. `/\evil.com` passed too: browsers
 * normalise the backslash to a slash for http(s), making it `//evil.com`
 * again. A blog post could therefore link off-site while looking local.
 *
 * WHY THIS IS NOT A LONGER BLOCKLIST. Blocklisting each hostile spelling
 * loses by default — it only ever covers the variants someone thought of.
 * This PARSES instead, with the URL parser the browser itself uses, and asks
 * two positive questions: is the scheme one we allow, and (for anything that
 * looked relative) did it actually stay on our own origin? `//evil.com` and
 * `/\evil.com` both resolve to a different origin, so both are refused for
 * the same structural reason rather than by being individually named.
 */
function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Browsers STRIP tab, newline and carriage return out of a URL before
  // parsing it, so `java&#9;script:alert(1)` becomes `javascript:alert(1)`
  // after the parser has finished with it. Refuse anything carrying a control
  // character rather than trying to sanitise it — there is no legitimate
  // reason for one inside a Markdown link.
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;

  // A pure fragment stays on whatever page is rendering it.
  if (trimmed.startsWith("#")) return trimmed;

  // mailto: needs an actual address; a bare `mailto:` is not useful and a
  // `mailto:` with whitespace in it is suspicious.
  if (/^mailto:[^\s]+@[^\s]+$/i.test(trimmed)) return trimmed;

  const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);

  // Anything not absolute must be a rooted path. This is what stops
  // `evil.com` being read as a relative path and then resolved oddly.
  if (!isAbsolute && !trimmed.startsWith("/")) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed, RELATIVE_BASE);
  } catch {
    return null;
  }

  // Allowlist of schemes, checked AFTER parsing so `javascript:`, `data:`,
  // `vbscript:` and every future scheme are refused by omission.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  if (!isAbsolute) {
    // It looked relative. If resolving it moved us off our own origin, it was
    // never relative — that is the `//evil.com` and `/\evil.com` case.
    if (parsed.origin !== RELATIVE_BASE) return null;
    // Emit the normalised path only, never the placeholder origin.
    return parsed.pathname + parsed.search + parsed.hash;
  }

  return parsed.toString();
}

/** Inline constructs, applied to already-escaped text. */
function inline(text: string): string {
  let out = text;

  // Images before links — ![alt](src) would otherwise match the link rule.
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
    const url = safeUrl(src);
    if (!url) return "";
    return `<img src="${url}" alt="${alt}" />`;
  });

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const url = safeUrl(href);
    if (!url) return label;
    const external = /^https?:\/\//i.test(url);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${url}"${attrs}>${label}</a>`;
  });

  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  return out;
}

export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source).replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];

  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let quote: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  }
  function flushList() {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  }
  function flushQuote() {
    if (quote.length === 0) return;
    html.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
    quote = [];
  }
  function flushAll() {
    flushParagraph();
    flushList();
    flushQuote();
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      flushAll();
      continue;
    }

    const heading = /^(#{2,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      html.push("<hr />");
      continue;
    }

    const quoted = /^&gt;\s?(.*)$/.exec(trimmed);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
      continue;
    }

    const unordered = /^[-*]\s+(.*)$/.exec(trimmed);
    const ordered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const wanted = unordered ? "ul" : "ol";
      if (listType !== wanted) {
        flushList();
        html.push(`<${wanted}>`);
        listType = wanted;
      }
      html.push(`<li>${inline((unordered ?? ordered)![1])}</li>`);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(trimmed);
  }
  flushAll();

  return assertAllowlisted(html.join("\n"));
}

/**
 * Final check on the rendered output: every tag must be one this module is
 * supposed to emit, and no tag may carry an event handler. The parser above
 * cannot produce anything else today — this exists so that if it ever can,
 * the page shows escaped source rather than executing it.
 */
function assertAllowlisted(html: string): string {
  for (const tag of html.match(/<[^>]*>/g) ?? []) {
    const name = /^<\/?\s*([a-z0-9]+)/i.exec(tag)?.[1]?.toLowerCase();
    if (!name || !ALLOWED_TAGS.has(name) || /\son\w+\s*=/i.test(tag)) {
      console.error("[blog/markdown] refusing to render unexpected markup", tag);
      return `<p>${escapeHtml(html)}</p>`;
    }
  }
  return html;
}

/** Slug from a title: lowercase, alphanumeric, hyphen-separated. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
