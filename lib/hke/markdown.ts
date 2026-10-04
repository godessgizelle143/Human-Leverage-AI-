// A deliberately small Markdown subset for generated assets: headings,
// paragraphs, bullet/numbered lists, quotes, rules, and **bold**/*italic*.
// It produces structured blocks so the UI never needs dangerouslySetInnerHTML,
// and the HTML export escapes every piece of text.

export type InlineSpan = { text: string; bold?: boolean; italic?: boolean }

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; spans: InlineSpan[] }
  | { type: 'paragraph'; spans: InlineSpan[] }
  | { type: 'list'; ordered: boolean; items: InlineSpan[][] }
  | { type: 'quote'; spans: InlineSpan[] }
  | { type: 'rule' }

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const index = match.index
    if (index > last) spans.push({ text: text.slice(last, index) })
    const token = match[0]
    if (token.startsWith('**')) spans.push({ text: token.slice(2, -2), bold: true })
    else spans.push({ text: token.slice(1, -1), italic: true })
    last = index + token.length
  }
  if (last < text.length) spans.push({ text: text.slice(last) })
  return spans
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  let paragraph: string[] = []
  let list: { ordered: boolean; items: InlineSpan[][] } | null = null

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', spans: parseInline(paragraph.join(' ')) })
    paragraph = []
  }
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ...list })
    list = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) { flushParagraph(); flushList(); continue }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph(); flushList()
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 3) as 1 | 2 | 3, spans: parseInline(heading[2]) })
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flushParagraph(); flushList(); blocks.push({ type: 'rule' }); continue }

    const bullet = /^[-*+]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      flushParagraph()
      const ordered = !!numbered
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] } }
      list.items.push(parseInline((bullet ?? numbered)![1]))
      continue
    }

    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) { flushParagraph(); flushList(); blocks.push({ type: 'quote', spans: parseInline(quote[1]) }); continue }

    flushList()
    paragraph.push(line)
  }
  flushParagraph()
  flushList()
  return blocks
}

export function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function spansToHtml(spans: InlineSpan[]) {
  return spans
    .map((span) => {
      const text = escapeHtml(span.text)
      if (span.bold) return `<strong>${text}</strong>`
      if (span.italic) return `<em>${text}</em>`
      return text
    })
    .join('')
}

export function markdownToHtml(source: string) {
  return parseMarkdown(source)
    .map((block) => {
      switch (block.type) {
        case 'heading': return `<h${block.level}>${spansToHtml(block.spans)}</h${block.level}>`
        case 'paragraph': return `<p>${spansToHtml(block.spans)}</p>`
        case 'quote': return `<blockquote>${spansToHtml(block.spans)}</blockquote>`
        case 'rule': return '<hr />'
        case 'list': {
          const tag = block.ordered ? 'ol' : 'ul'
          return `<${tag}>${block.items.map((item) => `<li>${spansToHtml(item)}</li>`).join('')}</${tag}>`
        }
      }
    })
    .join('\n')
}

/** A standalone, print-ready HTML document (open it and use Print → Save as PDF). */
export function printableHtmlDocument(title: string, markdown: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #171512; max-width: 720px; margin: 48px auto; padding: 0 24px; line-height: 1.65; }
  h1, h2, h3 { font-family: Helvetica, Arial, sans-serif; line-height: 1.25; }
  h1 { font-size: 2rem; border-bottom: 3px solid #D4AF37; padding-bottom: .4rem; }
  h2 { font-size: 1.4rem; margin-top: 2rem; color: #b0127a; }
  h3 { font-size: 1.1rem; margin-top: 1.5rem; }
  blockquote { border-left: 3px solid #FF1493; margin: 1rem 0; padding: .25rem 1rem; color: #444; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 2rem 0; }
  footer { margin-top: 3rem; font: 12px Helvetica, Arial, sans-serif; color: #888; }
  @media print { body { margin: 0 auto; } }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${markdownToHtml(markdown)}
<footer>Created with HKE AI — Speak Once. Build Forever.</footer>
</body>
</html>`
}

export function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'hke-asset'
}
