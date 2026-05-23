import { ScraperService } from './scraper.service';
import { BadRequestException } from '@nestjs/common';
import { AxiosInstance } from 'axios';

describe('ScraperService', () => {
  let service: ScraperService;

  beforeEach(() => {
    service = new ScraperService();
  });

  describe('URL validation', () => {
    it('rejects non-https URLs', async () => {
      await expect(
        service.fetchHtml('http://mdcomputers.in/processor'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects URLs for other hostnames', async () => {
      await expect(
        service.fetchHtml('https://example.com/page'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects malformed URLs', async () => {
      await expect(service.fetchHtml('not-a-url')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts valid mdcomputers.in URLs without making a real network call', async () => {
      jest
        .spyOn(service as unknown as { jitter: () => Promise<void> }, 'jitter')
        .mockResolvedValue(undefined);
      jest
        .spyOn((service as unknown as { client: AxiosInstance }).client, 'get')
        .mockResolvedValue({ data: '<html><body>ok</body></html>' });

      const $ = await service.fetchHtml('https://mdcomputers.in/processor');
      expect($('body').text()).toContain('ok');
    });
  });
});
