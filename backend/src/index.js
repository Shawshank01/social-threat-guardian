import { createApp } from './app.js';
import { config } from './config.js';
import { initStorage } from './storage.js';

async function main() {
  await initStorage();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[Server] http://localhost:${config.port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});