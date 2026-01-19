import type { CollectResult, ToolDescriptor, ToolSpec, IdiomaticInfo } from './types'
import { imageRepository } from './config'

// Sanitize for Docker tag (mirrors Go sanitizeTagComponent)
function sanitizeForTag(value: string): string {
  let result = value.toLowerCase().trim()
  let output = ''
  let lastHyphen = false

  for (const char of result) {
    if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) {
      output += char
      lastHyphen = false
    } else if (char === '.') {
      output += '.'
      lastHyphen = false
    } else if (['+', '@', ':', '/', '_', '-'].includes(char)) {
      if (!lastHyphen) {
        output += '-'
        lastHyphen = true
      }
    }
  }

  return output.replace(/^-+|-+$/g, '')
}

// Mirrors Go: func buildImageName(specs []toolDescriptor) string
export function buildImageName(specs: ToolDescriptor[]): string {
  if (specs.length === 0) {
    return `${imageRepository}:latest`
  }

  const parts: string[] = []
  for (const spec of specs) {
    const name = sanitizeForTag(spec.name) || 'tool'
    const version = sanitizeForTag(spec.version) || 'latest'
    parts.push(`${name}-${version}`)
  }

  if (parts.length === 0) {
    return `${imageRepository}:latest`
  }

  return `${imageRepository}:${parts.join('-')}`
}

// Mirrors Go: func buildToolLabels(specs []toolDescriptor) string
export function buildToolLabels(specs: ToolDescriptor[]): string {
  let result = ''

  for (const spec of specs) {
    const name = sanitizeForTag(spec.name)
    if (!name) {
      continue
    }
    const version = sanitizeForTag(spec.version) || 'latest'
    const key = `com.mheap.agent-en-place.${name}`
    result += `LABEL ${key}="${version}"\n`
  }

  return result
}

// Mirrors Go: func escapeDoubleQuote(value string) string
function escapeDoubleQuote(value: string): string {
  if (!value) {
    return ''
  }
  return value.replace(/"/g, '""')
}

// Mirrors Go: func escapeForPrintf(line string) string
function escapeForPrintf(line: string): string {
  if (!line) {
    return ''
  }
  return line.replace(/'/g, "'\"'\"'")
}

// Mirrors Go: func defaultMiseLines(collection collectResult, spec ToolSpec) []string
export function defaultMiseLines(collection: CollectResult, spec: ToolSpec): string[] {
  const lines: string[] = ['[tools]']
  const seen = new Set<string>()
  let hasTool = false

  for (const info of collection.idiomaticInfos) {
    const version = info.version?.trim()
    if (!version) {
      continue
    }

    const key = info.configKey || info.tool
    if (key === spec.configKey) {
      hasTool = true
    }

    if (seen.has(key)) {
      continue
    }
    seen.add(key)

    lines.push(`"${escapeDoubleQuote(key)}" = "${escapeDoubleQuote(version)}"`)
  }

  if (!hasTool) {
    lines.push(`"${escapeDoubleQuote(spec.configKey)}" = "latest"`)
  }

  return lines
}

// Mirrors Go: func buildDockerfile(hasTool, hasMise, needLibatomic bool, collection collectResult, spec ToolSpec) string
export function buildDockerfile(
  hasTool: boolean,
  hasMise: boolean,
  needLibatomic: boolean,
  collection: CollectResult,
  spec: ToolSpec
): string {
  const packages = ['curl', 'ca-certificates', 'git', 'gnupg', 'apt-transport-https']
  if (needLibatomic) {
    packages.push('libatomic1')
  }

  let dockerfile = ''

  dockerfile += 'FROM debian:12-slim\n\n'
  dockerfile += `RUN apt-get update && apt-get install -y --no-install-recommends ${packages.join(' ')}\n`
  dockerfile += 'RUN install -dm 755 /etc/apt/keyrings\n'
  dockerfile += 'RUN curl -fSs https://mise.jdx.dev/gpg-key.pub | tee /etc/apt/keyrings/mise-archive-keyring.pub >/dev/null\n'
  dockerfile += 'RUN arch=$(dpkg --print-architecture) && echo "deb [signed-by=/etc/apt/keyrings/mise-archive-keyring.pub arch=$arch] https://mise.jdx.dev/deb stable main" | tee /etc/apt/sources.list.d/mise.list\n'
  dockerfile += 'RUN apt-get update && apt-get install -y mise\n'
  dockerfile += 'RUN rm -rf /var/lib/apt/lists/*\n\n'
  dockerfile += 'RUN groupadd -r agent && useradd -m -r -u 1000 -g agent -s /bin/bash agent\n'
  dockerfile += 'ENV HOME=/home/agent\n'
  dockerfile += 'ENV PATH="/home/agent/.local/share/mise/shims:/home/agent/.local/bin:${PATH}"\n\n'
  dockerfile += 'RUN mkdir -p /home/agent/.config/mise\n'
  dockerfile += buildToolLabels(collection.specs)
  dockerfile += 'WORKDIR /home/agent\n'

  if (hasTool) {
    dockerfile += 'COPY .tool-versions .tool-versions\n'
  }

  if (hasMise) {
    dockerfile += 'COPY mise.toml /home/agent/.config/mise/config.toml\n'
  } else {
    dockerfile += "RUN printf '%s\\n' \\\n"
    const lines = defaultMiseLines(collection, spec)
    for (const line of lines) {
      if (line === '') {
        dockerfile += "  '' \\\n"
        continue
      }
      dockerfile += `  '${escapeForPrintf(line)}' \\\n`
    }
    dockerfile += '  > /home/agent/.config/mise/config.toml\n'
  }

  if (hasTool || hasMise) {
    dockerfile += 'RUN chown agent:agent'
    if (hasTool) {
      dockerfile += ' .tool-versions'
    }
    dockerfile += ' /home/agent/.config/mise/config.toml\n'
  }

  dockerfile += 'COPY assets/agent-entrypoint.sh /usr/local/bin/agent-entrypoint\n'
  dockerfile += 'RUN chmod +x /usr/local/bin/agent-entrypoint\n'

  dockerfile += 'USER agent\n'
  dockerfile += 'RUN mise trust\n'
  dockerfile += 'RUN mise install\n'
  dockerfile += 'RUN printf \'export PATH="/home/agent/.local/share/mise/shims:/home/agent/.local/bin:$PATH"\\n\' > /home/agent/.bashrc\n'
  dockerfile += "RUN printf 'source ~/.bashrc\\n' > /home/agent/.bash_profile\n"
  dockerfile += 'WORKDIR /workdir\n'
  dockerfile += 'ENTRYPOINT ["/bin/bash", "/usr/local/bin/agent-entrypoint"]\n'

  return dockerfile
}
