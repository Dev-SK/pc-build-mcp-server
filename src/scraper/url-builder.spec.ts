import {
  buildSearchUrl,
  buildCategorySearchUrl,
  buildCategoryUrl,
  resolveProductUrl,
  BASE_URL,
} from './url-builder';

describe('buildSearchUrl', () => {
  it('builds the correct search URL', () => {
    const url = buildSearchUrl('RTX 5060 Ti');
    expect(url).toBe(`${BASE_URL}/catalogsearch/result/?q=RTX+5060+Ti`);
  });

  it('encodes special characters', () => {
    const url = buildSearchUrl('Ryzen 5 7600X');
    expect(url).toContain('q=Ryzen+5+7600X');
  });
});

describe('buildCategorySearchUrl', () => {
  it('builds a category page URL with a search query param', () => {
    const url = buildCategorySearchUrl('graphics-card', 'RTX 5060');
    expect(url).toContain('/graphics-card');
    expect(url).toContain('q=RTX+5060');
  });
});

describe('buildCategoryUrl', () => {
  it('builds a basic category URL', () => {
    const url = buildCategoryUrl({ category: 'processor' });
    expect(url).toBe(`${BASE_URL}/processor`);
  });

  it('adds a page param when page > 1', () => {
    const url = buildCategoryUrl({ category: 'processor', page: 3 });
    expect(url).toContain('p=3');
  });

  it('does not add page param for page 1', () => {
    const url = buildCategoryUrl({ category: 'processor', page: 1 });
    expect(url).not.toContain('p=');
  });

  it('adds sort params for price_asc', () => {
    const url = buildCategoryUrl({
      category: 'processor',
      sort: 'price_asc',
    });
    expect(url).toContain('product_list_order=price');
    expect(url).toContain('product_list_dir=asc');
  });

  it('adds sort params for newest', () => {
    const url = buildCategoryUrl({ category: 'processor', sort: 'newest' });
    expect(url).toContain('product_list_order=created_at');
    expect(url).toContain('product_list_dir=desc');
  });

  it('adds brand param', () => {
    const url = buildCategoryUrl({ category: 'processor', brand: 'AMD' });
    expect(url).toContain('brand=AMD');
  });

  it('adds price range with both bounds', () => {
    const url = buildCategoryUrl({
      category: 'processor',
      min_price: 10000,
      max_price: 30000,
    });
    expect(url).toContain('price=10000-30000');
  });

  it('adds price range with only min', () => {
    const url = buildCategoryUrl({
      category: 'processor',
      min_price: 10000,
    });
    expect(url).toContain('price=10000-');
  });
});

describe('resolveProductUrl', () => {
  it('returns absolute URLs unchanged', () => {
    const abs = 'https://mdcomputers.in/some-product.html';
    expect(resolveProductUrl(abs)).toBe(abs);
  });

  it('resolves relative URLs against BASE_URL', () => {
    expect(resolveProductUrl('/some-product.html')).toBe(
      `${BASE_URL}/some-product.html`,
    );
  });

  it('returns empty string for empty input', () => {
    expect(resolveProductUrl('')).toBe('');
  });
});
