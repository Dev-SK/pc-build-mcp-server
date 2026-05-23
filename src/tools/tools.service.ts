import { Injectable, Logger } from '@nestjs/common';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ScraperService } from '../scraper/scraper.service';
import { CacheService, CACHE_TTL } from '../utils/cache.service';
import {
  parseListingPage,
  parseProductDetail,
  parseTotalCount,
  ProductDetail,
  ProductSummary,
} from '../scraper/parsers';
import {
  buildSearchUrl,
  buildCategorySearchUrl,
  buildCategoryUrl,
} from '../scraper/url-builder';
import { checkCompatibility } from '../utils/compatibility';

// ─── Arg types (public — also used by McpServerService) ───────────────────────

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

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly cacheService: CacheService,
  ) {}

  healthCheck(): CallToolResult {
    return this.jsonResult({
      status: 'ok',
      service: 'pc-build-mcp-server',
      timestamp: new Date().toISOString(),
    });
  }

  async searchComponents(args: SearchComponentsArgs): Promise<CallToolResult> {
    const maxResults = args.max_results ?? 10;
    const cacheKey = `search:${args.query}:${args.category ?? ''}:${maxResults}`;
    const cached = this.cacheService.get<ProductSummary[]>(cacheKey);
    if (cached) return this.jsonResult(cached);

    try {
      const url = args.category
        ? buildCategorySearchUrl(args.category, args.query)
        : buildSearchUrl(args.query);

      const $ = await this.scraperService.fetchHtml(url);
      const products = parseListingPage($, args.category ?? null).slice(
        0,
        maxResults,
      );

      this.cacheService.set(cacheKey, products, CACHE_TTL.SEARCH);
      return this.jsonResult(products);
    } catch (err) {
      return this.handleError('search_components', err);
    }
  }

  async browseCategory(args: BrowseCategoryArgs): Promise<CallToolResult> {
    const cacheKey = `browse:${JSON.stringify(args)}`;

    type BrowseResult = {
      category: string;
      page: number;
      total_found: number | null;
      products: ProductSummary[];
    };

    const cached = this.cacheService.get<BrowseResult>(cacheKey);
    if (cached) return this.jsonResult(cached);

    try {
      const url = buildCategoryUrl(args);
      const $ = await this.scraperService.fetchHtml(url);

      const products = parseListingPage($, args.category);
      const total_found = parseTotalCount($) ?? products.length;

      const result: BrowseResult = {
        category: args.category,
        page: args.page ?? 1,
        total_found,
        products,
      };

      this.cacheService.set(cacheKey, result, CACHE_TTL.CATEGORY);
      return this.jsonResult(result);
    } catch (err) {
      return this.handleError('browse_category', err);
    }
  }

  async getProductDetails(
    args: GetProductDetailsArgs,
  ): Promise<CallToolResult> {
    if (!args.product_url && !args.product_name) {
      return this.errorResult(
        'Either product_url or product_name must be provided.',
      );
    }

    try {
      const url = await this.resolveProductUrl(args);
      if (!url) {
        return this.errorResult(
          `No product found for name "${args.product_name ?? ''}".`,
        );
      }
      return this.jsonResult(await this.fetchProductDetail(url));
    } catch (err) {
      return this.handleError('get_product_details', err);
    }
  }

  async compareProducts(args: CompareProductsArgs): Promise<CallToolResult> {
    try {
      const details = await Promise.all(
        args.product_urls.map((url) => this.fetchProductDetail(url)),
      );

      const allKeys = details.flatMap((d) => Object.keys(d.specs));
      const uniqueKeys = [...new Set(allKeys)];

      const commonKeys = uniqueKeys.filter((key) =>
        details.every((d) => key in d.specs),
      );
      const diffKeys = uniqueKeys.filter(
        (key) => !details.every((d) => d.specs[key] === details[0].specs[key]),
      );

      return this.jsonResult({
        comparison: details,
        common_keys: commonKeys,
        diff_keys: diffKeys,
      });
    } catch (err) {
      return this.handleError('compare_products', err);
    }
  }

  async checkBuildCompatibility(
    args: CheckBuildCompatibilityArgs,
  ): Promise<CallToolResult> {
    try {
      const entries = Object.entries(args.components);
      const detailPairs = await Promise.all(
        entries.map(async ([role, url]) => {
          const detail = await this.fetchProductDetail(url);
          return [role, detail] as [string, ProductDetail];
        }),
      );
      const detailMap = Object.fromEntries(detailPairs);

      const totalPrice = detailPairs.reduce(
        (sum, [, d]) => sum + (d.price ?? 0),
        0,
      );

      const { checks, warnings } = checkCompatibility(detailMap);

      return this.jsonResult({
        build: detailMap,
        total_price_inr: totalPrice,
        compatibility: checks,
        warnings,
      });
    } catch (err) {
      return this.handleError('check_build_compatibility', err);
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Fetch and parse a product detail page, using the 60-minute cache.
   */
  private async fetchProductDetail(url: string): Promise<ProductDetail> {
    const cacheKey = `product:${url}`;
    const cached = this.cacheService.get<ProductDetail>(cacheKey);
    if (cached) return cached;

    const $ = await this.scraperService.fetchHtml(url);
    const detail = parseProductDetail($, url);

    this.cacheService.set(cacheKey, detail, CACHE_TTL.PRODUCT);
    return detail;
  }

  /**
   * Resolve a product URL from either a direct URL or a name search.
   */
  private async resolveProductUrl(
    args: GetProductDetailsArgs,
  ): Promise<string | null> {
    if (args.product_url) return args.product_url;

    // Search for the product name and return the first result URL
    const searchUrl = buildSearchUrl(args.product_name ?? '');
    const $ = await this.scraperService.fetchHtml(searchUrl);
    const results = parseListingPage($);
    return results.length > 0 ? results[0].url || null : null;
  }

  private handleError(tool: string, err: unknown): CallToolResult {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`[${tool}] ${message}`);
    return this.errorResult(`${tool} failed: ${message}`);
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
