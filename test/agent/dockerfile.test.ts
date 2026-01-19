import { expect, test, describe } from 'bun:test'
import { buildDockerfile, buildImageName, buildToolLabels } from '../../src/agent/dockerfile'
import { toolSpecs } from '../../src/agent/config'
import type { CollectResult, ToolDescriptor } from '../../src/agent/types'

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
