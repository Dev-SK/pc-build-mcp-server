import { load } from 'cheerio';
import {
  parseListingPage,
  parseProductDetail,
  parseTotalCount,
} from './parsers';

// ─── Minimal Magento-2 listing HTML fixture ─────────────────────────────────

const LISTING_HTML = `
<html><body>
<ol class="products list items product-items">
  <li class="item product product-item">
    <div class="product-item-info">
      <a href="/asus-rtx-5060.html" class="product photo product-item-photo">
        <img class="product-image-photo" src="/media/asus-rtx-5060.jpg" alt="ASUS RTX 5060" />
      </a>
      <div class="product details product-item-details">
        <strong class="product name product-item-name">
          <a class="product-item-link" href="/asus-rtx-5060.html">ASUS Dual RTX 5060 16GB</a>
        </strong>
        <div class="price-box"><span class="price">₹45,999</span></div>
        <div class="stock available"><span>In Stock</span></div>
      </div>
    </div>
  </li>
  <li class="item product product-item">
    <div class="product-item-info">
      <a href="/msi-rtx-5060.html" class="product photo product-item-photo"></a>
      <div class="product details product-item-details">
        <strong class="product name product-item-name">
          <a class="product-item-link" href="/msi-rtx-5060.html">MSI Gaming RTX 5060 OC</a>
        </strong>
        <div class="price-box"><span class="price">₹46,999</span></div>
        <div class="stock"><span>Out of Stock</span></div>
      </div>
    </div>
  </li>
</ol>
<p class="toolbar-amount">Items 1-2 of 14</p>
</body></html>
`;

// ─── Minimal product detail HTML fixture ────────────────────────────────────

const DETAIL_HTML = `
<html><body>
  <h1 class="page-title"><span class="base">ASUS Dual GeForce RTX 5060 Ti OC 16GB</span></h1>
  <div class="product-info-price"><span class="price">₹45,999</span></div>
  <div class="stock available"><span>In Stock</span></div>
  <div itemprop="brand">ASUS</div>
  <img class="product-image-photo" src="/media/asus-detail.jpg" />
  <table id="product-attribute-specs-table">
    <tr><th>GPU Chip</th><td>NVIDIA GeForce RTX 5060 Ti</td></tr>
    <tr><th>VRAM</th><td>16 GB GDDR7</td></tr>
    <tr><th>TDP</th><td>165 W</td></tr>
    <tr><th>Socket</th><td>PCIe 5.0</td></tr>
    <tr><th>Warranty</th><td>3 Years</td></tr>
  </table>
  <div class="product attribute description"><div class="value">High-performance GPU for gaming.</div></div>
</body></html>
`;

describe('parseListingPage', () => {
  it('returns the correct number of products', () => {
    const $ = load(LISTING_HTML);
    const products = parseListingPage($);
    expect(products).toHaveLength(2);
  });

  it('parses name, price, stock, url, thumbnail for the first product', () => {
    const $ = load(LISTING_HTML);
    const [p1] = parseListingPage($);
    expect(p1.name).toBe('ASUS Dual RTX 5060 16GB');
    expect(p1.price).toBe(45999);
    expect(p1.in_stock).toBe(true);
    expect(p1.url).toContain('asus-rtx-5060');
    expect(p1.thumbnail_url).toBe('/media/asus-rtx-5060.jpg');
    expect(p1.currency).toBe('INR');
  });

  it('marks second product as out of stock', () => {
    const $ = load(LISTING_HTML);
    const [, p2] = parseListingPage($);
    expect(p2.in_stock).toBe(false);
    expect(p2.price).toBe(46999);
  });

  it('propagates the supplied category to all products', () => {
    const $ = load(LISTING_HTML);
    const products = parseListingPage($, 'graphics-card');
    expect(products.every((p) => p.category === 'graphics-card')).toBe(true);
  });

  it('returns empty array for a page with no product items', () => {
    const $ = load('<html><body><p>No results</p></body></html>');
    expect(parseListingPage($)).toHaveLength(0);
  });
});

describe('parseProductDetail', () => {
  const url = 'https://mdcomputers.in/asus-dual-rtx-5060-ti.html';

  it('parses name', () => {
    const $ = load(DETAIL_HTML);
    const d = parseProductDetail($, url);
    expect(d.name).toBe('ASUS Dual GeForce RTX 5060 Ti OC 16GB');
  });

  it('parses price', () => {
    const $ = load(DETAIL_HTML);
    const d = parseProductDetail($, url);
    expect(d.price).toBe(45999);
  });

  it('parses in_stock = true', () => {
    const $ = load(DETAIL_HTML);
    expect(parseProductDetail($, url).in_stock).toBe(true);
  });

  it('parses brand', () => {
    const $ = load(DETAIL_HTML);
    expect(parseProductDetail($, url).brand).toBe('ASUS');
  });

  it('parses specs table', () => {
    const $ = load(DETAIL_HTML);
    const d = parseProductDetail($, url);
    expect(d.specs['GPU Chip']).toBe('NVIDIA GeForce RTX 5060 Ti');
    expect(d.specs['TDP']).toBe('165 W');
  });

  it('extracts warranty from specs', () => {
    const $ = load(DETAIL_HTML);
    expect(parseProductDetail($, url).warranty).toBe('3 Years');
  });

  it('parses description', () => {
    const $ = load(DETAIL_HTML);
    expect(parseProductDetail($, url).description).toContain(
      'High-performance GPU',
    );
  });

  it('sets url from the argument', () => {
    const $ = load(DETAIL_HTML);
    expect(parseProductDetail($, url).url).toBe(url);
  });

  it('parses out-of-stock product', () => {
    const html = DETAIL_HTML.replace('In Stock', 'Out of Stock').replace(
      'class="stock available"',
      'class="stock"',
    );
    const $ = load(html);
    expect(parseProductDetail($, url).in_stock).toBe(false);
  });
});

describe('parseTotalCount', () => {
  it('extracts the total count from "of N" pattern', () => {
    const $ = load('<p class="toolbar-amount">Items 1-12 of 47</p>');
    expect(parseTotalCount($)).toBe(47);
  });

  it('extracts comma-formatted count', () => {
    const $ = load('<p class="toolbar-amount">Items 1-12 of 1,234</p>');
    expect(parseTotalCount($)).toBe(1234);
  });

  it('returns null when toolbar element is absent', () => {
    const $ = load('<p>Nothing here</p>');
    expect(parseTotalCount($)).toBeNull();
  });
});
