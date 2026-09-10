import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permet de compiler dans un dossier séparé pour vérifier un build sans écraser
  // le .next d'un serveur de développement en cours d'exécution — sinon le dev
  // server sert des artefacts à moitié réécrits et n'affiche plus les changements.
  //   NEXT_DIST_DIR=.next-verify npm run build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: [],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5001/api/:path*",
      },
      {
        // Les fichiers uploadés sont servis par le backend. Sans cette réécriture,
        // une URL relative « /uploads/photo.jpg » est demandée au serveur Next, qui
        // répond 404 — la photo de profil apparaissait cassée. Passer par le même
        // domaine évite en plus toute question de CORS ou de politique de ressources
        // cross-origin sur les images.
        source: "/uploads/:path*",
        destination: "http://localhost:5001/uploads/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "5001",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
