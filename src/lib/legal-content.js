/**
 * Parse the plain-text format used by the admin-editable legal pages.
 *
 * A line containing only `[Heading]` starts a heading, even when it is not
 * surrounded by blank lines. Other consecutive non-empty lines form a
 * paragraph; blank lines end the current paragraph.
 */
export function parseLegalContent(value) {
  const blocks = [];
  let paragraphLines = [];

  const flushParagraph = () => {
    const text = paragraphLines.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
    paragraphLines = [];
  };

  for (const rawLine of String(value || "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    const heading = line.match(/^\[([^\[\]]+)\]$/);

    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", text: heading[1].trim() });
    } else if (!line) {
      flushParagraph();
    } else {
      paragraphLines.push(line);
    }
  }

  flushParagraph();
  return blocks;
}
