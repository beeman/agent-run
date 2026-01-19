import { expect, test, describe, beforeAll, afterAll } from 'bun:test'
import { optionalFileSpec, parseToolVersions, parseMiseToml } from '../../src/agent/parsers'
import type { FileSpec } from '../../src/agent/types'
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

describe('parseToolVersions', () => {
  test('returns empty array for null input', () => {
    const result = parseToolVersions(null)
    expect(result).toEqual([])
  })

  test('parses .tool-versions format', () => {
    const fileSpec: FileSpec = {
      path: '.tool-versions',
      data: new TextEncoder().encode('node 20.11.0\npython 3.12.0\n# comment\nruby 3.3.0'),
      mode: 0o644,
    }
    const result = parseToolVersions(fileSpec)
    expect(result).toEqual([
      { name: 'node', version: '20.11.0' },
      { name: 'python', version: '3.12.0' },
      { name: 'ruby', version: '3.3.0' },
    ])
  })

  test('defaults to latest when no version specified', () => {
    const fileSpec: FileSpec = {
      path: '.tool-versions',
      data: new TextEncoder().encode('node'),
      mode: 0o644,
    }
    const result = parseToolVersions(fileSpec)
    expect(result).toEqual([{ name: 'node', version: 'latest' }])
  })
})

describe('parseMiseToml', () => {
  test('returns empty array for null input', () => {
    const result = parseMiseToml(null)
    expect(result).toEqual([])
  })

  test('parses mise.toml [tools] section', () => {
    const content = `
[tools]
node = "20.11.0"
python = "3.12.0"
`
    const fileSpec: FileSpec = {
      path: 'mise.toml',
      data: new TextEncoder().encode(content),
      mode: 0o644,
    }
    const result = parseMiseToml(fileSpec)
    expect(result).toContainEqual({ name: 'node', version: '20.11.0' })
    expect(result).toContainEqual({ name: 'python', version: '3.12.0' })
  })

  test('parses mise.toml [[tool]] sections', () => {
    const content = `
[[tool]]
name = "node"
version = "20.11.0"

[[tool]]
name = "python"
version = "3.12.0"
`
    const fileSpec: FileSpec = {
      path: 'mise.toml',
      data: new TextEncoder().encode(content),
      mode: 0o644,
    }
    const result = parseMiseToml(fileSpec)
    expect(result).toContainEqual({ name: 'node', version: '20.11.0' })
    expect(result).toContainEqual({ name: 'python', version: '3.12.0' })
  })
})
