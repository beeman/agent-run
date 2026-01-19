// Main exports

export { imageRepository, toolSpecs } from './agent/config.ts'
// Docker operations exports
export { buildDockerContext, buildImage, imageExists } from './agent/docker.ts'
// Dockerfile generation exports
export { buildDockerfile, buildImageName, buildToolLabels } from './agent/dockerfile.ts'
export { generateDockerRunCommand, run } from './agent/index.ts'

// Parser exports for advanced usage
export {
  collectToolSpecs,
  idiomaticToolFiles,
  optionalFileSpec,
  parseIdiomaticFiles,
  parseMiseToml,
  parseToolVersions,
} from './agent/parsers.ts'
export type {
  CollectResult,
  Config,
  FileSpec,
  IdiomaticInfo,
  ToolDescriptor,
  ToolSpec,
  ValidTool,
} from './agent/types.ts'
export { isValidTool, validTools } from './agent/types.ts'
