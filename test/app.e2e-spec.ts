import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { McpServerService } from '../src/mcp/mcp-server.service';
import { ToolsService } from '../src/tools/tools.service';

type HealthPayload = { status: string };

describe('AppModule (e2e)', () => {
  let moduleFixture: TestingModule;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('resolves McpServerService', () => {
    expect(moduleFixture.get(McpServerService)).toBeDefined();
  });

  it('resolves ToolsService', () => {
    expect(moduleFixture.get(ToolsService)).toBeDefined();
  });

  it('health_check tool returns ok via ToolsService', () => {
    const toolsService = moduleFixture.get(ToolsService);
    const result = toolsService.healthCheck();
    const payload = JSON.parse(
      result.content[0].text as string,
    ) as HealthPayload;
    expect(payload.status).toBe('ok');
  });
});
