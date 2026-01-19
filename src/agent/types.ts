// Mirrors Go: type Config struct
export interface Config {
  debug: boolean
  rebuild: boolean
  dockerfileOnly: boolean
  tool: string
}

// Mirrors Go: type ToolSpec struct
export interface ToolSpec {
  miseToolName: string
  configKey: string
  command: string
  configDir: string
  additionalMounts?: string[]
  envVars?: string[]
}

// Mirrors Go: type fileSpec struct
export interface FileSpec {
  path: string
  data: Uint8Array
  mode: number
}

// Mirrors Go: type toolDescriptor struct
export interface ToolDescriptor {
  name: string
  version: string
}

// Mirrors Go: type idiomaticInfo struct
export interface IdiomaticInfo {
  tool: string
  version: string
  path: string
  configKey: string
}

// Mirrors Go: type collectResult struct
export interface CollectResult {
  specs: ToolDescriptor[]
  idiomaticPaths: string[]
  idiomaticInfos: IdiomaticInfo[]
}

export const validTools = ['codex', 'opencode', 'copilot', 'gemini'] as const
export type ValidTool = (typeof validTools)[number]

export function isValidTool(tool: string): tool is ValidTool {
  return validTools.includes(tool as ValidTool)
}
