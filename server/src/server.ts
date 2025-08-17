// src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import { setupMiddlewares } from './config/middlewares';

const app = express();
const PORT = process.env.PORT || 3000;

setupMiddlewares(app);
connectDatabase();
app.set('trust proxy', 1);

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), service: 'ChimArena API', version: '0.1.0' });
});

app.use('*', (req: Request, res: Response) => res.status(404).json({ error: 'Route non trouvée', path: req.originalUrl }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Erreur:', err);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur ChimArena sur ${PORT}`);
});

export default app;
