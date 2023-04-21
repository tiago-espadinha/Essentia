import { t } from '../locale'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

// A link out leaves the writing (or the shared page) open, and tells the next site
// nothing; a link within the text (a footnote) stays in the page.
const components: Components = {
  a: ({ href, title, children }) =>
    href?.startsWith('#') ? (
      <a href={href} title={title}>
        {children}
      </a>
    ) : (
      <a href={href} title={title} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  // A task list's box can't be ticked here, so screen readers hear its state as words
  // instead of an unlabelled, unavailable checkbox.
  // Raw HTML is never parsed, so the only input is a task's box.
  input: ({ checked }) => (
    <>
      <input type="checkbox" checked={checked} disabled aria-hidden="true" />
      <span className="visually-hidden">{t(checked ? 'Done:' : 'To do:')}</span>
    </>
  ),
}

// On a shared page an image would load from wherever its author chose, telling
// them who read the note and when, so it shows as a link to the image instead.
const sharedComponents: Components = {
  ...components,
  img: ({ src, alt }) => (
    <a href={typeof src === 'string' ? src : undefined} target="_blank" rel="noopener noreferrer">
      {alt || t('Image')}
    </a>
  ),
}

/**
 * The rendered markdown. Raw HTML in the source is shown as text, never parsed
 * (no rehype-raw), and react-markdown drops unsafe link protocols. Loaded on its
 * own (see MarkdownBody), since the parser and highlighter outweigh the rest of the app.
 */
export default function Preview({ content, shared = false }: { content: string; shared?: boolean }) {
  if (!content.trim()) return <p className="preview__idle">{t('The preview shows here as you write.')}</p>
  return (
    <div className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={shared ? sharedComponents : components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
