"use client";

import { useParams } from "next/navigation";
import SessionEditor from "../../_components/session-editor";

export default function EditSessionPage() {
  const params = useParams<{ programId: string; sessionId: string }>();

  return <SessionEditor programId={params.programId} sessionId={params.sessionId} />;
}
