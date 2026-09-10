import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

/**
 * Récupère une variable obligatoire en production.
 * Hors production, on tolère un repli pour ne pas bloquer le développement local,
 * mais on le signale : c'est ainsi qu'un secret par défaut se retrouve déployé.
 */
const required = (name, devFallback) => {
  const value = process.env[name];
  if (value) return value;

  if (isProduction) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
      `Le démarrage est interrompu volontairement — un repli en production exposerait ` +
      `l'application (voir .env.example).`
    );
  }
  console.warn(`⚠️  ${name} absent : repli de développement utilisé.`);
  return devFallback;
};

export const config = {
  port: process.env.PORT || 5001,
  nodeEnv,
  isProduction,
  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/coaching_app'),

  jwt: {
    // Aucun repli en production : un secret connu permet de forger n'importe quel token.
    secret: required('JWT_SECRET', 'dev-only-secret-not-for-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5 Mo par défaut
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    // "local" (disque du serveur) ou "supabase" (bucket Storage)
    driver: process.env.STORAGE_DRIVER || 'local',
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    bucket: process.env.SUPABASE_BUCKET || 'uploads',
  },

  cors: {
    // Plusieurs origines séparées par des virgules. Un déploiement en a rarement une
    // seule : le domaine définitif, l'URL de repli de l'hébergeur, et éventuellement
    // une préproduction. Les déclarer toutes évite de bloquer le dashboard au moindre
    // changement d'adresse — sans pour autant ouvrir le CORS à tout le monde.
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
};

// Un stockage sur disque local perd les fichiers à chaque déploiement sur un
// hébergeur à système de fichiers éphémère. On refuse de démarrer dans ce cas.
if (isProduction && config.upload.driver === 'local') {
  console.warn(
    "⚠️  STORAGE_DRIVER=local en production : les fichiers uploadés seront perdus " +
    "au prochain déploiement si l'hébergeur n'offre pas de disque persistant."
  );
}
