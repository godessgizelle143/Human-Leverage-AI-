import { parseMarkdown, type InlineSpan } from '@/lib/hke/markdown'

function Spans({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, index) =>
        span.bold ? <strong key={index} className="font-semibold text-white">{span.text}</strong>
          : span.italic ? <em key={index}>{span.text}</em>
            : <span key={index}>{span.text}</span>,
      )}
    </>
  )
}

/** Renders generated Markdown as React elements (no raw HTML injection). */
export default function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source)
  return (
    <div className="space-y-4 text-white/80 leading-7 break-words">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            if (block.level === 1) return <h2 key={index} className="text-2xl font-bold text-white pt-2"><Spans spans={block.spans} /></h2>
            if (block.level === 2) return <h3 key={index} className="text-xl font-semibold text-brand-gold pt-2"><Spans spans={block.spans} /></h3>
            return <h4 key={index} className="text-lg font-semibold text-white"><Spans spans={block.spans} /></h4>
          case 'paragraph':
            return <p key={index}><Spans spans={block.spans} /></p>
          case 'quote':
            return <blockquote key={index} className="border-l-2 border-brand-pink pl-4 italic text-white/70"><Spans spans={block.spans} /></blockquote>
          case 'rule':
            return <hr key={index} className="border-white/10" />
          case 'list': {
            const items = block.items.map((item, itemIndex) => <li key={itemIndex}><Spans spans={item} /></li>)
            return block.ordered
              ? <ol key={index} className="list-decimal pl-6 space-y-1.5">{items}</ol>
              : <ul key={index} className="list-disc pl-6 space-y-1.5 marker:text-brand-pink">{items}</ul>
          }
        }
      })}
    </div>
  )
}
