import { describe, expect, it } from "vitest";
import { sanitizeArticleHtml, sanitizeImageUrl } from "./sanitize";

describe("sanitizeArticleHtml", () => {
  it("membuang script, event handler, iframe, dan javascript: URL", () => {
    const dirty =
      '<p onclick="alert(1)">Halo</p><script>alert(1)</script><img src="x" onerror="alert(1)"><iframe src="https://x"></iframe>' +
      '<a href="javascript:alert(1)">klik</a><svg><animate attributeName="href" values="javascript:alert(1)"/></svg>';
    const clean = sanitizeArticleHtml(dirty);
    expect(clean).not.toMatch(/script|onerror|onclick|iframe|javascript:|svg|animate/i);
    expect(clean).toContain("<p>Halo</p>");
  });

  it("mempertahankan format editor: judul, daftar, kotak catatan, gambar, tautan aman", () => {
    const html =
      '<h2>Judul</h2><ul><li>satu</li></ul><div class="my-4 rounded-card border-l-4 p-4 border-info bg-info-bg"><p class="font-semibold">Catatan:</p></div>' +
      '<figure class="my-4"><img src="https://contoh.id/peta.png" alt="Peta"><figcaption>Peta</figcaption></figure><a href="https://kkp.go.id">KKP</a>';
    const clean = sanitizeArticleHtml(html);
    expect(clean).toContain("<h2>Judul</h2>");
    expect(clean).toContain('class="my-4 rounded-card border-l-4 p-4 border-info bg-info-bg"');
    expect(clean).toContain('<img src="https://contoh.id/peta.png" alt="Peta" />');
    expect(clean).toContain('<a href="https://kkp.go.id" rel="noopener noreferrer nofollow" target="_blank">KKP</a>');
  });

  it("gambar data: dan style dibuang", () => {
    expect(sanitizeArticleHtml('<img src="data:image/svg+xml;base64,AAAA"><p style="position:fixed">x</p>')).toBe("<img /><p>x</p>");
  });
});

describe("sanitizeImageUrl", () => {
  it("hanya http(s)", () => {
    expect(sanitizeImageUrl("https://contoh.id/a.png")).toBe("https://contoh.id/a.png");
    expect(sanitizeImageUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeImageUrl("data:image/png;base64,AA")).toBeNull();
    expect(sanitizeImageUrl("bukan url")).toBeNull();
    expect(sanitizeImageUrl("")).toBeNull();
  });
});
