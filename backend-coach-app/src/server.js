import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/env.js';
import prisma from './config/database.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { attacherWebSocket } from './ws.js';

// Import des routes
import authRoutes from './routes/auth.js';
import programRoutes from './routes/programs.js';
import sessionRoutes from './routes/sessions.js';
import mealRoutes from './routes/meals.js';
import statRoutes from './routes/stats.js';
import messageRoutes from './routes/messages.js';
import clientRoutes from './routes/clients.js';
import goalRoutes from './routes/goals.js';
import templateRoutes from './routes/templates.js';
import analyticsRoutes from './routes/analytics.js';
import coachesRoutes from './routes/coaches.js';
import requestRoutes from './routes/requests.js';
import setCompletionRoutes from './routes/setCompletions.js';
import clientCoachRoutes from './routes/clientCoach.js';
import foodRoutes from './routes/food.js';
import exerciseRefRoutes from './routes/exerciseRefs.js';
import appointmentRoutes from './routes/appointments.js';
import availabilityRoutes from './routes/availability.js';
import gymRoutes from './routes/gyms.js';
import notificationRoutes from './routes/notifications.js';
import sessionTemplateRoutes from './routes/sessionTemplates.js';
import nutritionRoutes from './routes/nutrition.js';
import reportRoutes from './routes/reports.js';
import appealRoutes from './routes/appeals.js';
import adminRoutes from './routes/admin.js';
import './jobs/appointmentReminders.js';
import './jobs/moderationJobs.js';

const app = express();

// Derrière le proxy de Fly.io : sans cela, req.ip vaut l'adresse du proxy et le
// limiteur de débit compterait tous les visiteurs comme un seul client.
if (config.isProduction) app.set('trust proxy', 1);

// En-têtes de sécurité. crossOriginResourcePolicy est désactivé car /uploads sert
// des images consommées depuis une autre origine (le dashboard).
app.use(helmet({ crossOriginResourcePolicy: false }));

// Compression des réponses. Les charges utiles de l'API sont du JSON très répétitif
// (listes de séances, d'exercices, de messages) : gzip y gagne beaucoup, pour un coût
// CPU négligeable. Posé avant les routes pour couvrir toutes les réponses.
app.use(compression());

// Middlewares globaux
app.use(cors({
  origin: config.nodeEnv === 'development' ? '*' : config.cors.origin,
  credentials: config.nodeEnv !== 'development',
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques (uploads)
app.use('/uploads', express.static('uploads'));

// Limiteur général. Le limiteur strict d'authentification est posé route par route
// dans routes/auth.js, sur /login et /register uniquement.
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
// Modération. /api/appeals reste joignable par un compte suspendu : son middleware
// d'authentification ne contrôle pas le statut (cf. middlewares/auth.js).
app.use('/api/reports', reportRoutes);
app.use('/api/appeals', appealRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/stats', statRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/coaches', coachesRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/set-completions', setCompletionRoutes);
app.use('/api/client-coaches', clientCoachRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/exercise-refs', exerciseRefRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/gyms', gymRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/session-templates', sessionTemplateRoutes);
app.use('/api/nutrition', nutritionRoutes);

// Route de test
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    // `env` est exposé pour que la suite de tests puisse REFUSER de tourner contre
    // une instance de développement. Les tests créent de vrais comptes : sans ce
    // garde-fou, ils polluaient la base de dev (plus de 160 comptes @test.com y
    // avaient été semés). Ce n'est pas une information sensible : elle ne révèle
    // ni version, ni dépendance, ni configuration.
    env: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// Gestion des routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

// Démarrage du serveur
const PORT = config.port;

// `app.listen` rend le serveur HTTP sous-jacent : c'est lui qu'écoute le WebSocket, sur
// le même port. Aucun port supplémentaire à ouvrir côté Fly, et `force_https` donne wss://.
const httpServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════╗
║   🏋️  Coaching App API Server        ║
╚═══════════════════════════════════════╝

🚀 Server running on port ${PORT}
🌍 Environment: ${config.nodeEnv}
📡 API URL: http://localhost:${PORT}/api
🔗 Health check: http://localhost:${PORT}/api/health

Press CTRL+C to stop
  `);
});

attacherWebSocket(httpServer);

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n👋 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
