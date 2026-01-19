import { expect, test, describe, beforeAll, afterAll } from 'bun:test'
import {
  optionalFileSpec,
  parseToolVersions,
  parseMiseToml,
  readFirstLine,
  parseGemfileVersion,
  parseSdkmanVersion,
  parseIdiomaticFiles,
  idiomaticToolFiles,
} from '../../src/agent/parsers'
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

describe('idiomaticToolFiles', () => {
  test('contains mappings for common tools', () => {
    expect(idiomaticToolFiles.node).toContain('.nvmrc')
    expect(idiomaticToolFiles.node).toContain('.node-version')
    expect(idiomaticToolFiles.python).toContain('.python-version')
    expect(idiomaticToolFiles.ruby).toContain('.ruby-version')
    expect(idiomaticToolFiles.go).toContain('.go-version')
    expect(idiomaticToolFiles.bun).toContain('.bun-version')
  })
})

describe('readFirstLine', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-run-readline-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true })
  })

  test('returns null for non-existent file', async () => {
    const result = await readFirstLine('/nonexistent/path')
    expect(result).toBeNull()
  })

  test('reads first line from file', async () => {
    const filePath = join(tempDir, '.nvmrc')
    await writeFile(filePath, '20.11.0\n')
    const result = await readFirstLine(filePath)
    expect(result).toBe('20.11.0')
  })

  test('trims whitespace from first line', async () => {
    const filePath = join(tempDir, '.node-version')
    await writeFile(filePath, '  18.19.0  \n')
    const result = await readFirstLine(filePath)
    expect(result).toBe('18.19.0')
  })

  test('returns null for empty file', async () => {
    const filePath = join(tempDir, '.empty')
    await writeFile(filePath, '')
    const result = await readFirstLine(filePath)
    expect(result).toBeNull()
  })
})

describe('parseGemfileVersion', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-run-gemfile-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true })
  })

  test('extracts ruby version from Gemfile', async () => {
    const filePath = join(tempDir, 'Gemfile')
    await writeFile(filePath, 'source "https://rubygems.org"\nruby "3.3.0"\n')
    const result = await parseGemfileVersion(filePath)
    expect(result).toBe('3.3.0')
  })

  test('returns null when no ruby version', async () => {
    const filePath = join(tempDir, 'Gemfile2')
    await writeFile(filePath, 'source "https://rubygems.org"\n')
    const result = await parseGemfileVersion(filePath)
    expect(result).toBeNull()
  })

  test('extracts ruby version with single quotes', async () => {
    const filePath = join(tempDir, 'Gemfile3')
    await writeFile(filePath, "ruby '3.2.0'\n")
    const result = await parseGemfileVersion(filePath)
    expect(result).toBe('3.2.0')
  })

  test('returns null for non-existent file', async () => {
    const result = await parseGemfileVersion('/nonexistent/Gemfile')
    expect(result).toBeNull()
  })
})

describe('parseSdkmanVersion', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-run-sdkman-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true })
  })

  test('extracts java version from .sdkmanrc', async () => {
    const filePath = join(tempDir, '.sdkmanrc')
    await writeFile(filePath, '# SDKMAN config\njava=21.0.1-tem\n')
    const result = await parseSdkmanVersion(filePath)
    expect(result).toBe('21.0.1-tem')
  })

  test('returns null when no java version', async () => {
    const filePath = join(tempDir, '.sdkmanrc2')
    await writeFile(filePath, '# SDKMAN config\ngradle=8.0\n')
    const result = await parseSdkmanVersion(filePath)
    expect(result).toBeNull()
  })

  test('returns null for non-existent file', async () => {
    const result = await parseSdkmanVersion('/nonexistent/.sdkmanrc')
    expect(result).toBeNull()
  })
})

describe('parseIdiomaticFiles', () => {
  let tempDir: string
  let originalCwd: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-run-idiomatic-'))
    originalCwd = process.cwd()
    process.chdir(tempDir)
  })

  afterAll(async () => {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true })
  })

  test('parses idiomatic version files in current directory', async () => {
    // Create test files
    await writeFile(join(tempDir, '.nvmrc'), '20.11.0\n')
    await writeFile(join(tempDir, '.python-version'), '3.12.0\n')

    const result = await parseIdiomaticFiles()

    const nodeInfo = result.find((info) => info.tool === 'node')
    expect(nodeInfo).toBeDefined()
    expect(nodeInfo!.version).toBe('20.11.0')
    expect(nodeInfo!.path).toBe('.nvmrc')
    expect(nodeInfo!.configKey).toBe('node')

    const pythonInfo = result.find((info) => info.tool === 'python')
    expect(pythonInfo).toBeDefined()
    expect(pythonInfo!.version).toBe('3.12.0')
    expect(pythonInfo!.path).toBe('.python-version')
    expect(pythonInfo!.configKey).toBe('python')
  })

  test('returns empty array when no idiomatic files exist', async () => {
    // Create a new empty temp dir
    const emptyDir = await mkdtemp(join(tmpdir(), 'agent-run-empty-'))
    const prevCwd = process.cwd()
    process.chdir(emptyDir)

    const result = await parseIdiomaticFiles()
    expect(result).toEqual([])

    process.chdir(prevCwd)
    await rm(emptyDir, { recursive: true })
  })
})
