# Contributing to Templatical

Thank you for your interest in contributing to Templatical! This document provides guidelines and information for contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/sdk.git`
3. Install dependencies: `bun install`
4. Create a branch: `git checkout -b my-feature`

## Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- Node.js >= 20 (for compatibility)

### Commands

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run test         # Run all tests
bun run test:e2e     # Run all E2E tests
bun run lint         # Lint all packages
bun run format       # Format code
bun run typecheck    # Type check all packages
```

### Package Structure

- `packages/types` — Shared TypeScript types (MIT)
- `packages/renderer` — JSON to MJML renderer (MIT)
- `packages/core` — Framework-agnostic editor logic (FSL)
- `packages/editor` — Vue 3 based editor components (FSL)
- `packages/import-beefree` — BeeFree template converter (MIT)

## Pull Requests

1. Ensure all tests pass: `bun run test`
2. Ensure all E2E tests pass: `bun run test:e2e`
3. Ensure type checking passes: `bun run typecheck`
4. Ensure linting passes: `bun run lint`
5. Write tests for new functionality
6. Keep PRs focused and small when possible

## Code Style

- TypeScript strict mode
- ESLint + Prettier for formatting
- Meaningful variable and function names

## License

By contributing, you agree that your contributions will be licensed under the same license as the package you're contributing to (MIT for types/renderer/import-beefree, FSL for core/editor).
