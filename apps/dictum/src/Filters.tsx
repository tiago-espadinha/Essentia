import type { DocFilter } from './documents'

interface FiltersProps {
  filter: DocFilter
  folders: string[]
  tags: string[]
  onChange: (filter: DocFilter) => void
}

// Select values: '*' is every folder or tag, '' (folders only) is unfiled.
const ALL = '*'

/** Search, and narrowing by folder and tag. */
export function Filters({ filter, folders, tags, onChange }: FiltersProps) {
  return (
    <div className="filters" role="search">
      <label htmlFor="search" className="visually-hidden">
        Search documents
      </label>
      <input
        id="search"
        className="field-input"
        type="search"
        placeholder="Search documents"
        value={filter.query}
        onChange={(event) => onChange({ ...filter, query: event.target.value })}
      />
      <div className="filters__selects">
        <label className="filters__field">
          <span className="label">Folder</span>
          <select
            className="field-input"
            value={filter.folder ?? ALL}
            onChange={(event) => onChange({ ...filter, folder: event.target.value === ALL ? null : event.target.value })}
          >
            <option value={ALL}>All folders</option>
            <option value="">Unfiled</option>
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
        </label>
        <label className="filters__field">
          <span className="label">Tag</span>
          <select
            className="field-input"
            value={filter.tag ?? ALL}
            disabled={tags.length === 0}
            onChange={(event) => onChange({ ...filter, tag: event.target.value === ALL ? null : event.target.value })}
          >
            <option value={ALL}>All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
