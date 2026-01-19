import type { FileSpec } from './types'

// Mirrors Go: func optionalFileSpec(path string) (*fileSpec, error)
export async function optionalFileSpec(path: string): Promise<FileSpec | null> {
  const file = Bun.file(path)
  const exists = await file.exists()
  if (!exists) {
    return null
  }

  const data = new Uint8Array(await file.arrayBuffer())
  // Mask to permission bits only
  const stat = await file.stat()

  return {
    path,
    data,
    mode: stat.mode & 0o777,
  }
}
