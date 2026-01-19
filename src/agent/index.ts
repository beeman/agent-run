import { homedir } from 'node:os'
import { join } from 'node:path'
import { toolSpecs } from './config.ts'
import { buildDockerContext, buildImage, imageExists } from './docker.ts'
import { buildDockerfile, buildImageName } from './dockerfile.ts'
import { collectionHasNode, collectToolSpecs, optionalFileSpec } from './parsers.ts'
import type { Config, ToolSpec } from './types.ts'

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
      agentEntrypointScript,
    )

    await buildImage(context, imageName, cfg.debug)
  }

  const cwd = process.cwd()
  const home = homedir()

  const command = generateDockerRunCommand(imageName, spec, cwd, home)
  console.log(command)
}

// Generate docker run command
export function generateDockerRunCommand(imageName: string, spec: ToolSpec, cwd: string, home: string): string {
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

function normalizePath(path: string): string {
  return path.replace(/\/+$/, '') || '/'
}
