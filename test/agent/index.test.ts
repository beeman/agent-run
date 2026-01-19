import { expect, test, describe } from 'bun:test'
import { run, generateDockerRunCommand } from '../../src/agent'
import type { Config } from '../../src/agent/types'
import { toolSpecs } from '../../src/agent/config'

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
