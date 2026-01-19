import { expect, test, describe } from 'bun:test'
import { toolSpecs, type ToolSpec } from '../../src/agent/config'

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
