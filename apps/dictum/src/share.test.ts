import { describe, expect, it } from 'vitest'
import { readSharePath, shareUrl } from './share'

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('share links', () => {
  it('build under the app’s base path', () => {
    expect(shareUrl(ID, '/dictum/', 'https://essentia.example')).toBe(`https://essentia.example/dictum/shared/${ID}`)
  })

  it('are read back relative to the base path, with or without a trailing slash', () => {
    expect(readSharePath(`/dictum/shared/${ID}`, '/dictum/')).toEqual({ id: ID })
    expect(readSharePath(`/dictum/shared/${ID}/`, '/dictum/')).toEqual({ id: ID })
    expect(readSharePath(`/dictum/shared/${ID.toUpperCase()}`, '/dictum/')).toEqual({ id: ID })
  })

  it('have no id when the last part cannot be one', () => {
    expect(readSharePath('/dictum/shared/', '/dictum/')).toEqual({ id: null })
    expect(readSharePath('/dictum/shared/abc', '/dictum/')).toEqual({ id: null })
    expect(readSharePath(`/dictum/shared/${ID}/extra`, '/dictum/')).toEqual({ id: null })
  })

  it('are not matched outside the app’s shared path', () => {
    expect(readSharePath('/dictum/', '/dictum/')).toBeNull()
    expect(readSharePath(`/shared/${ID}`, '/dictum/')).toBeNull()
    expect(readSharePath(`/folio/shared/${ID}`, '/dictum/')).toBeNull()
  })
})
