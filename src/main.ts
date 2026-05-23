import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { McpServerService } from './mcp/mcp-server.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const mcpService = app.get(McpServerService);
  await mcpService.start();

  const gracefulShutdown = async () => {
    await mcpService.stop();
    await app.close();
  };

  process.on(
    'SIGINT',
    () => void gracefulShutdown().finally(() => process.exit(0)),
  );
  process.on(
    'SIGTERM',
    () => void gracefulShutdown().finally(() => process.exit(0)),
  );
}

void bootstrap();
