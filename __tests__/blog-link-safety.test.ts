import { renderMarkdown } from "@/lib/blog/markdown";

// R-11 — what a Markdown link in a blog post is allowed to point at.
//
// The old check was a prefix test: /^(https?:\/\/|\/|#|mailto:)/i. Anything
// starting with a slash passed, so `//evil.com` passed — and a
// protocol-relative URL is an EXTERNAL navigation, not a path. A published
// post could send readers off-site while the source looked like a local link.
//
// These are written against the RENDERER rather than the helper, because that
// is the thing an author's text actually reaches.

/** The href the renderer emitted, or null if it refused to make a link. */
function hrefFrom(markdown: string): string | null {
  const html = renderMarkdown(markdown);
  const match = /<a href="([^"]*)"/.exec(html);
  return match ? match[1] : null;
}

function srcFrom(markdown: string): string | null {
  const html = renderMarkdown(markdown);
  const match = /<img src="([^"]*)"/.exec(html);
  return match ? match[1] : null;
}

describe("blog link safety (R-11)", () => {
  describe("URLs that escape the origin while looking relative", () => {
    // THE BUG. Every one of these passed the old prefix check.
    it.each([
      ["//evil.com", "protocol-relative — an external navigation, not a path"],
      ["//evil.com/phish", "protocol-relative with a path"],
      ["/\\evil.com", "backslash; browsers normalise it to // for http(s)"],
      ["\\\\evil.com", "UNC-style double backslash"],
      ["/\\/evil.com", "mixed slash and backslash"],
    ])("refuses %s (%s)", (url) => {
      expect(hrefFrom(`[click me](${url})`)).toBeNull();
    });

    it("renders the label as plain text rather than dropping the words", () => {
      const html = renderMarkdown("[click me](//evil.com)");
      expect(html).not.toContain("evil.com");
      expect(html).toContain("click me");
    });

    it("refuses them as image sources too", () => {
      expect(srcFrom("![x](//evil.com/tracker.gif)")).toBeNull();
    });
  });

  describe("dangerous schemes", () => {
    it.each([
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html;base64,PHN2Zz4=",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://evil.com/x",
      "about:blank",
    ])("refuses %s", (url) => {
      expect(hrefFrom(`[x](${url})`)).toBeNull();
    });

    // Browsers strip tab/newline/CR out of a URL before parsing, so a scheme
    // split across one of them reassembles into a live javascript: URL.
    it.each([
      ["java\tscript:alert(1)", "embedded tab"],
      ["java\nscript:alert(1)", "embedded newline"],
      ["java\rscript:alert(1)", "embedded carriage return"],
      ["\u0000javascript:alert(1)", "leading NUL"],
    ])("refuses a scheme broken up by a control character (%s)", (url) => {
      const html = renderMarkdown(`[x](${url})`);
      expect(html.toLowerCase()).not.toContain("javascript");
    });
  });

  describe("percent-encoding is not a way in", () => {
    it("treats percent-encoded slashes as path characters, not a new origin", () => {
      // %2F%2F is NOT the same as // — it is a literal path segment, and must
      // stay on this origin rather than being decoded into a host.
      const href = hrefFrom("[x](/%2F%2Fevil.com)");
      expect(href).not.toBeNull();
      expect(href!.startsWith("/")).toBe(true);
      expect(href).not.toMatch(/^\/\//);
      expect(href).not.toContain("//evil.com");
    });

    it("refuses a percent-encoded scheme rather than resolving it", () => {
      expect(hrefFrom("[x](%6Aavascript:alert(1))")).toBeNull();
    });
  });

  describe("legitimate links still work", () => {
    it.each([
      "https://example.com/article",
      "http://example.com/article",
      "https://example.com/a?b=c#d",
    ])("allows the absolute URL %s", (url) => {
      expect(hrefFrom(`[x](${url})`)).not.toBeNull();
    });

    it.each(["/blog/some-post", "/", "/a/b?c=d#e"])("allows the local path %s", (url) => {
      const href = hrefFrom(`[x](${url})`);
      expect(href).not.toBeNull();
      expect(href!.startsWith("/")).toBe(true);
    });

    it("allows a bare fragment", () => {
      expect(hrefFrom("[x](#section-2)")).toBe("#section-2");
    });

    it("allows a real mailto address", () => {
      expect(hrefFrom("[x](mailto:hello@braidr.app)")).toBe("mailto:hello@braidr.app");
    });

    it("never leaks the internal placeholder origin into output", () => {
      const html = renderMarkdown("[a](/x) [b](#y) ![c](/z.png)");
      expect(html).not.toContain("braidr.invalid");
    });

    it("keeps marking external links noopener", () => {
      const html = renderMarkdown("[x](https://example.com)");
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it("does not mark a local path as external", () => {
      expect(renderMarkdown("[x](/blog/post)")).not.toContain("noopener");
    });
  });
});
