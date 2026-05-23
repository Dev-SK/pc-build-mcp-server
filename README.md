# pc-build-mcp-server

NestJS-based MCP (Model Context Protocol) server that exposes PC component search, browse, product detail, comparison, and compatibility tools for **https://mdcomputers.in**.

## What this server does

The server runs as an MCP stdio process (no HTTP API) and provides these tools:

- `health_check`
- `search_components`
- `browse_category`
- `get_product_details`
- `compare_products`
- `check_build_compatibility`

Scraping is implemented with axios + cheerio, with in-memory TTL caching and constrained request concurrency.

## Architecture

Main flow:

- `src/main.ts` starts a Nest application context and starts MCP stdio transport.
- `src/mcp/mcp-server.service.ts` registers MCP tools and zod schemas.
- `src/tools/tools.service.ts` orchestrates tool logic.
- `src/scraper/scraper.service.ts` performs HTML fetches with URL allowlist + limiter + jitter.
- `src/scraper/url-builder.ts` builds search/category/detail URLs.
- `src/scraper/parsers.ts` parses listing/detail pages and totals.
- `src/utils/cache.service.ts` provides in-memory TTL cache.
- `src/utils/compatibility.ts` provides deterministic compatibility checks.

## Scraper constraints

- Only `https://mdcomputers.in/*` URLs are accepted.
- Max outbound concurrency is 2.
- Each request includes ~1–2s jitter.
- Browser-like headers are set for outbound requests.

## Compatibility checks implemented

- CPU socket ↔ motherboard socket
- RAM DDR generation ↔ motherboard DDR support
- PSU wattage headroom (`CPU TDP + GPU TDP + 100W`)
- Cabinet form factor support for motherboard form factor

## Local development

### Install

```bash
npm ci
```

### Run in dev/watch mode

```bash
npm run start:dev
```

### Build

```bash
npm run build
```

### Start production build

```bash
npm run start:prod
```

## Validation commands

```bash
npm run lint
npm run build
npm test -- --forceExit
npm run test:e2e
```

## Claude Desktop MCP wiring

After building, configure Claude Desktop to launch the compiled entrypoint:

```json
{
  "mcpServers": {
    "pc-build-mcp-server": {
      "command": "node",
      "args": [
        "/absolute/path/to/pc-build-mcp-server/dist/main.js"
      ]
    }
  }
}
```

Notes:

- Use an absolute path to `dist/main.js`.
- Rebuild (`npm run build`) after code changes.
- Restart Claude Desktop after config changes.

## Project structure

```text
src/
  app.module.ts
  main.ts
  mcp/
    mcp-server.service.ts
  scraper/
    scraper.service.ts
    url-builder.ts
    parsers.ts
  tools/
    tools.service.ts
  utils/
    cache.service.ts
    compatibility.ts
    limiter.ts
    normalize.ts
test/
  app.e2e-spec.ts
```
