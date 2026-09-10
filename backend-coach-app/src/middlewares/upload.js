import multer from 'multer';
import path from 'path';
import { config } from '../config/env.js';
import { randomUUID } from 'crypto';

// Stockage en mémoire, et non sur disque : c'est src/services/fileStorage.js qui décide
// ensuite de la destination réelle — disque local en développement, bucket objet en
// production. Écrire d'abord sur disque pour re-lire et ré-envoyer serait un aller-retour
// inutile, et laisserait des fichiers orphelins si le dépôt distant échouait.
// La limite de taille (5 Mo par défaut) borne ce qui transite en mémoire.
const storage = multer.memoryStorage();

/**
 * Nomme le fichier avant qu'il ne soit stocké.
 *
 * Le bucket est public et /uploads est servi sans authentification : les balises <img> du
 * dashboard et du mobile ne peuvent pas porter d'en-tête Authorization. Le nom du fichier
 * est donc le seul secret qui protège la ressource, et il doit être imprévisible.
 * Math.random() ne convient pas — il n'est pas cryptographique et sa sortie est
 * prédictible à partir de quelques tirages. randomUUID() l'est.
 *
 * memoryStorage ne renseignant pas `filename`, on le pose ici pour que fileStorage.js
 * puisse s'en servir quel que soit le pilote.
 */
const nommer = (req, res, next) => {
  const baptiser = (file) => {
    file.filename = `${file.fieldname}-${randomUUID()}${path.extname(file.originalname)}`;
  };

  if (req.file) baptiser(req.file);
  if (Array.isArray(req.files)) req.files.forEach(baptiser);

  next();
};

// Filtre pour les types de fichiers
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only images and videos are allowed'));
  }
};

const multerInstance = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: fileFilter,
});

/**
 * `upload.single(champ)` renvoie la paire [réception, nommage] plutôt qu'un middleware
 * seul. Express accepte un tableau de middlewares, ce qui permet de garder les routes
 * inchangées tout en garantissant qu'aucun fichier ne parvienne aux controllers sans nom.
 */
export const upload = {
  single: (champ) => [multerInstance.single(champ), nommer],
  array: (champ, max) => [multerInstance.array(champ, max), nommer],
};

// Middleware pour gérer les erreurs d'upload
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};
