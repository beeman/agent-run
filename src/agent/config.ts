import type { ToolSpec } from './types.ts'

export type { ToolSpec }

// Mirrors Go: var toolSpecs = map[string]ToolSpec
export const toolSpecs: Record<string, ToolSpec> = {
  codex: {
    command: 'codex --dangerously-bypass-approvals-and-sandbox',
    configDir: '.codex',
    configKey: 'npm:@openai/codex',
    miseToolName: 'npm:@openai/codex',
  },
  copilot: {
    command: 'copilot --allow-all-tools --allow-all-paths --allow-all-urls',
    configDir: '.copilot',
    configKey: 'npm:@github/copilot',
    envVars: ['GH_TOKEN="$(gh auth token -h github.com)"'],
    miseToolName: 'npm:@github/copilot',
  },
  gemini: {
    command: 'gemini --yolo',
    configDir: '.gemini',
    configKey: 'npm:@google/gemini-cli',
    miseToolName: 'npm:@google/gemini-cli',
  },
  opencode: {
    additionalMounts: ['.local/share/opencode'],
    command: 'opencode',
    configDir: '.config/opencode/',
    configKey: 'npm:opencode-ai',
    miseToolName: 'npm:opencode-ai',
  },
}

// Mirrors Go: const imageRepository
export const imageRepository = 'beeman/agent-run'
