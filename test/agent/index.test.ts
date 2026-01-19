import { describe, expect, test } from 'bun:test'
import { toolSpecs } from '../../src/agent/config.ts'
import { generateDockerRunCommand, run } from '../../src/agent/index.ts'

// Get specs with type guards
const codexSpec = toolSpecs.codex
if (!codexSpec) throw new Error('codex spec not defined')

const copilotSpec = toolSpecs.copilot
if (!copilotSpec) throw new Error('copilot spec not defined')

const opencodeSpec = toolSpecs.opencode
if (!opencodeSpec) throw new Error('opencode spec not defined')

describe('generateDockerRunCommand', () => {
  test('generates valid docker run command', () => {
    const imageName = 'beeman/agent-run:test'
    const cwd = '/test/workdir'
    const home = '/home/user'

    const result = generateDockerRunCommand(imageName, codexSpec, cwd, home)

    expect(result).toContain('docker run --rm -it')
    expect(result).toContain(`-v ${cwd}:/workdir`)
    expect(result).toContain(`-v ${home}/.codex:/home/agent/.codex`)
    expect(result).toContain(imageName)
    expect(result).toContain(codexSpec.command)
  })

  test('includes environment variables', () => {
    const imageName = 'beeman/agent-run:test'
    const cwd = '/test/workdir'
    const home = '/home/user'

    const result = generateDockerRunCommand(imageName, copilotSpec, cwd, home)

    expect(result).toContain('-e GH_TOKEN')
  })

  test('includes additional mounts', () => {
    const imageName = 'beeman/agent-run:test'
    const cwd = '/test/workdir'
    const home = '/home/user'

    const result = generateDockerRunCommand(imageName, opencodeSpec, cwd, home)

    expect(result).toContain('.local/share/opencode')
  })
})

describe('run', () => {
  test('function is exported', () => {
    expect(typeof run).toBe('function')
  })
})
