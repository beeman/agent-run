import type { ToolSpec } from './types'

export type { ToolSpec }

// Mirrors Go: var toolSpecs = map[string]ToolSpec
export const toolSpecs: Record<string, ToolSpec> = {
  codex: {
    miseToolName: 'npm:@openai/codex',
    configKey: 'npm:@openai/codex',
    command: 'codex --dangerously-bypass-approvals-and-sandbox',
    configDir: '.codex',
  },
  opencode: {
    miseToolName: 'npm:opencode-ai',
    configKey: 'npm:opencode-ai',
    command: 'opencode',
    configDir: '.config/opencode/',
    additionalMounts: ['.local/share/opencode'],
  },
  copilot: {
    miseToolName: 'npm:@github/copilot',
    configKey: 'npm:@github/copilot',
    command: 'copilot --allow-all-tools --allow-all-paths --allow-all-urls',
    configDir: '.copilot',
    envVars: ['GH_TOKEN="$(gh auth token -h github.com)"'],
  },
  gemini: {
    miseToolName: 'npm:@google/gemini-cli',
    configKey: 'npm:@google/gemini-cli',
    command: 'gemini --yolo',
    configDir: '.gemini',
  },
}

// Mirrors Go: const imageRepository
export const imageRepository = 'mheap/agent-en-place'
