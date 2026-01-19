# agent-run TypeScript Fork Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fork agent-en-place (Go) into TypeScript with Bun runtime, maintaining structural similarity for easy upstream syncing.

**Architecture:** CLI tool that detects project tool versions, generates Dockerfiles with mise-managed tooling, builds images via Testcontainers, and outputs `docker run` commands. Maintains Go function/variable naming (camelCase for TS idiom).

**Tech Stack:** TypeScript, Bun runtime, Testcontainers for Docker, Commander for CLI parsing.

---

## Task 1: Project Setup - Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Add required dependencies**

```bash
bun add testcontainers commander
bun add -d @types/node
```

**Step 2: Verify installation**

Run: `bun install`
Expected: Lock file updated, no errors

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "feat: add testcontainers and commander dependencies"
```

---

## Task 2: Create Project Structure

**Files:**
- Create: `src/agent/index.ts`
- Create: `src/agent/config.ts`
- Create: `src/agent/parsers.ts`
- Create: `src/agent/docker.ts`
- Create: `src/agent/dockerfile.ts`
- Create: `src/assets/agent-entrypoint.sh`

**Step 1: Create directory structure**

```bash
mkdir -p src/agent src/assets
```

**Step 2: Create the entrypoint script**

Create `src/assets/agent-entrypoint.sh`:

```bash
#!/bin/bash
if [ $# -eq 0 ]; then
  exec /bin/bash --login -i
else
  exec /bin/bash --login -c "$*"
fi
```

**Step 3: Commit**

```bash
git add src/agent src/assets
git commit -m "chore: create agent module directory structure"
```

---

## Task 3: Types and Config Module

**Files:**
- Create: `src/agent/types.ts`
- Create: `src/agent/config.ts`
- Test: `test/agent/config.test.ts`

**Step 1: Write failing test for toolSpecs**

Create `test/agent/config.test.ts`:

```typescript
import { expect, test, describe } from 'bun:test'
import { toolSpecs, type ToolSpec } from '../src/agent/config'

describe('toolSpecs', () => {
  test('contains codex configuration', () => {
    expect(toolSpecs.codex).toBeDefined()
    expect(toolSpecs.codex.miseToolName).toBe('npm:@openai/codex')
    expect(toolSpecs.codex.command).toContain('codex')
    expect(toolSpecs.codex.configDir).toBe('.codex')
  })

  test('contains gemini configuration', () => {
    expect(toolSpecs.gemini).toBeDefined()
    expect(toolSpecs.gemini.miseToolName).toBe('npm:@google/gemini-cli')
    expect(toolSpecs.gemini.command).toContain('gemini')
    expect(toolSpecs.gemini.configDir).toBe('.gemini')
  })

  test('contains copilot configuration', () => {
    expect(toolSpecs.copilot).toBeDefined()
    expect(toolSpecs.copilot.envVars).toContain('GH_TOKEN="$(gh auth token -h github.com)"')
  })

  test('contains opencode configuration', () => {
    expect(toolSpecs.opencode).toBeDefined()
    expect(toolSpecs.opencode.additionalMounts).toContain('.local/share/opencode')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test test/agent/config.test.ts`
Expected: FAIL - cannot find module

**Step 3: Create types module**

Create `src/agent/types.ts`:

```typescript
// Mirrors Go: type Config struct
export interface Config {
  debug: boolean
  rebuild: boolean
  dockerfileOnly: boolean
  tool: string
}

// Mirrors Go: type ToolSpec struct
export interface ToolSpec {
  miseToolName: string
  configKey: string
  command: string
  configDir: string
  additionalMounts?: string[]
  envVars?: string[]
}

// Mirrors Go: type fileSpec struct
export interface FileSpec {
  path: string
  data: Uint8Array
  mode: number
}

// Mirrors Go: type toolDescriptor struct
export interface ToolDescriptor {
  name: string
  version: string
}

// Mirrors Go: type idiomaticInfo struct
export interface IdiomaticInfo {
  tool: string
  version: string
  path: string
  configKey: string
}

// Mirrors Go: type collectResult struct
export interface CollectResult {
  specs: ToolDescriptor[]
  idiomaticPaths: string[]
  idiomaticInfos: IdiomaticInfo[]
}

export const validTools = ['codex', 'opencode', 'copilot', 'gemini'] as const
export type ValidTool = (typeof validTools)[number]

export function isValidTool(tool: string): tool is ValidTool {
  return validTools.includes(tool as ValidTool)
}
```

**Step 4: Create config module**

Create `src/agent/config.ts`:

```typescript
import type { ToolSpec } from './types'

export type { ToolSpec }

// Mirrors Go: var toolSpecs = map[string]ToolSpec
export const toolSpecs: Record<string, ToolSpec> = {
  codex: {
    miseToolName: 'npm:@openai/codex',
    configKey: 'npm:@openai/codex',
    command: 'codex --dangerously-bypass-approvals-and-sandbox',
    configDir: '.codex',
  },
  opencode: {
    miseToolName: 'npm:opencode-ai',
    configKey: 'npm:opencode-ai',
    command: 'opencode',
    configDir: '.config/opencode/',
    additionalMounts: ['.local/share/opencode'],
  },
  copilot: {
    miseToolName: 'npm:@github/copilot',
    configKey: 'npm:@github/copilot',
    command: 'copilot --allow-all-tools --allow-all-paths --allow-all-urls',
    configDir: '.copilot',
    envVars: ['GH_TOKEN="$(gh auth token -h github.com)"'],
  },
  gemini: {
    miseToolName: 'npm:@google/gemini-cli',
    configKey: 'npm:@google/gemini-cli',
    command: 'gemini --yolo',
    configDir: '.gemini',
  },
}

// Mirrors Go: const imageRepository
export const imageRepository = 'mheap/agent-en-place'
```

**Step 5: Run test to verify it passes**

Run: `bun test test/agent/config.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/agent/types.ts src/agent/config.ts test/agent/config.test.ts
git commit -m "feat: add types and config module mirroring Go structs"
```

---

## Task 4: Parsers Module - File Reading

**Files:**
- Create: `src/agent/parsers.ts`
- Test: `test/agent/parsers.test.ts`

**Step 1: Write failing test for optionalFileSpec**

Create `test/agent/parsers.test.ts`:

```typescript
import { expect, test, describe, beforeAll, afterAll } from 'bun:test'
import { optionalFileSpec } from '../src/agent/parsers'
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
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test test/agent/parsers.test.ts`
Expected: FAIL - cannot find module

**Step 3: Implement optionalFileSpec**

Create `src/agent/parsers.ts`:

```typescript
import type { FileSpec, ToolDescriptor, IdiomaticInfo } from './types'

// Mirrors Go: func optionalFileSpec(path string) (*fileSpec, error)
export async function optionalFileSpec(path: string): Promise<FileSpec | null> {
  const file = Bun.file(path)
  const exists = await file.exists()
  if (!exists) {
    return null
  }

  const data = new Uint8Array(await file.arrayBuffer())
  // Bun doesn't expose file mode directly, default to 0o644
  const stat = await file.stat?.() ?? { mode: 0o644 }

  return {
    path,
    data,
    mode: typeof stat === 'object' && 'mode' in stat ? (stat.mode & 0o777) : 0o644,
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test test/agent/parsers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agent/parsers.ts test/agent/parsers.test.ts
git commit -m "feat: add optionalFileSpec function"
```

---

## Task 5: Parsers Module - Tool Version Parsing

**Files:**
- Modify: `src/agent/parsers.ts`
- Modify: `test/agent/parsers.test.ts`

**Step 1: Write failing test for parseToolVersions**

Add to `test/agent/parsers.test.ts`:

```typescript
import { parseToolVersions, parseMiseToml } from '../src/agent/parsers'

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

  test('parses mise.toml format', () => {
    const content = `
[tools]
node = "20.11.0"
python = "3.12.0"

[[tool]]
name = "ruby"
version = "3.3.0"
`
    const fileSpec: FileSpec = {
      path: 'mise.toml',
      data: new TextEncoder().encode(content),
      mode: 0o644,
    }
    const result = parseMiseToml(fileSpec)
    expect(result.length).toBeGreaterThan(0)
  })
})
```

Also add import for `FileSpec`:

```typescript
import type { FileSpec } from '../src/agent/types'
```

**Step 2: Run test to verify it fails**

Run: `bun test test/agent/parsers.test.ts`
Expected: FAIL

**Step 3: Implement parseToolVersions and parseMiseToml**

Add to `src/agent/parsers.ts`:

```typescript
// Mirrors Go: func parseToolVersions(spec *fileSpec) []toolDescriptor
export function parseToolVersions(spec: FileSpec | null): ToolDescriptor[] {
  if (!spec) {
    return []
  }

  const content = new TextDecoder().decode(spec.data)
  const lines = content.split('\n')
  const specs: ToolDescriptor[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }

    const fields = trimmed.split(/\s+/)
    if (fields.length === 0) {
      continue
    }

    const name = fields[0]
    const version = fields.length > 1 ? fields[1] : 'latest'
    specs.push({ name, version })
  }

  return specs
}

// Mirrors Go: func parseMiseToml(spec *fileSpec) []toolDescriptor
export function parseMiseToml(spec: FileSpec | null): ToolDescriptor[] {
  if (!spec) {
    return []
  }

  const content = new TextDecoder().decode(spec.data)
  const lines = content.split('\n')
  const specs: ToolDescriptor[] = []

  let insideTool = false
  let current: Partial<ToolDescriptor> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }

    // Handle [[tool]] or [tool] sections
    if (trimmed.startsWith('[[tool') || trimmed.startsWith('[tool')) {
      insideTool = true
      current = {}
      continue
    }

    // Exit tool section on new section
    if (trimmed.startsWith('[')) {
      insideTool = false
      continue
    }

    // Parse [tools] section (simple key = value format)
    if (!insideTool && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      let value = trimmed.slice(idx + 1).trim()
      value = value.replace(/^["']|["']$/g, '')

      if (key && value) {
        specs.push({ name: key, version: value })
      }
      continue
    }

    // Parse [[tool]] section entries
    if (insideTool && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      let value = trimmed.slice(idx + 1).trim()
      value = value.replace(/^["']|["']$/g, '')

      if (key === 'name') {
        current.name = value
      } else if (key === 'version') {
        current.version = value
      }

      if (current.name && current.version) {
        specs.push({ name: current.name, version: current.version })
        current = {}
      }
    }
  }

  return specs
}
```

**Step 4: Run test to verify it passes**

Run: `bun test test/agent/parsers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agent/parsers.ts test/agent/parsers.test.ts
git commit -m "feat: add parseToolVersions and parseMiseToml functions"
```

---

## Task 6: Parsers Module - Idiomatic Version Files

**Files:**
- Modify: `src/agent/parsers.ts`
- Modify: `test/agent/parsers.test.ts`

**Step 1: Write failing test for idiomatic file parsing**

Add to `test/agent/parsers.test.ts`:

```typescript
import { readFirstLine, parseGemfileVersion, parseSdkmanVersion, idiomaticToolFiles } from '../src/agent/parsers'

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
})

describe('parseGemfileVersion', () => {
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
})

describe('parseSdkmanVersion', () => {
  test('extracts java version from .sdkmanrc', async () => {
    const filePath = join(tempDir, '.sdkmanrc')
    await writeFile(filePath, '# SDKMAN config\njava=21.0.1-tem\n')
    const result = await parseSdkmanVersion(filePath)
    expect(result).toBe('21.0.1-tem')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test test/agent/parsers.test.ts`
Expected: FAIL

**Step 3: Implement idiomatic parsing functions**

Add to `src/agent/parsers.ts`:

```typescript
// Mirrors Go: var idiomaticToolFiles = map[string][]string
export const idiomaticToolFiles: Record<string, string[]> = {
  crystal: ['.crystal-version'],
  elixir: ['.exenv-version'],
  go: ['.go-version'],
  java: ['.java-version', '.sdkmanrc'],
  node: ['.nvmrc', '.node-version'],
  python: ['.python-version', '.python-versions'],
  ruby: ['.ruby-version', 'Gemfile'],
  yarn: ['.yvmrc'],
  bun: ['.bun-version'],
}

// Mirrors Go: func readFirstLine(path string) (string, bool)
export async function readFirstLine(path: string): Promise<string | null> {
  try {
    const file = Bun.file(path)
    const exists = await file.exists()
    if (!exists) {
      return null
    }

    const content = await file.text()
    const line = content.split('\n')[0]?.trim()
    return line || null
  } catch {
    return null
  }
}

// Mirrors Go: func parseGemfileVersion(path string) (string, bool)
export async function parseGemfileVersion(path: string): Promise<string | null> {
  try {
    const file = Bun.file(path)
    const exists = await file.exists()
    if (!exists) {
      return null
    }

    const content = await file.text()
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('#')) {
        continue
      }

      if (trimmed.startsWith('ruby')) {
        const fields = trimmed.split(/\s+/)
        if (fields.length >= 2) {
          const version = fields[1].replace(/^["']|["']$/g, '')
          return version || null
        }
      }
    }

    return null
  } catch {
    return null
  }
}

// Mirrors Go: func parseSdkmanVersion(path string) (string, bool)
export async function parseSdkmanVersion(path: string): Promise<string | null> {
  try {
    const file = Bun.file(path)
    const exists = await file.exists()
    if (!exists) {
      return null
    }

    const content = await file.text()
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('java=')) {
        const version = trimmed.slice(5)
        return version || null
      }
    }

    return null
  } catch {
    return null
  }
}

// Mirrors Go: func readIdiomaticVersion(tool, path string) (string, bool)
export async function readIdiomaticVersion(tool: string, path: string): Promise<string | null> {
  switch (path) {
    case 'Gemfile':
      return parseGemfileVersion(path)
    case '.sdkmanrc':
      return parseSdkmanVersion(path)
    default:
      return readFirstLine(path)
  }
}

// Mirrors Go: func parseIdiomaticFiles() []idiomaticInfo
export async function parseIdiomaticFiles(): Promise<IdiomaticInfo[]> {
  const infos: IdiomaticInfo[] = []

  for (const [tool, paths] of Object.entries(idiomaticToolFiles)) {
    for (const path of paths) {
      const version = await readIdiomaticVersion(tool, path)
      if (!version) {
        continue
      }

      const configKey = tool.includes(':') ? tool : tool
      infos.push({ tool, version, path, configKey })
      break // Only use first matching file per tool
    }
  }

  return infos
}
```

**Step 4: Run test to verify it passes**

Run: `bun test test/agent/parsers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agent/parsers.ts test/agent/parsers.test.ts
git commit -m "feat: add idiomatic version file parsing functions"
```

---

## Task 7: Parsers Module - Tool Collection

**Files:**
- Modify: `src/agent/parsers.ts`
- Modify: `test/agent/parsers.test.ts`

**Step 1: Write failing test for collection functions**

Add to `test/agent/parsers.test.ts`:

```typescript
import {
  dedupeToolSpecs,
  ensureDefaultTool,
  ensureNodeTool,
  uniquePaths,
  sanitizeTagComponent,
} from '../src/agent/parsers'
import { toolSpecs } from '../src/agent/config'

describe('dedupeToolSpecs', () => {
  test('removes duplicates keeping first occurrence', () => {
    const specs: ToolDescriptor[] = [
      { name: 'node', version: '20.0.0' },
      { name: 'node', version: '18.0.0' },
      { name: 'python', version: '3.12.0' },
    ]
    const result = dedupeToolSpecs(specs)
    expect(result).toEqual([
      { name: 'node', version: '20.0.0' },
      { name: 'python', version: '3.12.0' },
    ])
  })

  test('defaults empty version to latest', () => {
    const specs: ToolDescriptor[] = [{ name: 'node', version: '' }]
    const result = dedupeToolSpecs(specs)
    expect(result).toEqual([{ name: 'node', version: 'latest' }])
  })
})

describe('ensureDefaultTool', () => {
  test('adds tool if not present', () => {
    const specs: ToolDescriptor[] = [{ name: 'node', version: '20.0.0' }]
    const result = ensureDefaultTool(specs, toolSpecs.codex)
    expect(result.some((s) => s.name === 'npm:@openai/codex')).toBe(true)
  })

  test('does not duplicate existing tool', () => {
    const specs: ToolDescriptor[] = [{ name: 'npm:@openai/codex', version: '1.0.0' }]
    const result = ensureDefaultTool(specs, toolSpecs.codex)
    expect(result.filter((s) => s.name === 'npm:@openai/codex').length).toBe(1)
  })
})

describe('ensureNodeTool', () => {
  test('adds node if not present', () => {
    const specs: ToolDescriptor[] = [{ name: 'python', version: '3.12.0' }]
    const result = ensureNodeTool(specs)
    expect(result.some((s) => s.name === 'node')).toBe(true)
  })

  test('does not duplicate existing node', () => {
    const specs: ToolDescriptor[] = [{ name: 'node', version: '20.0.0' }]
    const result = ensureNodeTool(specs)
    expect(result.filter((s) => s.name === 'node').length).toBe(1)
  })
})

describe('sanitizeTagComponent', () => {
  test('lowercases and sanitizes', () => {
    expect(sanitizeTagComponent('Node.js')).toBe('node.js')
    expect(sanitizeTagComponent('npm:@openai/codex')).toBe('npm--openai-codex')
    expect(sanitizeTagComponent('python_3.12')).toBe('python-3.12')
  })

  test('removes leading/trailing hyphens', () => {
    expect(sanitizeTagComponent('-foo-')).toBe('foo')
  })
})

describe('uniquePaths', () => {
  test('returns unique paths only', () => {
    const infos: IdiomaticInfo[] = [
      { tool: 'node', version: '20', path: '.nvmrc', configKey: 'node' },
      { tool: 'node', version: '18', path: '.nvmrc', configKey: 'node' },
      { tool: 'python', version: '3.12', path: '.python-version', configKey: 'python' },
    ]
    const result = uniquePaths(infos)
    expect(result).toEqual(['.nvmrc', '.python-version'])
  })

  test('filters out empty paths', () => {
    const infos: IdiomaticInfo[] = [
      { tool: 'node', version: '20', path: '', configKey: 'node' },
      { tool: 'python', version: '3.12', path: '.python-version', configKey: 'python' },
    ]
    const result = uniquePaths(infos)
    expect(result).toEqual(['.python-version'])
  })
})
```

Add import for `IdiomaticInfo` and `ToolDescriptor`:

```typescript
import type { FileSpec, ToolDescriptor, IdiomaticInfo } from '../src/agent/types'
```

**Step 2: Run test to verify it fails**

Run: `bun test test/agent/parsers.test.ts`
Expected: FAIL

**Step 3: Implement collection functions**

Add to `src/agent/parsers.ts`:

```typescript
import type { ToolSpec } from './types'

// Mirrors Go: func sanitizeTagComponent(value string) string
export function sanitizeTagComponent(value: string): string {
  let result = value.toLowerCase().trim()
  let output = ''
  let lastHyphen = false

  for (const char of result) {
    if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) {
      output += char
      lastHyphen = false
    } else if (char === '.') {
      output += '.'
      lastHyphen = false
    } else if (['+', '@', ':', '/', '_', '-'].includes(char)) {
      if (!lastHyphen) {
        output += '-'
        lastHyphen = true
      }
    }
    // Skip other characters
  }

  // Remove leading/trailing hyphens
  return output.replace(/^-+|-+$/g, '')
}

// Mirrors Go: func dedupeToolSpecs(specs []toolDescriptor) []toolDescriptor
export function dedupeToolSpecs(specs: ToolDescriptor[]): ToolDescriptor[] {
  const seen = new Set<string>()
  const result: ToolDescriptor[] = []

  for (const spec of specs) {
    const key = sanitizeTagComponent(spec.name)
    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    const version = spec.version || 'latest'
    result.push({ name: key, version })
  }

  return result
}

// Mirrors Go: func ensureDefaultTool(specs []toolDescriptor, toolSpec ToolSpec) []toolDescriptor
export function ensureDefaultTool(specs: ToolDescriptor[], toolSpec: ToolSpec): ToolDescriptor[] {
  for (const spec of specs) {
    if (spec.name === toolSpec.miseToolName) {
      return specs
    }
  }
  return [...specs, { name: toolSpec.miseToolName, version: 'latest' }]
}

// Mirrors Go: func ensureNodeTool(specs []toolDescriptor) []toolDescriptor
export function ensureNodeTool(specs: ToolDescriptor[]): ToolDescriptor[] {
  for (const spec of specs) {
    if (spec.name === 'node') {
      return specs
    }
  }
  return [...specs, { name: 'node', version: 'latest' }]
}

// Mirrors Go: func ensureToolInfo(infos []idiomaticInfo, spec ToolSpec) []idiomaticInfo
export function ensureToolInfo(infos: IdiomaticInfo[], spec: ToolSpec): IdiomaticInfo[] {
  for (const info of infos) {
    if (info.configKey === spec.configKey) {
      return infos
    }
  }
  return [...infos, { tool: spec.miseToolName, version: 'latest', path: '', configKey: spec.configKey }]
}

// Mirrors Go: func ensureNodeInfo(infos []idiomaticInfo) []idiomaticInfo
export function ensureNodeInfo(infos: IdiomaticInfo[]): IdiomaticInfo[] {
  for (const info of infos) {
    if (info.configKey === 'node') {
      return infos
    }
  }
  return [...infos, { tool: 'node', version: 'latest', path: '', configKey: 'node' }]
}

// Mirrors Go: func uniquePaths(infos []idiomaticInfo) []string
export function uniquePaths(infos: IdiomaticInfo[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const info of infos) {
    if (!info.path || seen.has(info.path)) {
      continue
    }
    seen.add(info.path)
    result.push(info.path)
  }

  return result
}

// Mirrors Go: func containsNodeSpec(spec *fileSpec) bool
export function containsNodeSpec(spec: FileSpec | null): boolean {
  if (!spec) {
    return false
  }
  const content = new TextDecoder().decode(spec.data)
  return content.toLowerCase().includes('node')
}

// Mirrors Go: func hasNodeTool(specs []toolDescriptor) bool
export function hasNodeTool(specs: ToolDescriptor[]): boolean {
  return specs.some((spec) => spec.name === 'node')
}

// Mirrors Go: func collectionHasNode(toolFile, miseFile *fileSpec, collection collectResult) bool
export function collectionHasNode(
  toolFile: FileSpec | null,
  miseFile: FileSpec | null,
  collection: CollectResult
): boolean {
  if (containsNodeSpec(toolFile) || containsNodeSpec(miseFile)) {
    return true
  }
  return hasNodeTool(collection.specs)
}

// Mirrors Go: func collectToolSpecs(toolFile, miseFile *fileSpec, spec ToolSpec) collectResult
export async function collectToolSpecs(
  toolFile: FileSpec | null,
  miseFile: FileSpec | null,
  spec: ToolSpec
): Promise<CollectResult> {
  let specs = parseToolVersions(toolFile)
  specs = [...specs, ...parseMiseToml(miseFile)]

  const idiomatic = await parseIdiomaticFiles()
  for (const info of idiomatic) {
    if (!info.version) {
      continue
    }
    specs.push({ name: info.tool, version: info.version })
  }

  let deduped = dedupeToolSpecs(specs)
  deduped = ensureDefaultTool(deduped, spec)
  deduped = ensureNodeTool(deduped)

  let infos = ensureToolInfo(idiomatic, spec)
  infos = ensureNodeInfo(infos)

  return {
    specs: deduped,
    idiomaticPaths: uniquePaths(infos),
    idiomaticInfos: infos,
  }
}
```

Add `CollectResult` to the imports at the top.

**Step 4: Run test to verify it passes**

Run: `bun test test/agent/parsers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agent/parsers.ts test/agent/parsers.test.ts
git commit -m "feat: add tool collection and deduplication functions"
```

---

## Task 8: Dockerfile Module

**Files:**
- Create: `src/agent/dockerfile.ts`
- Test: `test/agent/dockerfile.test.ts`

**Step 1: Write failing test for Dockerfile generation**

Create `test/agent/dockerfile.test.ts`:

```typescript
import { expect, test, describe } from 'bun:test'
import { buildDockerfile, buildImageName, buildToolLabels } from '../src/agent/dockerfile'
import { toolSpecs } from '../src/agent/config'
import type { CollectResult, ToolDescriptor } from '../src/agent/types'

describe('buildImageName', () => {
  test('returns latest for empty specs', () => {
    const result = buildImageName([])
    expect(result).toBe('mheap/agent-en-place:latest')
  })

  test('builds name from tool specs', () => {
    const specs: ToolDescriptor[] = [
      { name: 'node', version: '20.11.0' },
      { name: 'python', version: '3.12.0' },
    ]
    const result = buildImageName(specs)
    expect(result).toBe('mheap/agent-en-place:node-20.11.0-python-3.12.0')
  })
})

describe('buildToolLabels', () => {
  test('generates labels for specs', () => {
    const specs: ToolDescriptor[] = [
      { name: 'node', version: '20.11.0' },
    ]
    const result = buildToolLabels(specs)
    expect(result).toContain('LABEL com.mheap.agent-en-place.node="20.11.0"')
  })
})

describe('buildDockerfile', () => {
  test('generates valid Dockerfile', () => {
    const collection: CollectResult = {
      specs: [{ name: 'node', version: '20.11.0' }],
      idiomaticPaths: [],
      idiomaticInfos: [{ tool: 'node', version: '20.11.0', path: '', configKey: 'node' }],
    }
    const result = buildDockerfile(false, false, true, collection, toolSpecs.codex)

    expect(result).toContain('FROM debian:12-slim')
    expect(result).toContain('mise')
    expect(result).toContain('USER agent')
    expect(result).toContain('WORKDIR /workdir')
    expect(result).toContain('ENTRYPOINT')
  })

  test('includes libatomic1 when needLibatomic is true', () => {
    const collection: CollectResult = {
      specs: [],
      idiomaticPaths: [],
      idiomaticInfos: [],
    }
    const result = buildDockerfile(false, false, true, collection, toolSpecs.codex)
    expect(result).toContain('libatomic1')
  })

  test('copies .tool-versions when present', () => {
    const collection: CollectResult = {
      specs: [],
      idiomaticPaths: [],
      idiomaticInfos: [],
    }
    const result = buildDockerfile(true, false, false, collection, toolSpecs.codex)
    expect(result).toContain('COPY .tool-versions')
  })

  test('copies mise.toml when present', () => {
    const collection: CollectResult = {
      specs: [],
      idiomaticPaths: [],
      idiomaticInfos: [],
    }
    const result = buildDockerfile(false, true, false, collection, toolSpecs.codex)
    expect(result).toContain('COPY mise.toml')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test test/agent/dockerfile.test.ts`
Expected: FAIL - cannot find module

**Step 3: Implement Dockerfile module**

Create `src/agent/dockerfile.ts`:

```typescript
import type { CollectResult, ToolDescriptor, ToolSpec, IdiomaticInfo } from './types'
import { imageRepository } from './config'

// Mirrors Go: func buildImageName(specs []toolDescriptor) string
export function buildImageName(specs: ToolDescriptor[]): string {
  if (specs.length === 0) {
    return `${imageRepository}:latest`
  }

  const parts: string[] = []
  for (const spec of specs) {
    const name = sanitizeForTag(spec.name) || 'tool'
    const version = sanitizeForTag(spec.version) || 'latest'
    parts.push(`${name}-${version}`)
  }

  if (parts.length === 0) {
    return `${imageRepository}:latest`
  }

  return `${imageRepository}:${parts.join('-')}`
}

function sanitizeForTag(value: string): string {
  let result = value.toLowerCase().trim()
  let output = ''
  let lastHyphen = false

  for (const char of result) {
    if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) {
      output += char
      lastHyphen = false
    } else if (char === '.') {
      output += '.'
      lastHyphen = false
    } else if (['+', '@', ':', '/', '_', '-'].includes(char)) {
      if (!lastHyphen) {
        output += '-'
        lastHyphen = true
      }
    }
  }

  return output.replace(/^-+|-+$/g, '')
}

// Mirrors Go: func buildToolLabels(specs []toolDescriptor) string
export function buildToolLabels(specs: ToolDescriptor[]): string {
  let result = ''

  for (const spec of specs) {
    const name = sanitizeForTag(spec.name)
    if (!name) {
      continue
    }
    const version = sanitizeForTag(spec.version) || 'latest'
    const key = `com.mheap.agent-en-place.${name}`
    result += `LABEL ${key}="${version}"\n`
  }

  return result
}

// Mirrors Go: func escapeDoubleQuote(value string) string
function escapeDoubleQuote(value: string): string {
  if (!value) {
    return ''
  }
  return value.replace(/"/g, '""')
}

// Mirrors Go: func escapeForPrintf(line string) string
function escapeForPrintf(line: string): string {
  if (!line) {
    return ''
  }
  return line.replace(/'/g, "'\"'\"'")
}

// Mirrors Go: func defaultMiseLines(collection collectResult, spec ToolSpec) []string
export function defaultMiseLines(collection: CollectResult, spec: ToolSpec): string[] {
  const lines: string[] = ['[tools]']
  const seen = new Set<string>()
  let hasTool = false

  for (const info of collection.idiomaticInfos) {
    const version = info.version?.trim()
    if (!version) {
      continue
    }

    const key = info.configKey || info.tool
    if (key === spec.configKey) {
      hasTool = true
    }

    if (seen.has(key)) {
      continue
    }
    seen.add(key)

    lines.push(`"${escapeDoubleQuote(key)}" = "${escapeDoubleQuote(version)}"`)
  }

  if (!hasTool) {
    lines.push(`"${escapeDoubleQuote(spec.configKey)}" = "latest"`)
  }

  return lines
}

// Mirrors Go: func buildDockerfile(hasTool, hasMise, needLibatomic bool, collection collectResult, spec ToolSpec) string
export function buildDockerfile(
  hasTool: boolean,
  hasMise: boolean,
  needLibatomic: boolean,
  collection: CollectResult,
  spec: ToolSpec
): string {
  const packages = ['curl', 'ca-certificates', 'git', 'gnupg', 'apt-transport-https']
  if (needLibatomic) {
    packages.push('libatomic1')
  }

  let dockerfile = ''

  dockerfile += 'FROM debian:12-slim\n\n'
  dockerfile += `RUN apt-get update && apt-get install -y --no-install-recommends ${packages.join(' ')}\n`
  dockerfile += 'RUN install -dm 755 /etc/apt/keyrings\n'
  dockerfile += 'RUN curl -fSs https://mise.jdx.dev/gpg-key.pub | tee /etc/apt/keyrings/mise-archive-keyring.pub >/dev/null\n'
  dockerfile += 'RUN arch=$(dpkg --print-architecture) && echo "deb [signed-by=/etc/apt/keyrings/mise-archive-keyring.pub arch=$arch] https://mise.jdx.dev/deb stable main" | tee /etc/apt/sources.list.d/mise.list\n'
  dockerfile += 'RUN apt-get update && apt-get install -y mise\n'
  dockerfile += 'RUN rm -rf /var/lib/apt/lists/*\n\n'
  dockerfile += 'RUN groupadd -r agent && useradd -m -r -u 1000 -g agent -s /bin/bash agent\n'
  dockerfile += 'ENV HOME=/home/agent\n'
  dockerfile += 'ENV PATH="/home/agent/.local/share/mise/shims:/home/agent/.local/bin:${PATH}"\n\n'
  dockerfile += 'RUN mkdir -p /home/agent/.config/mise\n'
  dockerfile += buildToolLabels(collection.specs)
  dockerfile += 'WORKDIR /home/agent\n'

  if (hasTool) {
    dockerfile += 'COPY .tool-versions .tool-versions\n'
  }

  if (hasMise) {
    dockerfile += 'COPY mise.toml /home/agent/.config/mise/config.toml\n'
  } else {
    dockerfile += "RUN printf '%s\\n' \\\n"
    const lines = defaultMiseLines(collection, spec)
    for (const line of lines) {
      if (line === '') {
        dockerfile += "  '' \\\n"
        continue
      }
      dockerfile += `  '${escapeForPrintf(line)}' \\\n`
    }
    dockerfile += '  > /home/agent/.config/mise/config.toml\n'
  }

  if (hasTool || hasMise) {
    dockerfile += 'RUN chown agent:agent'
    if (hasTool) {
      dockerfile += ' .tool-versions'
    }
    dockerfile += ' /home/agent/.config/mise/config.toml\n'
  }

  dockerfile += 'COPY assets/agent-entrypoint.sh /usr/local/bin/agent-entrypoint\n'
  dockerfile += 'RUN chmod +x /usr/local/bin/agent-entrypoint\n'

  dockerfile += 'USER agent\n'
  dockerfile += 'RUN mise trust\n'
  dockerfile += 'RUN mise install\n'
  dockerfile += 'RUN printf \'export PATH="/home/agent/.local/share/mise/shims:/home/agent/.local/bin:$PATH"\\n\' > /home/agent/.bashrc\n'
  dockerfile += "RUN printf 'source ~/.bashrc\\n' > /home/agent/.bash_profile\n"
  dockerfile += 'WORKDIR /workdir\n'
  dockerfile += 'ENTRYPOINT ["/bin/bash", "/usr/local/bin/agent-entrypoint"]\n'

  return dockerfile
}
```

**Step 4: Run test to verify it passes**

Run: `bun test test/agent/dockerfile.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agent/dockerfile.ts test/agent/dockerfile.test.ts
git commit -m "feat: add Dockerfile generation module"
```

---

## Task 9: Docker Module - Testcontainers Integration

**Files:**
- Create: `src/agent/docker.ts`
- Test: `test/agent/docker.test.ts`

**Step 1: Write failing test for image existence check**

Create `test/agent/docker.test.ts`:

```typescript
import { expect, test, describe, mock } from 'bun:test'
import { imageExists, buildDockerContext } from '../src/agent/docker'

describe('buildDockerContext', () => {
  test('creates tar with Dockerfile', async () => {
    const dockerfile = 'FROM debian:12-slim\n'
    const context = await buildDockerContext(dockerfile, null, null, [], new Uint8Array())

    expect(context).toBeInstanceOf(Buffer)
    // Tar files start with file headers
    expect(context.length).toBeGreaterThan(0)
  })
})

// Note: imageExists requires actual Docker daemon
// Integration tests would verify this works with real Docker
describe('imageExists', () => {
  test('function is exported', () => {
    expect(typeof imageExists).toBe('function')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test test/agent/docker.test.ts`
Expected: FAIL - cannot find module

**Step 3: Implement Docker module**

Create `src/agent/docker.ts`:

```typescript
import type { FileSpec } from './types'

// Import Testcontainers - we'll use the GenericContainer for building
// Note: Testcontainers is primarily for running containers in tests,
// but we can leverage its Docker client for image operations

// Mirrors Go: func imageExists(ctx context.Context, cli *client.Client, name string) bool
export async function imageExists(imageName: string): Promise<boolean> {
  try {
    // Use Bun's shell to check if image exists via docker CLI
    // This is more reliable than testcontainers for a "build-only" workflow
    const result = await Bun.$`docker image inspect ${imageName} 2>/dev/null`.quiet()
    return result.exitCode === 0
  } catch {
    return false
  }
}

// Build a tar archive for Docker build context
// Mirrors Go: func makeBuildContext(...)
export async function buildDockerContext(
  dockerfile: string,
  toolFile: FileSpec | null,
  miseFile: FileSpec | null,
  idiomaticPaths: string[],
  entrypointScript: Uint8Array
): Promise<Buffer> {
  // Simple tar implementation for Docker context
  const files: { name: string; data: Uint8Array; mode: number }[] = []

  // Add Dockerfile
  files.push({
    name: 'Dockerfile',
    data: new TextEncoder().encode(dockerfile),
    mode: 0o644,
  })

  // Add .tool-versions if present
  if (toolFile) {
    files.push({
      name: toolFile.path,
      data: toolFile.data,
      mode: toolFile.mode,
    })
  }

  // Add mise.toml if present
  if (miseFile) {
    files.push({
      name: miseFile.path,
      data: miseFile.data,
      mode: miseFile.mode,
    })
  }

  // Add idiomatic files
  for (const path of idiomaticPaths) {
    try {
      const file = Bun.file(path)
      if (await file.exists()) {
        const data = new Uint8Array(await file.arrayBuffer())
        files.push({ name: path, data, mode: 0o644 })
      }
    } catch {
      // Skip files that can't be read
    }
  }

  // Add entrypoint script
  files.push({
    name: 'assets/agent-entrypoint.sh',
    data: entrypointScript,
    mode: 0o755,
  })

  return createTarArchive(files)
}

// Simple tar archive creation (POSIX ustar format)
function createTarArchive(files: { name: string; data: Uint8Array; mode: number }[]): Buffer {
  const chunks: Uint8Array[] = []

  for (const file of files) {
    // Create header (512 bytes)
    const header = new Uint8Array(512)

    // Name (100 bytes)
    const nameBytes = new TextEncoder().encode(file.name)
    header.set(nameBytes.slice(0, 100), 0)

    // Mode (8 bytes, octal)
    const modeStr = file.mode.toString(8).padStart(7, '0') + '\0'
    header.set(new TextEncoder().encode(modeStr), 100)

    // UID (8 bytes)
    header.set(new TextEncoder().encode('0000000\0'), 108)

    // GID (8 bytes)
    header.set(new TextEncoder().encode('0000000\0'), 116)

    // Size (12 bytes, octal)
    const sizeStr = file.data.length.toString(8).padStart(11, '0') + '\0'
    header.set(new TextEncoder().encode(sizeStr), 124)

    // Mtime (12 bytes)
    const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0'
    header.set(new TextEncoder().encode(mtime), 136)

    // Checksum placeholder (8 spaces)
    header.set(new TextEncoder().encode('        '), 148)

    // Type flag ('0' for regular file)
    header[156] = 48 // '0'

    // Calculate and set checksum
    let checksum = 0
    for (let i = 0; i < 512; i++) {
      checksum += header[i]
    }
    const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 '
    header.set(new TextEncoder().encode(checksumStr), 148)

    chunks.push(header)

    // Add file data
    chunks.push(file.data)

    // Pad to 512-byte boundary
    const padding = 512 - (file.data.length % 512)
    if (padding < 512) {
      chunks.push(new Uint8Array(padding))
    }
  }

  // Add two empty blocks to end the archive
  chunks.push(new Uint8Array(1024))

  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return Buffer.from(result)
}

// Build Docker image using docker CLI (more reliable than testcontainers for build-only)
// Mirrors Go: cli.ImageBuild(...)
export async function buildImage(
  context: Buffer,
  imageName: string,
  debug: boolean
): Promise<void> {
  // Write context to temp file
  const tempDir = await Bun.$`mktemp -d`.text()
  const contextPath = `${tempDir.trim()}/context.tar`

  await Bun.write(contextPath, context)

  try {
    const buildCmd = Bun.$`docker build -t ${imageName} --rm --force-rm -f Dockerfile - < ${contextPath}`

    if (debug) {
      // Stream output
      for await (const chunk of buildCmd.stdout) {
        process.stdout.write(chunk)
      }
      await buildCmd
    } else {
      // Suppress output
      await buildCmd.quiet()
    }
  } finally {
    // Cleanup
    await Bun.$`rm -rf ${tempDir.trim()}`.quiet()
  }
}

// Alternative: Use testcontainers GenericContainer.fromDockerfile
// This is included for spec compliance but may be less suitable for build-only workflows
export async function buildImageWithTestcontainers(
  contextDir: string,
  imageName: string
): Promise<void> {
  // Testcontainers approach - requires writing files to disk first
  const { GenericContainer } = await import('testcontainers')

  // Build the image
  await GenericContainer.fromDockerfile(contextDir)
    .withBuildArgs({})
    .build(imageName)
}
```

**Step 4: Run test to verify it passes**

Run: `bun test test/agent/docker.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agent/docker.ts test/agent/docker.test.ts
git commit -m "feat: add Docker build context and image management"
```

---

## Task 10: Agent Module - Main Run Function

**Files:**
- Create: `src/agent/index.ts`
- Test: `test/agent/index.test.ts`

**Step 1: Write failing test for run function**

Create `test/agent/index.test.ts`:

```typescript
import { expect, test, describe } from 'bun:test'
import { run, generateDockerRunCommand } from '../src/agent'
import type { Config } from '../src/agent/types'
import { toolSpecs } from '../src/agent/config'

describe('generateDockerRunCommand', () => {
  test('generates valid docker run command', () => {
    const imageName = 'mheap/agent-en-place:test'
    const spec = toolSpecs.codex
    const cwd = '/test/workdir'
    const home = '/home/user'

    const result = generateDockerRunCommand(imageName, spec, cwd, home)

    expect(result).toContain('docker run --rm -it')
    expect(result).toContain(`-v ${cwd}:/workdir`)
    expect(result).toContain(`-v ${home}/.codex:/home/agent/.codex`)
    expect(result).toContain(imageName)
    expect(result).toContain(spec.command)
  })

  test('includes environment variables', () => {
    const imageName = 'mheap/agent-en-place:test'
    const spec = toolSpecs.copilot
    const cwd = '/test/workdir'
    const home = '/home/user'

    const result = generateDockerRunCommand(imageName, spec, cwd, home)

    expect(result).toContain('-e GH_TOKEN')
  })

  test('includes additional mounts', () => {
    const imageName = 'mheap/agent-en-place:test'
    const spec = toolSpecs.opencode
    const cwd = '/test/workdir'
    const home = '/home/user'

    const result = generateDockerRunCommand(imageName, spec, cwd, home)

    expect(result).toContain('.local/share/opencode')
  })
})

describe('run', () => {
  test('function is exported', () => {
    expect(typeof run).toBe('function')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test test/agent/index.test.ts`
Expected: FAIL - cannot find module

**Step 3: Implement agent module**

Create `src/agent/index.ts`:

```typescript
import { join } from 'node:path'
import { homedir } from 'node:os'

import type { Config, ToolSpec, CollectResult } from './types'
import { toolSpecs } from './config'
import { optionalFileSpec, collectToolSpecs, collectionHasNode } from './parsers'
import { buildDockerfile, buildImageName } from './dockerfile'
import { imageExists, buildDockerContext, buildImage } from './docker'

// Embedded entrypoint script (mirrors Go's //go:embed)
const agentEntrypointScript = new TextEncoder().encode(`#!/bin/bash
if [ $# -eq 0 ]; then
  exec /bin/bash --login -i
else
  exec /bin/bash --login -c "$*"
fi
`)

export { toolSpecs, type Config, type ToolSpec }

// Mirrors Go: func Run(cfg Config) error
export async function run(cfg: Config): Promise<void> {
  const spec = toolSpecs[cfg.tool]
  if (!spec) {
    throw new Error(`unknown tool: ${cfg.tool}`)
  }

  const toolFile = await optionalFileSpec('.tool-versions')
  const miseFile = await optionalFileSpec('mise.toml')

  const collection = await collectToolSpecs(toolFile, miseFile, spec)
  const hasNode = collectionHasNode(toolFile, miseFile, collection)

  if (cfg.dockerfileOnly) {
    const dockerfile = buildDockerfile(toolFile !== null, miseFile !== null, hasNode, collection, spec)
    console.log(dockerfile)
    return
  }

  const imageName = buildImageName(collection.specs)

  const needBuild = !(await imageExists(imageName)) || cfg.rebuild

  if (needBuild) {
    const dockerfile = buildDockerfile(toolFile !== null, miseFile !== null, hasNode, collection, spec)
    const context = await buildDockerContext(
      dockerfile,
      toolFile,
      miseFile,
      collection.idiomaticPaths,
      agentEntrypointScript
    )

    await buildImage(context, imageName, cfg.debug)
  }

  const cwd = process.cwd()
  const home = homedir()

  const command = generateDockerRunCommand(imageName, spec, cwd, home)
  console.log(command)
}

// Mirrors the docker run command generation in Go's Run function
export function generateDockerRunCommand(
  imageName: string,
  spec: ToolSpec,
  cwd: string,
  home: string
): string {
  const configMount = join(home, spec.configDir)
  const containerConfigPath = join('/home/agent', spec.configDir)

  const envs: string[] = []
  for (const env of spec.envVars ?? []) {
    envs.push(`-e ${env}`)
  }

  const volumes: string[] = [
    `-v ${normalizePath(cwd)}:/workdir`,
    `-v ${normalizePath(configMount)}:${containerConfigPath}`,
  ]

  for (const mount of spec.additionalMounts ?? []) {
    const hostPath = join(home, mount)
    const containerPath = join('/home/agent', mount)
    volumes.push(`-v ${normalizePath(hostPath)}:${containerPath}`)
  }

  const allArgs = [...envs, ...volumes]
  return `docker run --rm -it ${allArgs.join(' ')} ${imageName} ${spec.command}`
}

// Simple path normalization (removes trailing slashes, etc.)
function normalizePath(path: string): string {
  return path.replace(/\/+$/, '') || '/'
}
```

**Step 4: Run test to verify it passes**

Run: `bun test test/agent/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agent/index.ts test/agent/index.test.ts
git commit -m "feat: add main agent run function"
```

---

## Task 11: CLI Module

**Files:**
- Modify: `src/cli.ts`
- Test: `test/cli.test.ts`

**Step 1: Write failing test for CLI**

Create `test/cli.test.ts`:

```typescript
import { expect, test, describe } from 'bun:test'
import { parseArgs, version } from '../src/cli'

describe('parseArgs', () => {
  test('parses tool argument', () => {
    const result = parseArgs(['codex'])
    expect(result.tool).toBe('codex')
  })

  test('parses --debug flag', () => {
    const result = parseArgs(['--debug', 'codex'])
    expect(result.debug).toBe(true)
  })

  test('parses --rebuild flag', () => {
    const result = parseArgs(['--rebuild', 'codex'])
    expect(result.rebuild).toBe(true)
  })

  test('parses --dockerfile flag', () => {
    const result = parseArgs(['--dockerfile', 'codex'])
    expect(result.dockerfileOnly).toBe(true)
  })

  test('throws for invalid tool', () => {
    expect(() => parseArgs(['invalid'])).toThrow()
  })
})

describe('version', () => {
  test('is defined', () => {
    expect(version).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test test/cli.test.ts`
Expected: FAIL

**Step 3: Implement CLI module**

Rewrite `src/cli.ts`:

```typescript
#!/usr/bin/env bun

import { Command } from 'commander'
import { run, type Config } from './agent'
import { validTools, isValidTool } from './agent/types'

// Version info (mirrors Go's var version, commit, date)
export const version = '0.0.0'
export const commit = 'none'
export const date = 'unknown'

export interface ParsedArgs extends Config {}

export function parseArgs(args: string[]): ParsedArgs {
  let result: ParsedArgs = {
    debug: false,
    rebuild: false,
    dockerfileOnly: false,
    tool: '',
  }

  const program = new Command()
    .name('agent-run')
    .description('Create development environments in Docker for AI coding agents')
    .version(`${version} (commit: ${commit}, built: ${date})`)
    .argument('<tool>', `AI agent tool (${validTools.join(', ')})`)
    .option('--debug', 'show Docker build output instead of hiding it')
    .option('--rebuild', 'force rebuilding the Docker image')
    .option('--dockerfile', 'print the generated Dockerfile and exit')
    .action((tool, options) => {
      const normalizedTool = tool.toLowerCase()
      if (!isValidTool(normalizedTool)) {
        throw new Error(`invalid tool '${tool}'. Must be one of: ${validTools.join(', ')}`)
      }

      result = {
        debug: options.debug ?? false,
        rebuild: options.rebuild ?? false,
        dockerfileOnly: options.dockerfile ?? false,
        tool: normalizedTool,
      }
    })

  program.parse(['node', 'agent-run', ...args])

  return result
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2))
    await run(args)
  } catch (error) {
    if (error instanceof Error) {
      console.error(`error: ${error.message}`)
    } else {
      console.error('error: unknown error')
    }
    process.exit(1)
  }
}

// Only run main if this is the entry point
if (import.meta.main) {
  main()
}
```

**Step 4: Run test to verify it passes**

Run: `bun test test/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli.ts test/cli.test.ts
git commit -m "feat: add CLI with commander argument parsing"
```

---

## Task 12: Library Exports

**Files:**
- Modify: `src/index.ts`

**Step 1: Update library exports**

Rewrite `src/index.ts`:

```typescript
// Main exports
export { run, generateDockerRunCommand } from './agent'
export { toolSpecs, imageRepository } from './agent/config'
export type { Config, ToolSpec, ValidTool, FileSpec, ToolDescriptor, CollectResult, IdiomaticInfo } from './agent/types'
export { validTools, isValidTool } from './agent/types'

// Parser exports for advanced usage
export {
  optionalFileSpec,
  parseToolVersions,
  parseMiseToml,
  parseIdiomaticFiles,
  collectToolSpecs,
  idiomaticToolFiles,
} from './agent/parsers'

// Dockerfile generation exports
export { buildDockerfile, buildImageName, buildToolLabels } from './agent/dockerfile'

// Docker operations exports
export { imageExists, buildDockerContext, buildImage } from './agent/docker'
```

**Step 2: Run existing tests to verify nothing broke**

Run: `bun test`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: export all public API from index"
```

---

## Task 13: Update Tests for Library

**Files:**
- Modify: `test/index.test.ts`

**Step 1: Update library tests**

Rewrite `test/index.test.ts`:

```typescript
import { expect, test, describe } from 'bun:test'
import {
  run,
  toolSpecs,
  validTools,
  isValidTool,
  buildDockerfile,
  buildImageName,
  imageRepository,
} from '../src/index'

describe('library exports', () => {
  test('exports run function', () => {
    expect(typeof run).toBe('function')
  })

  test('exports toolSpecs', () => {
    expect(toolSpecs).toBeDefined()
    expect(toolSpecs.codex).toBeDefined()
    expect(toolSpecs.gemini).toBeDefined()
    expect(toolSpecs.copilot).toBeDefined()
    expect(toolSpecs.opencode).toBeDefined()
  })

  test('exports validTools', () => {
    expect(validTools).toContain('codex')
    expect(validTools).toContain('gemini')
    expect(validTools).toContain('copilot')
    expect(validTools).toContain('opencode')
  })

  test('exports isValidTool', () => {
    expect(isValidTool('codex')).toBe(true)
    expect(isValidTool('invalid')).toBe(false)
  })

  test('exports buildDockerfile', () => {
    expect(typeof buildDockerfile).toBe('function')
  })

  test('exports buildImageName', () => {
    expect(typeof buildImageName).toBe('function')
  })

  test('exports imageRepository', () => {
    expect(imageRepository).toBe('mheap/agent-en-place')
  })
})
```

**Step 2: Run tests**

Run: `bun test`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add test/index.test.ts
git commit -m "test: update library export tests"
```

---

## Task 14: Build and Verify

**Files:**
- None (verification only)

**Step 1: Run type check**

Run: `bun run check-types`
Expected: No type errors

**Step 2: Run linter**

Run: `bun run lint`
Expected: No lint errors (or fix with `bun run lint:fix`)

**Step 3: Run all tests**

Run: `bun test`
Expected: All tests PASS

**Step 4: Build the package**

Run: `bun run build`
Expected: Build succeeds, `dist/` updated

**Step 5: Test CLI locally**

Run: `bun src/cli.ts --help`
Expected: Shows help with usage info

Run: `bun src/cli.ts --dockerfile codex`
Expected: Prints generated Dockerfile

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: verify build and tests pass"
```

---

## Task 15: Documentation Update

**Files:**
- Modify: `README.md`

**Step 1: Update README with usage**

Add CLI usage section to README:

```markdown
## CLI Usage

```bash
# Install globally
bun install -g agent-run

# Or run directly
bunx agent-run <tool>

# Available tools: codex, opencode, copilot, gemini

# Options:
#   --debug       Show Docker build output
#   --rebuild     Force rebuild the Docker image
#   --dockerfile  Print Dockerfile and exit
#   --version     Show version
#   --help        Show help
```

## Library Usage

```typescript
import { run, toolSpecs, buildDockerfile } from 'agent-run'

// Run the agent
await run({
  tool: 'codex',
  debug: false,
  rebuild: false,
  dockerfileOnly: false,
})

// Or generate Dockerfile only
const dockerfile = buildDockerfile(false, false, true, collection, toolSpecs.codex)
```
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add CLI and library usage to README"
```

---

## Summary

This plan creates a TypeScript fork of `agent-en-place` with:

1. **Structural parity**: All Go functions/types mapped to idiomatic TypeScript equivalents
2. **Same file organization**: `src/agent/` mirrors `internal/agent/`
3. **Full test coverage**: Each module has corresponding tests
4. **Bun runtime**: Uses Bun APIs where beneficial (`Bun.file`, `Bun.$`)
5. **Docker integration**: Primary use of docker CLI with testcontainers as alternative
6. **Commander CLI**: Replaces Go's flag package with equivalent functionality

**Function Mapping Reference** (Go → TypeScript):
- `Run` → `run`
- `Config` → `Config` (interface)
- `ToolSpec` → `ToolSpec` (interface)
- `optionalFileSpec` → `optionalFileSpec`
- `parseToolVersions` → `parseToolVersions`
- `parseMiseToml` → `parseMiseToml`
- `buildDockerfile` → `buildDockerfile`
- `buildImageName` → `buildImageName`
- `collectToolSpecs` → `collectToolSpecs`
- `dedupeToolSpecs` → `dedupeToolSpecs`
- All other functions maintain same naming with camelCase