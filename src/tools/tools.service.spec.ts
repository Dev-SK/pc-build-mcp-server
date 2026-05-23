import { load } from 'cheerio';
import { ToolsService } from './tools.service';
import { ScraperService } from '../scraper/scraper.service';
import { CacheService } from '../utils/cache.service';

// ─── Minimal listing-page HTML fixture ────────────────────────────────────────

const LISTING_HTML = `
<html><body>
<ol class="products list items product-items">
  <li class="item product product-item">
    <div class="product-item-info">
      <div class="product details product-item-details">
        <strong class="product name product-item-name">
          <a class="product-item-link" href="/asus-rtx-5060.html">ASUS Dual RTX 5060 16GB</a>
        </strong>
        <div class="price-box"><span class="price">&#x20B9;45,999</span></div>
        <div class="stock available"><span>In Stock</span></div>
      </div>
    </div>
  </li>
</ol>
<p class="toolbar-amount">Items 1-1 of 1</p>
</body></html>
`;

const DETAIL_HTML = `
<html><body>
  <h1 class="page-title"><span class="base">ASUS Dual RTX 5060 16GB</span></h1>
  <div class="product-info-price"><span class="price">&#x20B9;45,999</span></div>
  <div class="stock available"><span>In Stock</span></div>
  <table id="product-attribute-specs-table">
    <tr><th>GPU Chip</th><td>NVIDIA RTX 5060</td></tr>
    <tr><th>TDP</th><td>165 W</td></tr>
  </table>
</body></html>
`;

// ─── Mock factories ───────────────────────────────────────────────────────────

type MockScraper = { fetchHtml: jest.Mock; fetchMany: jest.Mock };
type MockCache = Pick<
  CacheService,
  'get' | 'set' | 'delete' | 'clear' | 'size'
>;

const makeMockScraper = (): MockScraper => ({
  fetchHtml: jest.fn().mockResolvedValue(load(LISTING_HTML)),
  fetchMany: jest
    .fn()
    .mockResolvedValue([load(DETAIL_HTML), load(DETAIL_HTML)]),
});

const makeMockCache = (): MockCache => ({
  get: jest.fn().mockReturnValue(undefined),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  size: 0,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ToolsService', () => {
  let service: ToolsService;
  let mockScraper: MockScraper;
  let mockCache: MockCache;

  beforeEach(() => {
    mockScraper = makeMockScraper();
    mockCache = makeMockCache();
    service = new ToolsService(
      mockScraper as unknown as ScraperService,
      mockCache as unknown as CacheService,
    );
  });

  // ── healthCheck ────────────────────────────────────────────────────────────

  describe('healthCheck', () => {
    it('returns ok status without hitting the scraper', () => {
      const result = service.healthCheck();
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text as string) as {
        status: string;
        service: string;
      };
      expect(payload.status).toBe('ok');
      expect(payload.service).toBe('pc-build-mcp-server');
      expect(mockScraper.fetchHtml).not.toHaveBeenCalled();
    });
  });

  // ── getProductDetails ──────────────────────────────────────────────────────

  describe('getProductDetails', () => {
    it('returns error when neither url nor name is provided', async () => {
      const result = await service.getProductDetails({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('product_url');
    });

    it('fetches detail page when product_url is given', async () => {
      mockScraper.fetchHtml.mockResolvedValue(load(DETAIL_HTML));
      const result = await service.getProductDetails({
        product_url: 'https://mdcomputers.in/asus-rtx-5060.html',
      });
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text as string) as {
        name: string;
        price: number;
      };
      expect(payload.name).toBe('ASUS Dual RTX 5060 16GB');
      expect(payload.price).toBe(45999);
    });

    it('returns cached product on second call', async () => {
      const cachedProduct = {
        name: 'Cached GPU',
        price: 999,
        currency: 'INR',
        in_stock: true,
        brand: null,
        category: null,
        url: 'https://mdcomputers.in/asus-rtx-5060.html',
        thumbnail_url: null,
        specs: {},
        description: null,
        warranty: null,
        rating: null,
        review_count: null,
      };
      (mockCache.get as jest.Mock).mockReturnValue(cachedProduct);
      const result = await service.getProductDetails({
        product_url: 'https://mdcomputers.in/asus-rtx-5060.html',
      });
      const payload = JSON.parse(result.content[0].text as string) as {
        name: string;
      };
      expect(payload.name).toBe('Cached GPU');
      expect(mockScraper.fetchHtml).not.toHaveBeenCalled();
    });

    it('searches by name when product_url is absent', async () => {
      mockScraper.fetchHtml
        .mockResolvedValueOnce(load(LISTING_HTML)) // search
        .mockResolvedValueOnce(load(DETAIL_HTML)); // detail
      const result = await service.getProductDetails({
        product_name: 'ASUS Dual RTX 5060',
      });
      expect(result.isError).toBeFalsy();
      expect(mockScraper.fetchHtml).toHaveBeenCalledTimes(2);
    });
  });

  // ── searchComponents ───────────────────────────────────────────────────────

  describe('searchComponents', () => {
    it('returns products from the listing page', async () => {
      const result = await service.searchComponents({ query: 'RTX 5060' });
      expect(result.isError).toBeFalsy();
      const products = JSON.parse(result.content[0].text as string) as Array<{
        name: string;
      }>;
      expect(products.length).toBeGreaterThan(0);
      expect(products[0].name).toBe('ASUS Dual RTX 5060 16GB');
    });

    it('respects max_results', async () => {
      const result = await service.searchComponents({
        query: 'RTX',
        max_results: 5,
      });
      const products = JSON.parse(
        result.content[0].text as string,
      ) as unknown[];
      expect(products.length).toBeLessThanOrEqual(5);
    });

    it('returns cached result without hitting the scraper', async () => {
      const cached = [{ name: 'Cached GPU', price: 999 }];
      (mockCache.get as jest.Mock).mockReturnValue(cached);
      const result = await service.searchComponents({ query: 'RTX 5060' });
      const payload = JSON.parse(
        result.content[0].text as string,
      ) as typeof cached;
      expect(payload[0].name).toBe('Cached GPU');
      expect(mockScraper.fetchHtml).not.toHaveBeenCalled();
    });

    it('returns error result when scraper throws', async () => {
      mockScraper.fetchHtml.mockRejectedValue(new Error('Network error'));
      const result = await service.searchComponents({ query: 'RTX 5060' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network error');
    });
  });

  // ── browseCategory ─────────────────────────────────────────────────────────

  describe('browseCategory', () => {
    it('returns category, page, total_found, products', async () => {
      const result = await service.browseCategory({ category: 'processor' });
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text as string) as {
        category: string;
        page: number;
        total_found: number;
        products: unknown[];
      };
      expect(payload.category).toBe('processor');
      expect(payload.page).toBe(1);
      expect(typeof payload.total_found).toBe('number');
      expect(Array.isArray(payload.products)).toBe(true);
    });
  });

  // ── compareProducts ────────────────────────────────────────────────────────

  describe('compareProducts', () => {
    it('returns comparison, common_keys, diff_keys', async () => {
      mockScraper.fetchHtml.mockResolvedValue(load(DETAIL_HTML));
      const result = await service.compareProducts({
        product_urls: [
          'https://mdcomputers.in/a.html',
          'https://mdcomputers.in/b.html',
        ],
      });
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text as string) as {
        comparison: unknown[];
        common_keys: string[];
        diff_keys: string[];
      };
      expect(payload.comparison).toHaveLength(2);
      expect(Array.isArray(payload.common_keys)).toBe(true);
      expect(Array.isArray(payload.diff_keys)).toBe(true);
    });
  });

  // ── checkBuildCompatibility ────────────────────────────────────────────────

  describe('checkBuildCompatibility', () => {
    it('returns build, total_price_inr, compatibility, warnings', async () => {
      mockScraper.fetchHtml.mockResolvedValue(load(DETAIL_HTML));
      const result = await service.checkBuildCompatibility({
        components: { gpu: 'https://mdcomputers.in/asus-rtx-5060.html' },
      });
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text as string) as {
        total_price_inr: number;
        compatibility: Record<string, unknown>;
        warnings: string[];
      };
      expect(typeof payload.total_price_inr).toBe('number');
      expect(typeof payload.compatibility).toBe('object');
      expect(Array.isArray(payload.warnings)).toBe(true);
    });
  });
});
