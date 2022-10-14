import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

/**
 * The rendered markdown. Raw HTML in the source is shown as text, never parsed
 * (no rehype-raw), and react-markdown drops unsafe link protocols. Loaded on its
 * own (see Editor), since the parser and highlighter outweigh the rest of the app.
 */
export default function Preview({ content }: { content: string }) {
  if (!content.trim()) return <p className="preview__idle">The preview shows here as you write.</p>
  return (
    <div className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
