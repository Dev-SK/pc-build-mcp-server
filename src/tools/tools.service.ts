import { Injectable } from '@nestjs/common';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type SearchComponentsArgs = {
  query: string;
  category?: string;
  max_results?: number;
};

export type BrowseCategoryArgs = {
  category: string;
  brand?: string;
  min_price?: number;
  max_price?: number;
  page?: number;
  sort?: 'price_asc' | 'price_desc' | 'name' | 'newest';
};

export type GetProductDetailsArgs = {
  product_url?: string;
  product_name?: string;
};

export type CompareProductsArgs = {
  product_urls: string[];
};

export type CheckBuildCompatibilityArgs = {
  components: Record<string, string>;
};

@Injectable()
export class ToolsService {
  healthCheck(): CallToolResult {
    return this.jsonResult({
      status: 'ok',
      service: 'pc-build-mcp-server',
      timestamp: new Date().toISOString(),
    });
  }

  searchComponents(args: SearchComponentsArgs): CallToolResult {
    return this.notImplemented('search_components', args);
  }

  browseCategory(args: BrowseCategoryArgs): CallToolResult {
    return this.notImplemented('browse_category', args);
  }

  getProductDetails(args: GetProductDetailsArgs): CallToolResult {
    if (!args.product_url && !args.product_name) {
      return this.errorResult(
        'Either product_url or product_name must be provided.',
      );
    }
    return this.notImplemented('get_product_details', args);
  }

  compareProducts(args: CompareProductsArgs): CallToolResult {
    return this.notImplemented('compare_products', args);
  }

  checkBuildCompatibility(args: CheckBuildCompatibilityArgs): CallToolResult {
    return this.notImplemented('check_build_compatibility', args);
  }

  private notImplemented(tool: string, input: unknown): CallToolResult {
    return this.jsonResult({
      status: 'not_implemented',
      tool,
      input,
      message:
        'Scraper-backed logic will be wired up in the next implementation phase.',
    });
  }

  private errorResult(message: string): CallToolResult {
    return {
      isError: true,
      content: [{ type: 'text', text: message }],
    };
  }

  private jsonResult(payload: unknown): CallToolResult {
    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    };
  }
}
