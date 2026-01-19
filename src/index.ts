// Main exports
export { run, generateDockerRunCommand } from './agent'
export { toolSpecs, imageRepository } from './agent/config'
export type { Config, ToolSpec, ValidTool, FileSpec, ToolDescriptor, CollectResult, IdiomaticInfo } from './agent/types'
export { validTools, isValidTool } from './agent/types'

// Parser exports for advanced usage
export {
  optionalFileSpec,
  parseToolVersions,
  parseMiseToml,
  parseIdiomaticFiles,
  collectToolSpecs,
  idiomaticToolFiles,
} from './agent/parsers'

// Dockerfile generation exports
export { buildDockerfile, buildImageName, buildToolLabels } from './agent/dockerfile'

// Docker operations exports
export { imageExists, buildDockerContext, buildImage } from './agent/docker'
