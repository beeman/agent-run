import { describe, expect, test } from 'bun:test'
import { toolSpecs } from '../../src/agent/config.ts'

describe('toolSpecs', () => {
  test('contains codex configuration', () => {
    const codex = toolSpecs.codex
    expect(codex).toBeDefined()
    if (!codex) throw new Error('codex not defined')
    expect(codex.miseToolName).toBe('npm:@openai/codex')
    expect(codex.command).toContain('codex')
    expect(codex.configDir).toBe('.codex')
  })

  test('contains gemini configuration', () => {
    const gemini = toolSpecs.gemini
    expect(gemini).toBeDefined()
    if (!gemini) throw new Error('gemini not defined')
    expect(gemini.miseToolName).toBe('npm:@google/gemini-cli')
    expect(gemini.command).toContain('gemini')
    expect(gemini.configDir).toBe('.gemini')
  })

  test('contains copilot configuration', () => {
    const copilot = toolSpecs.copilot
    expect(copilot).toBeDefined()
    if (!copilot) throw new Error('copilot not defined')
    expect(copilot.envVars).toContain('GH_TOKEN="$(gh auth token -h github.com)"')
  })

  test('contains opencode configuration', () => {
    const opencode = toolSpecs.opencode
    expect(opencode).toBeDefined()
    if (!opencode) throw new Error('opencode not defined')
    expect(opencode.additionalMounts).toContain('.local/share/opencode')
  })
})
