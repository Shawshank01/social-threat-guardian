import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import pushRoutes from './routes/push.routes.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (_req, res) => res.send('WebPush backend (file storage) is running'));
  app.use('/api', pushRoutes);

  app.use((req, res) => res.status(404).json({ message: 'Not Found' }));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  });

  return app;
}