/**
 * Utilitaires partagés pour les tests d'intégration
 */

// Les tests d'intégration créent de vrais comptes en base. TEST_API_URL les dirige
// vers une instance dédiée (base coaching_app_test) plutôt que le serveur de dev.
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5001/api';

/**
 * GARDE-FOU : refuse de tourner contre une instance qui n'est pas en mode test.
 *
 * Les tests s'inscrivent, créent des programmes, des séances, des messages. Lancés
 * par mégarde contre le serveur de développement — ce que faisait `npm test` sans
 * TEST_API_URL — ils sèment des dizaines de comptes @test.com dans la base de
 * travail. Plus de 160 y avaient été trouvés.
 *
 * La vérification est faite ICI, au chargement du module, donc AVANT la moindre
 * écriture : ce fichier est importé par toutes les suites. Un `await` de premier
 * niveau suffit à faire échouer le fichier de test avant son premier `test()`.
 *
 * Conséquence voulue : `node --test __tests__/auth.test.js` échoue tout seul. Il
 * faut passer par `npm test`, qui monte la base et le serveur dédiés.
 */
async function assertTestInstance() {
  const healthUrl = `${BASE_URL.replace(/\/$/, '')}/health`;
  let payload;
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(4000) });
    payload = await res.json();
  } catch (err) {
    throw new Error(
      `Aucune API joignable sur ${healthUrl} (${err.message}).\n` +
      `→ Lancez « npm test », qui démarre une base et un serveur de test dédiés.`,
    );
  }

  if (payload?.env !== 'test') {
    throw new Error(
      `REFUS : l'API de ${BASE_URL} tourne en NODE_ENV=${payload?.env ?? 'inconnu'}, pas « test ».\n` +
      `Les tests créent de vrais comptes et pollueraient cette base.\n` +
      `→ Lancez « npm test » (base et serveur isolés), ou exportez TEST_API_URL\n` +
      `  vers une instance démarrée avec NODE_ENV=test.`,
    );
  }
}

await assertTestInstance();

/**
 * Génère un suffixe unique basé sur timestamp + aléatoire pour éviter les collisions
 */
export function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/**
 * Requête API avec gestion automatique des erreurs
 */
export async function apiRequest(method, path, body = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, options);
  const json = await res.json();
  return { status: res.status, body: json };
}

/**
 * Créer un utilisateur via l'API d'enregistrement
 */
export async function createUser(role, suffix = null) {
  const s = suffix ?? uniqueSuffix();
  const email = `${role.toLowerCase()}_${s}@test.com`;
  const data = {
    email,
    password: 'password123',
    firstName: role === 'COACH' ? 'Coach' : 'Client',
    lastName: `Test_${s}`,
    role,
  };
  const { status, body } = await apiRequest('POST', '/auth/register', data);
  if (!body.success) throw new Error(`createUser failed: ${JSON.stringify(body)}`);
  return { user: body.data.user, token: body.data.token, email, password: 'password123' };
}

/**
 * Login et retourner le token
 */
export async function loginUser(email, password) {
  const { body } = await apiRequest('POST', '/auth/login', { email, password });
  if (!body.success) throw new Error(`loginUser failed: ${JSON.stringify(body)}`);
  return body.data.token;
}

/**
 * Récupérer le profil /auth/me avec le token
 */
export async function getMe(token) {
  const { body } = await apiRequest('GET', '/auth/me', null, token);
  if (!body.success) throw new Error(`getMe failed: ${JSON.stringify(body)}`);
  return body.data;
}

/**
 * Créer un lien coach-client via la table ClientCoach (M2M)
 * Retourne la relation créée
 */
export async function linkCoachClient(coachToken, clientProfileId, coachProfileId) {
  const { body } = await apiRequest(
    'POST',
    '/client-coaches',
    { clientId: clientProfileId, coachId: coachProfileId, isPrimary: true },
    coachToken
  );
  if (!body.success) throw new Error(`linkCoachClient failed: ${JSON.stringify(body)}`);
  return body.data;
}

/**
 * Créer un programme pour un client
 */
export async function createProgram(coachToken, clientProfileId, suffix = null) {
  const s = suffix ?? uniqueSuffix();
  const { body } = await apiRequest(
    'POST',
    '/programs',
    {
      clientId: clientProfileId,
      title: `Programme Test ${s}`,
      description: 'Description test',
      startDate: new Date().toISOString(),
    },
    coachToken
  );
  if (!body.success) throw new Error(`createProgram failed: ${JSON.stringify(body)}`);
  return body.data;
}

/**
 * Créer une séance pour un programme
 */
export async function createSession(coachToken, programId, date, exercises = []) {
  const { body } = await apiRequest(
    'POST',
    '/sessions',
    { programId, date, exercises },
    coachToken
  );
  if (!body.success) throw new Error(`createSession failed: ${JSON.stringify(body)}`);
  return body.data;
}

/**
 * Retourne la date du jour au format YYYY-MM-DD (heure locale)
 */
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Retourne une date relative (aujourd'hui + offsetDays) au format YYYY-MM-DD
 */
export function dateOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
