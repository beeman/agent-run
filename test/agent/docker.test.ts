import { describe, expect, test } from 'bun:test'
import { buildDockerContext, imageExists } from '../../src/agent/docker.ts'

describe('buildDockerContext', () => {
  test('creates tar with Dockerfile', async () => {
    const dockerfile = 'FROM debian:12-slim\n'
    const context = await buildDockerContext(dockerfile, null, null, [], new Uint8Array())

    expect(context).toBeInstanceOf(Buffer)
    expect(context.length).toBeGreaterThan(0)
  })
})

describe('imageExists', () => {
  test('function is exported', () => {
    expect(typeof imageExists).toBe('function')
  })
})
