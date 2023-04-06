import { describe, expect, it } from 'vitest'
import { isUuid, sha256, uuidFromHash } from '../domain/ids'

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

describe('sha256', () => {
  // FIPS 180-4 / NIST example vectors.
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
  ])('hashes %j', (text, digest) => {
    expect(hex(sha256(text))).toBe(digest)
  })

  it('hashes a million characters across many blocks', () => {
    expect(hex(sha256('a'.repeat(1_000_000)))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0')
  })

  it('hashes the UTF-8 bytes of non-ASCII text', () => {
    expect(hex(sha256('é'))).toBe('4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c')
  })

  it('pads correctly at the 55/56-byte boundary', () => {
    expect(hex(sha256('a'.repeat(55)))).toBe('9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318')
    expect(hex(sha256('a'.repeat(56)))).toBe('b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a')
  })
})

describe('note ids', () => {
  it('accepts only lowercase version-4 UUIDs', () => {
    expect(isUuid('1b4e28ba-2fa1-4d2a-883f-0016d3cca427')).toBe(true)
    expect(isUuid('1B4E28BA-2FA1-4D2A-883F-0016D3CCA427')).toBe(false)
    expect(isUuid('0f8fad5bd9cb469fa16570867728950e')).toBe(false)
    expect(isUuid('1b4e28ba-2fa1-1d2a-883f-0016d3cca427')).toBe(false)
    expect(isUuid('a')).toBe(false)
  })

  it('derives the same version-4 id from the same text', () => {
    const id = uuidFromHash('essentia-folio:0f8fad5bd9cb469fa16570867728950e')
    expect(id).toBe('fa735e75-573e-4f7e-8ae1-dc081571d8a4')
    expect(uuidFromHash('essentia-folio:0f8fad5bd9cb469fa16570867728950e')).toBe(id)
    expect(isUuid(id)).toBe(true)
    expect(uuidFromHash('essentia-folio:other')).not.toBe(id)
  })
})
