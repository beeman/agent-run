import type { FileSpec } from './types.ts'

// Mirrors Go: func imageExists(ctx context.Context, cli *client.Client, name string) bool
export async function imageExists(imageName: string): Promise<boolean> {
  try {
    const result = await Bun.$`docker image inspect ${imageName} 2>/dev/null`.quiet()
    return result.exitCode === 0
  } catch {
    return false
  }
}

// Build a tar archive for Docker build context
export async function buildDockerContext(
  dockerfile: string,
  toolFile: FileSpec | null,
  miseFile: FileSpec | null,
  idiomaticPaths: string[],
  entrypointScript: Uint8Array,
): Promise<Buffer> {
  const files: { name: string; data: Uint8Array; mode: number }[] = []

  // Add Dockerfile
  files.push({
    data: new TextEncoder().encode(dockerfile),
    mode: 0o644,
    name: 'Dockerfile',
  })

  // Add .tool-versions if present
  if (toolFile) {
    files.push({
      data: toolFile.data,
      mode: toolFile.mode,
      name: toolFile.path,
    })
  }

  // Add mise.toml if present
  if (miseFile) {
    files.push({
      data: miseFile.data,
      mode: miseFile.mode,
      name: miseFile.path,
    })
  }

  // Add idiomatic files
  for (const path of idiomaticPaths) {
    try {
      const file = Bun.file(path)
      if (await file.exists()) {
        const data = new Uint8Array(await file.arrayBuffer())
        const basename = path.split('/').pop() || path
        files.push({ data, mode: 0o644, name: basename })
      }
    } catch {
      // Skip files that can't be read
    }
  }

  // Add entrypoint script
  files.push({
    data: entrypointScript,
    mode: 0o755,
    name: 'assets/agent-entrypoint.sh',
  })

  return createTarArchive(files)
}

// Simple tar archive creation (POSIX ustar format)
function createTarArchive(files: { name: string; data: Uint8Array; mode: number }[]): Buffer {
  const chunks: Uint8Array[] = []

  for (const file of files) {
    // Create header (512 bytes)
    const header = new Uint8Array(512)

    // Name (100 bytes)
    const nameBytes = new TextEncoder().encode(file.name)
    header.set(nameBytes.slice(0, 100), 0)

    // Mode (8 bytes, octal)
    const modeStr = `${file.mode.toString(8).padStart(7, '0')}\0`
    header.set(new TextEncoder().encode(modeStr), 100)

    // UID (8 bytes)
    header.set(new TextEncoder().encode('0000000\0'), 108)

    // GID (8 bytes)
    header.set(new TextEncoder().encode('0000000\0'), 116)

    // Size (12 bytes, octal)
    const sizeStr = `${file.data.length.toString(8).padStart(11, '0')}\0`
    header.set(new TextEncoder().encode(sizeStr), 124)

    // Mtime (12 bytes)
    const mtime = `${Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, '0')}\0`
    header.set(new TextEncoder().encode(mtime), 136)

    // Checksum placeholder (8 spaces)
    header.set(new TextEncoder().encode('        '), 148)

    // Type flag ('0' for regular file)
    header[156] = 48 // '0'

    // Calculate and set checksum
    let checksum = 0
    for (let i = 0; i < 512; i++) {
      checksum += header[i] ?? 0
    }
    const checksumStr = `${checksum.toString(8).padStart(6, '0')}\0 `
    header.set(new TextEncoder().encode(checksumStr), 148)

    chunks.push(header)
    chunks.push(file.data)

    // Pad to 512-byte boundary
    const padding = 512 - (file.data.length % 512)
    if (padding < 512) {
      chunks.push(new Uint8Array(padding))
    }
  }

  // Add two empty blocks to end the archive
  chunks.push(new Uint8Array(1024))

  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return Buffer.from(result)
}

// Build Docker image using docker CLI
export async function buildImage(context: Buffer, imageName: string, debug: boolean): Promise<void> {
  const tempDir = (await Bun.$`mktemp -d`.text()).trim()
  const contextPath = `${tempDir}/context.tar`

  await Bun.write(contextPath, context)

  try {
    if (debug) {
      await Bun.$`docker build -t ${imageName} --rm --force-rm -f Dockerfile - < ${contextPath}`
    } else {
      await Bun.$`docker build -t ${imageName} --rm --force-rm -f Dockerfile - < ${contextPath}`.quiet()
    }
  } finally {
    await Bun.$`rm -rf ${tempDir}`.quiet()
  }
}
