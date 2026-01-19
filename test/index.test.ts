import { expect, test } from 'bun:test'
import {
  buildDockerContext,
  // Dockerfile generation exports
  buildDockerfile,
  buildImage,
  buildImageName,
  buildToolLabels,
  collectToolSpecs,
  generateDockerRunCommand,
  idiomaticToolFiles,
  // Docker operations exports
  imageExists,
  imageRepository,
  isValidTool,
  // Parser exports
  optionalFileSpec,
  parseIdiomaticFiles,
  parseMiseToml,
  parseToolVersions,
  // Main exports
  run,
  toolSpecs,
  validTools,
} from '../src/index.ts'

test('main exports are available', () => {
  expect(typeof run).toBe('function')
  expect(typeof generateDockerRunCommand).toBe('function')
  expect(typeof toolSpecs).toBe('object')
  expect(typeof imageRepository).toBe('string')
  expect(Array.isArray(validTools)).toBe(true)
  expect(typeof isValidTool).toBe('function')
})

test('parser exports are available', () => {
  expect(typeof optionalFileSpec).toBe('function')
  expect(typeof parseToolVersions).toBe('function')
  expect(typeof parseMiseToml).toBe('function')
  expect(typeof parseIdiomaticFiles).toBe('function')
  expect(typeof collectToolSpecs).toBe('function')
  expect(typeof idiomaticToolFiles).toBe('object')
})

test('dockerfile generation exports are available', () => {
  expect(typeof buildDockerfile).toBe('function')
  expect(typeof buildImageName).toBe('function')
  expect(typeof buildToolLabels).toBe('function')
})

test('docker operations exports are available', () => {
  expect(typeof imageExists).toBe('function')
  expect(typeof buildDockerContext).toBe('function')
  expect(typeof buildImage).toBe('function')
})
