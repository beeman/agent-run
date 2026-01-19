import type { FileSpec, ToolDescriptor } from './types'

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
