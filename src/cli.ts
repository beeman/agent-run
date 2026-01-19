#!/usr/bin/env bun

import { Command } from 'commander'
import { type Config, run } from './agent/index.ts'
import { isValidTool, validTools } from './agent/types.ts'

// Version info (mirrors Go's var version, commit, date)
export const version = '0.0.0'
export const commit = 'none'
export const date = 'unknown'

export interface ParsedArgs extends Config {}

export function parseArgs(args: string[]): ParsedArgs {
  let result: ParsedArgs = {
    debug: false,
    dockerfileOnly: false,
    rebuild: false,
    tool: '',
  }

  const program = new Command()
    .name('agent-run')
    .description('Create development environments in Docker for AI coding agents')
    .version(`${version} (commit: ${commit}, built: ${date})`)
    .argument('<tool>', `AI agent tool (${validTools.join(', ')})`)
    .option('--debug', 'show Docker build output instead of hiding it')
    .option('--rebuild', 'force rebuilding the Docker image')
    .option('--dockerfile', 'print the generated Dockerfile and exit')
    .action((tool, options) => {
      const normalizedTool = tool.toLowerCase()
      if (!isValidTool(normalizedTool)) {
        throw new Error(`invalid tool '${tool}'. Must be one of: ${validTools.join(', ')}`)
      }

      result = {
        debug: options.debug ?? false,
        dockerfileOnly: options.dockerfile ?? false,
        rebuild: options.rebuild ?? false,
        tool: normalizedTool,
      }
    })

  program.parse(['node', 'agent-run', ...args])

  return result
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2))
    await run(args)
  } catch (error) {
    if (error instanceof Error) {
      console.error(`error: ${error.message}`)
    } else {
      console.error('error: unknown error')
    }
    process.exit(1)
  }
}

// Only run main if this is the entry point
if (import.meta.main) {
  main()
}
