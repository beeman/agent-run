import { describe, expect, test } from 'bun:test'
import { parseArgs, version } from '../src/cli.ts'

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
