import { Module } from '@nestjs/common';
import { McpServerService } from './mcp/mcp-server.service';
import { ToolsService } from './tools/tools.service';
import { ScraperService } from './scraper/scraper.service';
import { CacheService } from './utils/cache.service';

@Module({
  imports: [],
  controllers: [],
  providers: [McpServerService, ToolsService, ScraperService, CacheService],
})
export class AppModule {}
