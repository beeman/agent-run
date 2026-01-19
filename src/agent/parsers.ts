import type { FileSpec, ToolDescriptor, IdiomaticInfo, ToolSpec, CollectResult } from './types'

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

  let insideToolArray = false
  let insideToolsSection = false
  let current: Partial<ToolDescriptor> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }

    // Handle [[tool]] array sections (not [tools])
    if (trimmed.startsWith('[[tool]]') || trimmed === '[[tool]]') {
      insideToolArray = true
      insideToolsSection = false
      current = {}
      continue
    }

    // Handle [tools] section
    if (trimmed === '[tools]') {
      insideToolsSection = true
      insideToolArray = false
      continue
    }

    // Exit current section on new section
    if (trimmed.startsWith('[')) {
      insideToolArray = false
      insideToolsSection = false
      continue
    }

    // Parse [tools] section (simple key = value format)
    if (insideToolsSection && trimmed.includes('=')) {
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
    if (insideToolArray && trimmed.includes('=')) {
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

// Mirrors Go: func optionalFileSpec(path string) (*fileSpec, error)
export async function optionalFileSpec(path: string): Promise<FileSpec | null> {
  const file = Bun.file(path)
  const exists = await file.exists()
  if (!exists) {
    return null
  }

  const data = new Uint8Array(await file.arrayBuffer())
  // Mask to permission bits only
  const stat = await file.stat()

  return {
    path,
    data,
    mode: stat.mode & 0o777,
  }
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
// Note: tool parameter is accepted but not used (matches Go signature for future extensibility)
export async function readIdiomaticVersion(_tool: string, path: string): Promise<string | null> {
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

      const configKey = tool
      infos.push({ tool, version, path, configKey })
      break // Only use first matching file per tool
    }
  }

  return infos
}

// Mirrors Go: func sanitizeTagComponent(value string) string
export function sanitizeTagComponent(value: string): string {
  let result = value.toLowerCase().trim()
  let output = ''
  let lastWasHyphen = false
  let lastWasAt = false

  for (const char of result) {
    if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) {
      output += char
      lastWasHyphen = false
      lastWasAt = false
    } else if (char === '.') {
      output += '.'
      lastWasHyphen = false
      lastWasAt = false
    } else if (char === '@') {
      // @ always produces a hyphen, even after :
      if (!lastWasAt) {
        output += '-'
        lastWasAt = true
        lastWasHyphen = true
      }
    } else if (['+', ':', '/', '_', '-'].includes(char)) {
      if (!lastWasHyphen || lastWasAt) {
        output += '-'
        lastWasHyphen = true
        lastWasAt = false
      }
    }
  }

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
    result.push({ name: spec.name, version })
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
