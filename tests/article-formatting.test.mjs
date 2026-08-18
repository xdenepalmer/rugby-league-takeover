import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const markdown = read("../src/lib/markdown.jsx");
const sheet = read("../src/components/public/PublicDetailSheet.jsx");

// Owner report: "it's squishing the text up in the articles".
// The detail sheet split the body on BLANK lines only and dropped each chunk in
// a <p>, so an author writing a list one item per line (single newlines) got one
// run-on paragraph: "... $50 * Bucket hat * Tote bag * Stubby Cooler ...".
// Article bodies now render through MarkdownBody, which keeps line breaks inside
// a block and turns -/* lines into a real list.

test("article bodies render through the markdown renderer, not raw paragraph splitting", () => {
  assert.match(sheet, /import \{ MarkdownBody \} from "@\/lib\/markdown"/);
  assert.match(sheet, /<MarkdownBody text=\{body\} \/>/);
  assert.doesNotMatch(
    sheet,
    /body\.split\("\\n\\n"\)/,
    "the blank-line-only split that collapsed single newlines is gone"
  );
});

test("the renderer keeps line breaks inside a paragraph", () => {
  // This is the actual squishing fix: without it, every line joins into one run.
  assert.match(markdown, /Paragraph — preserve line breaks within the block/);
  assert.match(markdown, /elements\.push\(<br key=/);
});

test("a list written one item per line becomes a real list", () => {
  assert.match(markdown, /lines\.every\(\(l\) => \/\^\\s\*\[-\*\]\\s\/\.test\(l\)\)/);
  assert.match(markdown, /<ul key=/);
});

test("authors get headings and inline photos", () => {
  // Owner asked for bold / size changes / photos in articles.
  assert.match(markdown, /\^\(#\{2,3\}\)\\s\+\(\.\+\)\$/, "## and ### headings are parsed");
  assert.match(markdown, /<Tag/, "headings render as h2/h3");
  assert.match(markdown, /\^!\\\[\(\[\^\\\]\]\*\)\\\]/, "![alt](url) images are parsed");
  assert.match(markdown, /function safeImageSrc/, "image URLs are validated");
});

test("only http(s) images are rendered — never javascript: or data:", () => {
  const fn = markdown.split("function safeImageSrc")[1].split("\n}")[0];
  assert.match(fn, /protocol === "https:" \|\| url\.protocol === "http:"/);
  assert.match(fn, /return ""/, "anything else is dropped rather than emitted as an <img>");
});

test("teaser cards strip the markup instead of showing raw asterisks", () => {
  assert.match(markdown, /export function plainExcerpt/);
  for (const file of [
    "../src/components/public/NewsSection.jsx",
    "../src/components/public/FeaturedNewsCard.jsx",
  ]) {
    const src = read(file);
    assert.match(src, /plainExcerpt\(article\.body\)/, `${file} uses the stripped excerpt`);
    assert.doesNotMatch(
      src,
      /line-clamp-4[^>]*>\s*\{article\.body\}/,
      `${file} no longer prints the raw body`
    );
  }
});

test("the admin editor writes the same markdown the site renders", () => {
  const field = read("../src/components/admin/RichTextField.jsx");
  const manager = read("../src/components/admin/NewsManager.jsx");
  // Both the create and edit forms must use it, or one path silently loses the toolbar.
  assert.equal(
    (manager.match(/<RichTextField/g) || []).length,
    2,
    "both the new-article and edit-article bodies use the editor"
  );
  for (const marker of ['wrap\\("\\*\\*"', 'prefixLines\\("## "', 'prefixLines\\("- "']) {
    assert.match(field, new RegExp(marker), `toolbar emits ${marker}`);
  }
  assert.match(field, /UploadFile/, "the photo button uploads and inserts an image");
  // Plain text in, plain text out — nothing can inject HTML into a public page.
  // Checked against code only: the component's own comment names contentEditable
  // to explain why it deliberately does NOT use one.
  const fieldCode = field.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  assert.doesNotMatch(fieldCode, /dangerouslySetInnerHTML|contentEditable/);
});
