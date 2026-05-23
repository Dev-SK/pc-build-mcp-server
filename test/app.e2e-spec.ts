import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { McpServerService } from '../src/mcp/mcp-server.service';
import { ToolsService } from '../src/tools/tools.service';
import { ScraperService } from '../src/scraper/scraper.service';
import { CacheService } from '../src/utils/cache.service';
import { load } from 'cheerio';

type HealthPayload = { status: string };

describe('AppModule (e2e)', () => {
  let moduleFixture: TestingModule;
  let toolsService: ToolsService;

  const listingHtml = `
    <html><body>
      <ol class="products list items product-items">
        <li class="item product product-item">
          <div class="product-item-info">
            <div class="product details product-item-details">
              <strong class="product name product-item-name">
                <a class="product-item-link" href="/asus-rtx-5060.html">ASUS Dual RTX 5060 16GB</a>
              </strong>
              <div class="price-box"><span class="price">₹45,999</span></div>
              <div class="stock available"><span>In Stock</span></div>
            </div>
          </div>
        </li>
      </ol>
      <p class="toolbar-amount">Items 1-1 of 1</p>
    </body></html>
  `;

  const detailHtml = (
    name: string,
    price: number,
    specs: Array<[string, string]>,
  ): string => `
    <html><body>
      <h1 class="page-title"><span class="base">${name}</span></h1>
      <div class="product-info-price"><span class="price">₹${price}</span></div>
      <div class="stock available"><span>In Stock</span></div>
      <table id="product-attribute-specs-table">
        ${specs.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}
      </table>
    </body></html>
  `;

  const detailByPath: Record<string, string> = {
    '/asus-rtx-5060.html': detailHtml('ASUS Dual RTX 5060 16GB', 45999, [
      ['TDP', '165 W'],
      ['Socket', 'N/A'],
    ]),
    '/cpu-am5.html': detailHtml('AMD Ryzen 5 7600X', 19999, [
      ['Socket', 'AM5'],
      ['TDP', '105 W'],
    ]),
    '/mb-am5.html': detailHtml('ASRock B650M', 12999, [
      ['Socket', 'AM5'],
      ['Memory Type', 'DDR5'],
      ['Form Factor', 'mATX'],
    ]),
    '/ram-ddr5.html': detailHtml('Corsair 16GB DDR5', 4999, [
      ['Memory Type', 'DDR5'],
    ]),
    '/gpu-rtx.html': detailHtml('RTX 5060 Ti', 45999, [['TDP', '165 W']]),
    '/psu-650.html': detailHtml('Cooler Master 650W', 5499, [
      ['Wattage', '650 W'],
    ]),
    '/case-atx.html': detailHtml('ATX Cabinet', 2999, [['Form Factor', 'ATX']]),
  };

  const mockScraper = {
    fetchHtml: jest.fn((url: string) => {
      if (
        url.includes('/catalogsearch/result/') ||
        /\/(graphics-card|processor)$/.test(url)
      ) {
        return Promise.resolve(load(listingHtml));
      }
      const parsed = new URL(url);
      const html = detailByPath[parsed.pathname];
      return Promise.resolve(
        load(html ?? detailHtml('Unknown Product', 0, [])),
      );
    }),
    fetchMany: jest.fn(),
  };

  const mockCache = {
    get: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    size: 0,
  };

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ScraperService)
      .useValue(mockScraper)
      .overrideProvider(CacheService)
      .useValue(mockCache)
      .compile();
    toolsService = moduleFixture.get(ToolsService);
  });

  afterEach(async () => {
    await moduleFixture.close();
    jest.clearAllMocks();
  });

  it('resolves McpServerService', () => {
    expect(moduleFixture.get(McpServerService)).toBeDefined();
  });

  it('resolves ToolsService', () => {
    expect(moduleFixture.get(ToolsService)).toBeDefined();
  });

  it('health_check tool returns ok via ToolsService', () => {
    const result = toolsService.healthCheck();
    const payload = JSON.parse(
      result.content[0].text as string,
    ) as HealthPayload;
    expect(payload.status).toBe('ok');
  });

  it('search_components returns listing results', async () => {
    const result = await toolsService.searchComponents({ query: 'rtx 5060' });
    const payload = JSON.parse(result.content[0].text as string) as Array<{
      name: string;
    }>;
    expect(result.isError).toBeFalsy();
    expect(payload[0].name).toContain('RTX 5060');
  });

  it('browse_category returns paginated category response', async () => {
    const result = await toolsService.browseCategory({
      category: 'graphics-card',
    });
    const payload = JSON.parse(result.content[0].text as string) as {
      category: string;
      page: number;
      total_found: number;
    };
    expect(result.isError).toBeFalsy();
    expect(payload.category).toBe('graphics-card');
    expect(payload.page).toBe(1);
    expect(payload.total_found).toBe(1);
  });

  it('get_product_details resolves by product_name', async () => {
    const result = await toolsService.getProductDetails({
      product_name: 'ASUS Dual RTX 5060 16GB',
    });
    const payload = JSON.parse(result.content[0].text as string) as {
      name: string;
      price: number;
      specs: Record<string, string>;
    };
    expect(result.isError).toBeFalsy();
    expect(payload.name).toBe('ASUS Dual RTX 5060 16GB');
    expect(payload.price).toBe(45999);
    expect(payload.specs.TDP).toBe('165 W');
  });

  it('compare_products returns comparison output', async () => {
    const result = await toolsService.compareProducts({
      product_urls: [
        'https://mdcomputers.in/asus-rtx-5060.html',
        'https://mdcomputers.in/gpu-rtx.html',
      ],
    });
    const payload = JSON.parse(result.content[0].text as string) as {
      comparison: unknown[];
      common_keys: string[];
    };
    expect(result.isError).toBeFalsy();
    expect(payload.comparison).toHaveLength(2);
    expect(payload.common_keys).toContain('TDP');
  });

  it('check_build_compatibility returns checks and no warnings for a valid build', async () => {
    const result = await toolsService.checkBuildCompatibility({
      components: {
        cpu: 'https://mdcomputers.in/cpu-am5.html',
        motherboard: 'https://mdcomputers.in/mb-am5.html',
        ram: 'https://mdcomputers.in/ram-ddr5.html',
        gpu: 'https://mdcomputers.in/gpu-rtx.html',
        psu: 'https://mdcomputers.in/psu-650.html',
        cabinet: 'https://mdcomputers.in/case-atx.html',
      },
    });
    const payload = JSON.parse(result.content[0].text as string) as {
      compatibility: Record<string, { ok: boolean }>;
      warnings: string[];
      total_price_inr: number;
    };
    expect(result.isError).toBeFalsy();
    expect(payload.compatibility.cpu_motherboard.ok).toBe(true);
    expect(payload.compatibility.ram_motherboard.ok).toBe(true);
    expect(payload.compatibility.psu_load.ok).toBe(true);
    expect(payload.compatibility.cabinet_motherboard.ok).toBe(true);
    expect(payload.warnings).toHaveLength(0);
    expect(payload.total_price_inr).toBeGreaterThan(0);
  });
});
