FROM node:22-alpine

# openssl est requis par le moteur de requêtes Prisma.
# python3/make/g++ servent de filet : si node-gyp-build ne trouve pas de binaire
# précompilé correspondant à la plateforme, il compile bcrypt depuis les sources.
RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

COPY package*.json ./

# --omit=dev, et non --only=production qui est déprécié.
# `prisma` est en dependencies : le CLI est donc présent ici pour `generate`, et
# à l'exécution pour `migrate deploy`. Avec --only=production il était absent et
# npx allait le télécharger pendant le build, au risque d'une autre version.
RUN npm ci --omit=dev

# Le schéma est copié avant le reste : la couche de génération du client Prisma
# n'est ainsi invalidée que quand le schéma change, pas à chaque modification de code.
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 5001

CMD ["node", "src/server.js"]
