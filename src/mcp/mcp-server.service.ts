import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ToolsService } from '../tools/tools.service';

@Injectable()
export class McpServerService {
  private readonly logger = new Logger(McpServerService.name);
  private readonly server = new McpServer({
    name: 'pc-build-mcp-server',
    version: '0.1.0',
  });
  private started = false;

  constructor(private readonly toolsService: ToolsService) {
    this.registerTools();
  }

  async start(): Promise<void> {
    if (this.started) return;
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.started = true;
    this.logger.log('MCP stdio transport started');
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    await this.server.close();
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }

  private registerTools(): void {
    this.server.registerTool(
      'health_check',
      {
        description: 'Basic health and readiness check for the MCP server',
      },
      async () => Promise.resolve(this.toolsService.healthCheck()),
    );

    this.server.registerTool(
      'search_components',
      {
        description:
          'Keyword search across MDComputers products. Returns a list of matching products with name, price, stock status, and URL.',
        inputSchema: {
          query: z.string().min(1).describe('Search query, e.g. "RTX 5060 Ti"'),
          category: z
            .string()
            .optional()
            .describe(
              'Optional category slug, e.g. "graphics-card", "processor"',
            ),
          max_results: z
            .number()
            .int()
            .min(1)
            .max(30)
            .optional()
            .describe('Maximum results to return (default 10, max 30)'),
        },
      },
      (args) => this.toolsService.searchComponents(args),
    );

    this.server.registerTool(
      'browse_category',
      {
        description:
          'Paginated browse of a PC component category with optional brand/price/sort filters.',
        inputSchema: {
          category: z
            .string()
            .min(1)
            .describe('Category slug, e.g. "processor", "graphics-card"'),
          brand: z.string().optional().describe('Brand filter, e.g. "AMD"'),
          min_price: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('Minimum price in INR'),
          max_price: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('Maximum price in INR'),
          page: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe('Page number (default 1)'),
          sort: z
            .enum(['price_asc', 'price_desc', 'name', 'newest'])
            .optional()
            .describe('Sort order'),
        },
      },
      (args) => this.toolsService.browseCategory(args),
    );

    this.server.registerTool(
      'get_product_details',
      {
        description:
          'Get full specs, price, and stock status for a single product by URL or name.',
        inputSchema: {
          product_url: z
            .string()
            .url()
            .optional()
            .describe('Direct product URL, e.g. "https://mdcomputers.in/..."'),
          product_name: z
            .string()
            .min(1)
            .optional()
            .describe('Product name to search for when URL is unknown'),
        },
      },
      (args) => this.toolsService.getProductDetails(args),
    );

    this.server.registerTool(
      'compare_products',
      {
        description:
          'Compare 2–4 products side-by-side. Returns specs, prices, and a list of differing spec keys.',
        inputSchema: {
          product_urls: z
            .array(z.string().url())
            .min(2)
            .max(4)
            .describe('Array of 2 to 4 product URLs to compare'),
        },
      },
      (args) => this.toolsService.compareProducts(args),
    );

    this.server.registerTool(
      'check_build_compatibility',
      {
        description:
          'Check CPU/motherboard/RAM/GPU/PSU/case compatibility and compute the total build cost.',
        inputSchema: {
          components: z
            .record(z.string(), z.string().min(1))
            .describe(
              'Map of role → product URL, e.g. { "cpu": "https://...", "motherboard": "https://..." }',
            ),
        },
      },
      (args) => this.toolsService.checkBuildCompatibility(args),
    );
  }
}
