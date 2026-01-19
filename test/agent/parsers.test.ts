import { expect, test, describe, beforeAll, afterAll } from 'bun:test'
import { optionalFileSpec } from '../../src/agent/parsers'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('optionalFileSpec', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-run-test-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true })
  })

  test('returns null for non-existent file', async () => {
    const result = await optionalFileSpec(join(tempDir, 'nonexistent'))
    expect(result).toBeNull()
  })

  test('returns file spec for existing file', async () => {
    const filePath = join(tempDir, 'test.txt')
    await writeFile(filePath, 'hello world', { mode: 0o644 })

    const result = await optionalFileSpec(filePath)
    expect(result).not.toBeNull()
    expect(result!.path).toBe(filePath)
    expect(new TextDecoder().decode(result!.data)).toBe('hello world')
    expect(result!.mode).toBe(0o644)
  })
})
