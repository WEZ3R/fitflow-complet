/**
 * Stockage des fichiers déposés — deux implémentations derrière une seule fonction.
 *
 * Pourquoi cette indirection : en développement, écrire sur le disque est le plus simple
 * et ne demande aucun compte. En production sur un hébergeur à système de fichiers
 * éphémère (Fly.io), le disque est réinitialisé à chaque déploiement : une photo de profil
 * déposée le lundi aurait disparu le mardi. Les deux environnements ont donc besoin de
 * comportements différents, mais les controllers ne doivent pas en connaître le détail.
 *
 * Le pilote se choisit par la variable STORAGE_DRIVER ("local" par défaut, "supabase" en
 * production). Les controllers appellent saveUpload() et reçoivent une URL, sans savoir
 * laquelle des deux voies a été empruntée.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../uploads');

/** Client Supabase, construit une seule fois et seulement si le pilote est actif. */
let supabase = null;
const getSupabase = () => {
  if (!supabase) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error(
        "STORAGE_DRIVER=supabase mais SUPABASE_URL ou SUPABASE_SERVICE_KEY est absent."
      );
    }
    // La clé de service contourne les règles d'accès du bucket : elle ne doit jamais
    // quitter le serveur. C'est aussi pourquoi l'upload transite par l'API et non
    // directement depuis le navigateur.
    supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false },
    });
  }
  return supabase;
};

/**
 * Persiste un fichier reçu par multer (en mémoire) et renvoie l'URL publique à stocker
 * en base.
 *
 * @param {{originalname: string, mimetype: string, buffer: Buffer, filename?: string}} file
 * @returns {Promise<string|null>} URL du fichier, ou null si aucun fichier fourni
 */
export const saveUpload = async (file) => {
  if (!file) return null;

  // multer.memoryStorage ne nomme pas les fichiers : c'est upload.js qui pose le nom
  // imprévisible sur file.filename (voir le commentaire sur randomUUID là-bas).
  const filename = file.filename;
  if (!filename) throw new Error('Nom de fichier manquant : upload.js doit le renseigner.');

  if (config.upload.driver === 'supabase') {
    const { error } = await getSupabase()
      .storage
      .from(config.supabase.bucket)
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        // Les noms étant uniques, un conflit signalerait une anomalie : on ne l'écrase pas.
        upsert: false,
      });

    if (error) throw new Error(`Dépôt du fichier échoué : ${error.message}`);

    const { data } = getSupabase()
      .storage
      .from(config.supabase.bucket)
      .getPublicUrl(filename);

    return data.publicUrl;
  }

  // Pilote local : le dossier peut ne pas exister au premier démarrage.
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), file.buffer);

  // URL relative : le client la préfixe avec l'origine de l'API.
  return `/uploads/${filename}`;
};
