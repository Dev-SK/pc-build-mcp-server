import { Test, TestingModule } from '@nestjs/testing';
import { McpServerService } from './mcp-server.service';
import { ToolsService } from '../tools/tools.service';
import { ScraperService } from '../scraper/scraper.service';
import { CacheService } from '../utils/cache.service';

describe('McpServerService', () => {
  let service: McpServerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McpServerService, ToolsService, ScraperService, CacheService],
    }).compile();

    service = module.get<McpServerService>(McpServerService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('is not started before start() is called', () => {
    expect(service.isStarted()).toBe(false);
  });

  it('stop() is a no-op when not started', async () => {
    await expect(service.stop()).resolves.toBeUndefined();
  });
});
