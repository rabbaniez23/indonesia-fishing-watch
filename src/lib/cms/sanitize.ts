import sanitizeHtml from "sanitize-html";

/**
 * Pembersih HTML artikel CMS (mencegah XSS tersimpan). Hanya tag yang dihasilkan editor artikel yang diizinkan;
 * tidak ada script, iframe, style, atau atribut on*; tautan & gambar hanya http(s) (tautan juga mailto).
 * Dipanggil saat menyimpan dan sekali lagi saat menampilkan.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "sub", "sup",
    "ul", "ol", "li", "blockquote", "code", "pre", "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td", "div", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    // Kelas dipakai kotak catatan & gambar dari editor (token desain Tailwind); tidak bisa menjalankan kode.
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    // Tautan keluar dibuka di tab baru tanpa akses ke halaman ini.
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
  },
};

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** URL gambar sampul: hanya http(s); selain itu dibuang. */
export function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
