import { describe, expect, test } from 'bun:test'
import { toolSpecs } from '../../src/agent/config.ts'
import { buildDockerfile, buildImageName, buildToolLabels } from '../../src/agent/dockerfile.ts'
import type { CollectResult, ToolDescriptor } from '../../src/agent/types.ts'

// Get codex spec once with type guard
const codexSpec = toolSpecs.codex
if (!codexSpec) throw new Error('codex spec not defined')

describe('buildImageName', () => {
  test('returns latest for empty specs', () => {
    const result = buildImageName([])
    expect(result).toBe('beeman/agent-run:latest')
  })

  test('builds name from tool specs', () => {
    const specs: ToolDescriptor[] = [
      { name: 'node', version: '20.11.0' },
      { name: 'python', version: '3.12.0' },
    ]
    const result = buildImageName(specs)
    expect(result).toBe('beeman/agent-run:node-20.11.0-python-3.12.0')
  })
})

describe('buildToolLabels', () => {
  test('generates labels for specs', () => {
    const specs: ToolDescriptor[] = [{ name: 'node', version: '20.11.0' }]
    const result = buildToolLabels(specs)
    expect(result).toContain('LABEL com.beeman.agent-run.node="20.11.0"')
  })
})

describe('buildDockerfile', () => {
  test('generates valid Dockerfile', () => {
    const collection: CollectResult = {
      idiomaticInfos: [{ configKey: 'node', path: '', tool: 'node', version: '20.11.0' }],
      idiomaticPaths: [],
      specs: [{ name: 'node', version: '20.11.0' }],
    }
    const result = buildDockerfile(false, false, true, collection, codexSpec)

    expect(result).toContain('FROM debian:12-slim')
    expect(result).toContain('mise')
    expect(result).toContain('USER agent')
    expect(result).toContain('WORKDIR /workdir')
    expect(result).toContain('ENTRYPOINT')
  })

  test('includes libatomic1 when needLibatomic is true', () => {
    const collection: CollectResult = {
      idiomaticInfos: [],
      idiomaticPaths: [],
      specs: [],
    }
    const result = buildDockerfile(false, false, true, collection, codexSpec)
    expect(result).toContain('libatomic1')
  })

  test('copies .tool-versions when present', () => {
    const collection: CollectResult = {
      idiomaticInfos: [],
      idiomaticPaths: [],
      specs: [],
    }
    const result = buildDockerfile(true, false, false, collection, codexSpec)
    expect(result).toContain('COPY .tool-versions')
  })

  test('copies mise.toml when present', () => {
    const collection: CollectResult = {
      idiomaticInfos: [],
      idiomaticPaths: [],
      specs: [],
    }
    const result = buildDockerfile(false, true, false, collection, codexSpec)
    expect(result).toContain('COPY mise.toml')
  })
})
