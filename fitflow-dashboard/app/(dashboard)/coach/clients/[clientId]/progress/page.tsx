'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import ClientProgressPanel from '@/components/clients/client-progress-panel';

/**
 * Page Progression autonome.
 *
 * Le contenu vit dans ClientProgressPanel, aussi monté dans un onglet de la fiche
 * client. Cette page est conservée pour que les liens existants continuent de
 * fonctionner.
 */
export default function ClientProgressPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Progression</h1>
      </div>

      <ClientProgressPanel clientId={clientId} />
    </div>
  );
}
