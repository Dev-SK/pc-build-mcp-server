import { ToolsService } from './tools.service';

type ToolPayload = {
  status: string;
  tool?: string;
  service?: string;
  input?: unknown;
};

describe('ToolsService', () => {
  let service: ToolsService;

  beforeEach(() => {
    service = new ToolsService();
  });

  describe('healthCheck', () => {
    it('returns ok status', () => {
      const result = service.healthCheck();
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(
        result.content[0].text as string,
      ) as ToolPayload;
      expect(payload.status).toBe('ok');
      expect(payload.service).toBe('pc-build-mcp-server');
    });
  });

  describe('getProductDetails', () => {
    it('returns an error when neither url nor name is provided', () => {
      const result = service.getProductDetails({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('product_url');
    });

    it('returns not_implemented when product_url is provided', () => {
      const result = service.getProductDetails({
        product_url: 'https://mdcomputers.in/some-product.html',
      });
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(
        result.content[0].text as string,
      ) as ToolPayload;
      expect(payload.status).toBe('not_implemented');
    });

    it('returns not_implemented when product_name is provided', () => {
      const result = service.getProductDetails({
        product_name: 'RTX 5060 Ti',
      });
      const payload = JSON.parse(
        result.content[0].text as string,
      ) as ToolPayload;
      expect(payload.status).toBe('not_implemented');
    });
  });

  describe('searchComponents', () => {
    it('returns not_implemented stub', () => {
      const result = service.searchComponents({ query: 'RTX 5060 Ti' });
      const payload = JSON.parse(
        result.content[0].text as string,
      ) as ToolPayload;
      expect(payload.status).toBe('not_implemented');
      expect(payload.tool).toBe('search_components');
    });
  });

  describe('browseCategory', () => {
    it('returns not_implemented stub', () => {
      const result = service.browseCategory({ category: 'processor' });
      const payload = JSON.parse(
        result.content[0].text as string,
      ) as ToolPayload;
      expect(payload.status).toBe('not_implemented');
    });
  });

  describe('compareProducts', () => {
    it('returns not_implemented stub', () => {
      const result = service.compareProducts({
        product_urls: [
          'https://mdcomputers.in/a.html',
          'https://mdcomputers.in/b.html',
        ],
      });
      const payload = JSON.parse(
        result.content[0].text as string,
      ) as ToolPayload;
      expect(payload.status).toBe('not_implemented');
    });
  });

  describe('checkBuildCompatibility', () => {
    it('returns not_implemented stub', () => {
      const result = service.checkBuildCompatibility({
        components: { cpu: 'https://mdcomputers.in/ryzen-5.html' },
      });
      const payload = JSON.parse(
        result.content[0].text as string,
      ) as ToolPayload;
      expect(payload.status).toBe('not_implemented');
    });
  });
});
