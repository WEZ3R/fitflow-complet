"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Une erreur est survenue</h2>
        <p className="text-gray-600 mb-6">{error.message || "Quelque chose s'est mal passé."}</p>
        <Button onClick={reset}>Réessayer</Button>
      </div>
    </div>
  );
}
