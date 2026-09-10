"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import SessionEditor from "../_components/session-editor";

function NewSessionContent() {
  const params = useParams<{ programId: string }>();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? undefined;

  return <SessionEditor programId={params.programId} initialDate={date} />;
}

export default function NewSessionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>}>
      <NewSessionContent />
    </Suspense>
  );
}
