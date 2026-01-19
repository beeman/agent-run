# agent-run

Run AI coding agents (Codex, OpenCode, Copilot, Gemini) in Docker containers with your project mounted.

## CLI Usage

```bash
# Install globally
bun install -g agent-run

# Or run directly
bunx agent-run <tool>

# Available tools: codex, opencode, copilot, gemini

# Options:
#   --debug       Show Docker build output
#   --rebuild     Force rebuild the Docker image
#   --dockerfile  Print Dockerfile and exit
#   --version     Show version
#   --help        Show help
```

## Library Usage

```typescript
import { run, toolSpecs } from 'agent-run'

// Run the agent (builds image and prints docker run command)
await run({
  tool: 'codex',
  debug: false,
  rebuild: false,
  dockerfileOnly: false,
})

// Print Dockerfile only (no image build)
await run({
  tool: 'gemini',
  debug: false,
  rebuild: false,
  dockerfileOnly: true,
})
```

For advanced usage (custom Dockerfile generation, parsing tool versions), see the exported functions: `collectToolSpecs`, `buildDockerfile`, `buildImageName`, `parseToolVersions`, `parseMiseToml`.

## Features

- **Docker-based isolation**: Run AI agents in isolated containers
- **Multiple AI tools**: Support for Codex, OpenCode, Copilot, and Gemini
- **Project mounting**: Automatically mounts your project directory
- **Configurable**: Debug mode, rebuild options, and Dockerfile generation

## Development

- **Build**: `bun run build`
- **Type Check**: `bun run check-types`
- **Lint**: `bun run lint`
- **Lint & Fix**: `bun run lint:fix`
- **Test**: `bun test`
- **Test (Watch Mode)**: `bun run test:watch`

## License

MIT – see [LICENSE](./LICENSE).
