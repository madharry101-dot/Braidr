import { renderMarkdown, slugify } from "@/lib/blog/markdown";

describe("renderMarkdown — safety", () => {
  it("escapes raw HTML rather than rendering it", () => {
    const out = renderMarkdown("<script>alert(1)</script>");
    expect(out).not.toContain("<script");
    expect(out).toContain("&lt;script&gt;");
  });

  it("drops javascript: and data: URLs on links", () => {
    // eslint-disable-next-line no-script-url
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("javascript:");
    expect(renderMarkdown("[x](data:text/html;base64,PHN2Zz4=)")).not.toContain("data:");
  });

  it("drops unsafe image sources", () => {
    expect(renderMarkdown("![x](javascript:alert(1))")).not.toContain("javascript:");
  });

  it("emits only allowlisted tags, whatever the input", () => {
    // The escape-first design is the security boundary now, so assert it
    // directly: no input may produce a tag outside the allowlist.
    const allowed = new Set([
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
    const hostile = [
      "<img src=x onerror=alert(1)>",
      "<iframe src=//evil.test></iframe>",
      "<svg/onload=alert(1)>",
      '<a href="javascript:alert(1)">x</a>',
      "## <style>body{display:none}</style>",
      "- <object data=x></object>",
      "> <embed src=x>",
      "**<form action=/steal>**",
      '![x]("onerror=alert(1) )',
      '[x](https://a.test">)',
    ];
    for (const source of hostile) {
      const out = renderMarkdown(source);
      for (const tag of out.match(/<[^>]*>/g) ?? []) {
        const name = /^<\/?\s*([a-z0-9]+)/i.exec(tag)?.[1]?.toLowerCase();
        expect(allowed.has(name ?? "")).toBe(true);
      }
      expect(out).not.toMatch(/<script/i);
    }
  });

  it("never emits an event-handler attribute", () => {
    // Unsupported syntax stays inert escaped text, which can legitimately
    // contain the word "onerror" — so the invariant is asserted against tag
    // interiors only, not the whole string.
    const tagsOf = (html: string) => html.match(/<[^>]+>/g) ?? [];
    for (const source of [
      '[x](https://a.test "onclick=alert(1)")',
      "![x](/a.png onerror=alert(1))",
      "**bold onmouseover=alert(1)**",
      "[x](/a onfocus=alert(1))",
    ]) {
      for (const tag of tagsOf(renderMarkdown(source))) {
        expect(tag).not.toMatch(/\son\w+\s*=/i);
      }
    }
  });

  it("marks external links noopener", () => {
    const out = renderMarkdown("[x](https://example.test)");
    expect(out).toContain('rel="noopener noreferrer"');
    // Internal links stay in-tab and need no rel.
    expect(renderMarkdown("[x](/blog)")).not.toContain("noopener");
  });
});

describe("renderMarkdown — structure", () => {
  it("renders headings, bold, italic and inline code", () => {
    expect(renderMarkdown("## Title")).toContain("<h2>Title</h2>");
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
    expect(renderMarkdown("*soft*")).toContain("<em>soft</em>");
    expect(renderMarkdown("`code`")).toContain("<code>code</code>");
  });

  it("groups consecutive list items into one list", () => {
    const out = renderMarkdown("- one\n- two");
    expect(out.match(/<ul>/g)).toHaveLength(1);
    expect(out.match(/<li>/g)).toHaveLength(2);
  });

  it("keeps ordered and unordered lists separate", () => {
    const out = renderMarkdown("- a\n\n1. b");
    expect(out).toContain("<ul>");
    expect(out).toContain("<ol>");
  });

  it("joins wrapped lines into one paragraph and splits on blank lines", () => {
    const out = renderMarkdown("one\ntwo\n\nthree");
    expect(out).toContain("<p>one two</p>");
    expect(out).toContain("<p>three</p>");
  });

  it("renders blockquotes and horizontal rules", () => {
    expect(renderMarkdown("> quoted")).toContain("<blockquote><p>quoted</p></blockquote>");
    expect(renderMarkdown("---")).toContain("<hr");
  });

  it("renders embedded images", () => {
    const out = renderMarkdown("![scalp diagram](/img/a.png)");
    expect(out).toContain('src="/img/a.png"');
    expect(out).toContain('alt="scalp diagram"');
  });

  it("returns empty output for empty input", () => {
    expect(renderMarkdown("").trim()).toBe("");
  });
});

describe("slugify", () => {
  it("builds a URL-safe slug", () => {
    expect(slugify("Looking after braids in winter")).toBe("looking-after-braids-in-winter");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("Traction alopecia: what to watch for!")).toBe(
      "traction-alopecia-what-to-watch-for"
    );
  });

  it("never leaves a leading or trailing hyphen", () => {
    const s = slugify("  ...Hello...  ");
    expect(s).toBe("hello");
    expect(s.startsWith("-")).toBe(false);
    expect(s.endsWith("-")).toBe(false);
  });

  it("matches the slug column's CHECK constraint", () => {
    const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const title of ["Braids & Scalp Health", "5 things to know", "Étude on curl patterns"]) {
      expect(slugify(title)).toMatch(pattern);
    }
  });
});
