# MDComputers MCP Server — Development Plan

## Overview

An MCP (Model Context Protocol) server that lets any AI agent (Claude, etc.) scrape,
search, and reason over PC component data from **mdcomputers.in** — India's Kolkata-based
PC hardware retailer — and surface structured results on demand.

---

## 1. Site Structure & Scrapeable Data

### 1.1 URL Patterns (confirmed from live search)

| Category | URL pattern | Example |
|---|---|---|
| Processors | `/processor` | `/processor` |
| Graphics Cards | `/graphics-card` | `/graphics-card` |
| Motherboards | `/motherboard` | `/motherboard` |
| RAM | `/ram` | `/ram` |
| SSD / Storage | `/ssd` or `/storage` | `/ssd` |
| Power Supply | `/power-supply-unit` | `/power-supply-unit` |
| Cabinets/Cases | `/cabinet` | `/cabinet` |
| CPU Coolers | `/cpu-cooler` | `/cpu-cooler` |
| Monitors | `/monitor` | `/monitor` |
| Pre-built PCs | `/build_your_pc/view_custom_pc/{slug}` | `/build_your_pc/view_custom_pc/gaming-pre-build-pc-i` |
| Product detail | `/{product-slug}.html` OR `/product/{slug}` | `/inception-xx-mid-range-prebuild-pc.html` |

**Pagination**: Category pages use standard page query params — likely `?p=2` or `?page=2`.
Confirm during development by inspecting the live DOM.

**Filters / sorting**: The site likely supports URL params for brand, price range, and sort
order. Capture these during development by interacting with the filter UI and reading the
resulting URL change.

---

### 1.2 Data Points Per Product (what to extract)

**Listing page (per card):**
- Product name
- Price (₹)
- Stock status (`In Stock` / `Out of Stock`)
- Brand
- Thumbnail image URL
- Product page URL

**Detail page (full spec):**
- All of the above, plus:
- Full specifications table (key → value pairs, varies by category — see §1.3)
- Short description / highlights
- User ratings / review count (if present)
- Warranty information
- "People also bought" / related products list (for future recommendation use)

---

### 1.3 Category-Specific Fields to Extract

| Category | Key spec fields |
|---|---|
| **Processor** | Socket, Cores, Threads, Base clock, Boost clock, TDP, Cache, Integrated graphics |
| **Graphics Card** | GPU chip, VRAM (GB), Memory type (GDDR6/X), TDP, Connectors, Form factor length |
| **Motherboard** | Socket, Chipset, Form factor, DDR version, M.2 slots, PCIe slots, Wi-Fi |
| **RAM** | Capacity, Speed (MHz), DDR type, Latency (CL), Form factor (DIMM/SO-DIMM), Kit |
| **SSD** | Capacity, Interface (NVMe/SATA), Form factor (M.2/2.5"), Read/Write speed, TBW |
| **PSU** | Wattage, Efficiency rating (80+ Gold/Bronze), Modularity, Connectors |
| **Cabinet** | Form factor support (ATX/mATX), Fans included, GPU clearance, Radiator support |
| **CPU Cooler** | Type (air/AIO), Radiator size, TDP support, Socket compatibility, Fan RPM |

---

## 2. MCP Server Architecture

```
mdcomputers-mcp/
├── src/
│   ├── index.js          ← MCP server entry point (registers tools & starts stdio transport)
│   ├── scraper.js        ← All HTTP + Cheerio scraping logic
│   ├── tools/
│   │   ├── search.js         ← search_components tool
│   │   ├── browse.js         ← browse_category tool
│   │   ├── product.js        ← get_product_details tool
│   │   ├── compare.js        ← compare_products tool
│   │   └── build.js          ← check_build_compatibility tool
│   └── utils/
│       ├── cache.js          ← In-memory TTL cache (avoid hammering the site)
│       └── normalize.js      ← Clean price strings, spec names, stock text
├── package.json
└── README.md
```

### Runtime stack

| Concern | Choice | Reason |
|---|---|---|
| Language | Node.js (ESM) | MCP SDK is JS-native; async/await fits scraping |
| MCP SDK | `@modelcontextprotocol/sdk` | Official SDK, stdio transport |
| HTTP client | `axios` | Interceptors for retry + User-Agent spoofing |
| HTML parser | `cheerio` | jQuery-like API for DOM traversal |
| Cache | In-memory Map with TTL | Avoid repeated hits; no external dependency |
| Rate limiting | `p-limit` (concurrency) + 1–2 s delay | Be polite to the site |

---

## 3. MCP Tools (Agent-Facing API)

### Tool 1 — `search_components`

**Purpose**: Keyword search across the entire site (or a specific category).

**Input schema:**
```json
{
  "query": "RTX 5060 Ti",
  "category": "graphics-card",   // optional — narrows search
  "max_results": 10              // default 10, max 30
}
```

**Output (array of products):**
```json
[
  {
    "name": "ASUS Dual GeForce RTX 5060 Ti OC 16GB",
    "price": 45999,
    "currency": "INR",
    "in_stock": true,
    "url": "https://mdcomputers.in/asus-dual-rtx-5060-ti-oc.html",
    "brand": "ASUS",
    "category": "graphics-card"
  }
]
```

**Scraping strategy**: Hit the site's search endpoint (likely `/catalogsearch/result/?q={query}`)
and parse the product listing grid. If category is provided, hit the category page with a
filter instead.

---

### Tool 2 — `browse_category`

**Purpose**: Paginated browse of a specific component category, with optional filters.

**Input schema:**
```json
{
  "category": "processor",
  "brand": "AMD",          // optional
  "min_price": 10000,      // optional, INR
  "max_price": 30000,      // optional
  "page": 1,
  "sort": "price_asc"      // price_asc | price_desc | name | newest
}
```

**Output:**
```json
{
  "category": "processor",
  "page": 1,
  "total_found": 47,
  "products": [ /* same product objects as search */ ]
}
```

**Scraping strategy**: Build the category URL with filter/sort params, scrape listing cards.
Detect the pagination count from the DOM to report `total_found`.

---

### Tool 3 — `get_product_details`

**Purpose**: Full specs + price for a single product (by URL or product name).

**Input schema:**
```json
{
  "product_url": "https://mdcomputers.in/asus-dual-rtx-5060-ti-oc.html"
}
```
or
```json
{
  "product_name": "ASUS Dual RTX 5060 Ti OC 16GB"
}
```

**Output:**
```json
{
  "name": "ASUS Dual GeForce RTX 5060 Ti OC 16GB",
  "price": 45999,
  "currency": "INR",
  "in_stock": true,
  "brand": "ASUS",
  "category": "graphics-card",
  "specs": {
    "GPU Chip": "NVIDIA GeForce RTX 5060 Ti",
    "VRAM": "16 GB GDDR7",
    "TDP": "165 W",
    "Length": "267 mm",
    "Power Connectors": "1× 16-pin"
  },
  "description": "...",
  "warranty": "3 years",
  "url": "https://mdcomputers.in/asus-dual-rtx-5060-ti-oc.html"
}
```

**Scraping strategy**: Fetch the product detail page; parse the specifications table rows
(usually a `<table>` or `<dl>` element), description text, price tag, and stock badge.

---

### Tool 4 — `compare_products`

**Purpose**: Fetch full details for 2–4 products and return them side-by-side in a
normalised structure the agent can format as a table.

**Input schema:**
```json
{
  "product_urls": [
    "https://mdcomputers.in/product-a.html",
    "https://mdcomputers.in/product-b.html"
  ]
}
```

**Output:**
```json
{
  "comparison": [
    { "name": "Product A", "price": 12500, "specs": { "Cores": "6", ... } },
    { "name": "Product B", "price": 15000, "specs": { "Cores": "8", ... } }
  ],
  "common_keys": ["Cores", "Threads", "Socket", "TDP"],
  "diff_keys": ["Boost Clock", "Cache"]
}
```

**Scraping strategy**: Call `get_product_details` concurrently (p-limit 2) for each URL,
then merge and normalise spec key names (e.g. "Core Count" vs "Cores" → unified as "Cores").

---

### Tool 5 — `check_build_compatibility`

**Purpose**: Given a list of component URLs (or names), return prices, a total build cost,
and a list of known compatibility issues.

**Input schema:**
```json
{
  "components": {
    "cpu":         "https://mdcomputers.in/amd-ryzen-5-7600x.html",
    "motherboard": "https://mdcomputers.in/asrock-b650m-pg-lightning.html",
    "ram":         "https://mdcomputers.in/corsair-vengeance-16gb-ddr5.html",
    "gpu":         "https://mdcomputers.in/asus-dual-rtx-5060-ti-oc.html",
    "psu":         "https://mdcomputers.in/cooler-master-mwe-650.html",
    "storage":     "https://mdcomputers.in/wd-black-sn770-1tb.html"
  }
}
```

**Output:**
```json
{
  "build": { /* full details per component */ },
  "total_price_inr": 112450,
  "compatibility": {
    "cpu_motherboard": { "ok": true, "note": "AM5 socket matches" },
    "ram_motherboard": { "ok": true, "note": "DDR5 matches B650M" },
    "psu_gpu":         { "ok": true, "note": "650W sufficient for RTX 5060 Ti (165W TDP)" }
  },
  "warnings": []
}
```

**Compatibility rules to encode in `normalize.js`:**
- CPU socket must match motherboard socket (AM4/AM5/LGA1700/LGA1851)
- RAM DDR generation must match motherboard spec (DDR4/DDR5)
- Estimated PSU headroom: CPU TDP + GPU TDP + 100W overhead ≤ PSU wattage
- Form factor: cabinet must support motherboard form factor (ATX/mATX/ITX)

These rules are deterministic string/number comparisons on already-scraped spec fields —
no additional network calls needed.

---

## 4. Caching Strategy

```
cache.js — in-memory Map<url, { data, expires }>

Category pages → TTL 30 minutes (prices change infrequently within a session)
Product detail → TTL 60 minutes
Search results → TTL 15 minutes
```

The cache is entirely in-memory and resets when the server restarts — appropriate for a
local/dev MCP server. For a production deployment, swap to Redis or SQLite.

---

## 5. Anti-Ban / Politeness

The site returns 403 on headless requests without a realistic User-Agent. Mitigation:

1. Set `User-Agent` to a real Chrome UA string in axios defaults.
2. Add `Accept-Language: en-IN,en;q=0.9` and standard browser headers.
3. 1–2 second random jitter between consecutive requests.
4. `p-limit(2)` — max 2 concurrent fetches at any time.
5. Respect cached results; never re-fetch within TTL.

If the site adds Cloudflare bot protection, the fallback is to swap `axios` for
`playwright` (headless Chrome) — the tool interfaces stay identical, only the scraper
internals change.

---

## 6. Claude Desktop Integration (claude_desktop_config.json)

Once built and installed, add this to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or the equivalent Windows path:

```json
{
  "mcpServers": {
    "mdcomputers": {
      "command": "node",
      "args": ["/absolute/path/to/mdcomputers-mcp/src/index.js"]
    }
  }
}
```

After restarting Claude Desktop the agent will have all five tools available.

---

## 7. Example Agent Prompts (what you'd type to Claude)

Once the MCP server is running, you can say things like:

- *"Find all RTX 5060 Ti cards on MDComputers under ₹50,000 and compare the cheapest three."*
- *"I want to build a gaming PC for ₹80,000. Suggest a compatible CPU + motherboard + RAM + GPU combo from MDComputers, show me the total cost."*
- *"Is the AMD Ryzen 5 7600X in stock on MDComputers? Give me the full specs."*
- *"Browse all AM5 motherboards under ₹15,000 and list them by price."*
- *"Check if these five components I picked are compatible with each other and give me the total price."*

Claude will call the appropriate tool(s), scrape the live site, and return structured
results — all in one conversational turn.

---

## 8. Build Phases

| Phase | Tasks | Est. effort |
|---|---|---|
| **1 — Scaffolding** | Repo setup, MCP SDK wiring, stdio transport, health check | 2–3 hours |
| **2 — Scraper core** | axios + Cheerio, headers, listing page parser, detail page parser | 4–6 hours |
| **3 — Tools 1–3** | search, browse, get_product_details | 4–5 hours |
| **4 — Tools 4–5** | compare, compatibility checker + rule engine | 3–4 hours |
| **5 — Cache + rate limiting** | TTL cache, p-limit, jitter | 1–2 hours |
| **6 — Claude Desktop test** | End-to-end test with real prompts, fix edge cases | 2–3 hours |

**Total: ~16–23 hours** for a solid working version.

---

## 9. Future Extensions

- `get_price_history` — if the site exposes any price history or you cache daily snapshots
- `notify_price_drop` — poll a product URL on a schedule and alert when price falls
- `suggest_alternatives` — for an out-of-stock item, surface similar in-stock products
- Multi-site support — extend scraper to Primeabgb, Vedant Computers, or Amazon.in for
  price comparison across Indian retailers
