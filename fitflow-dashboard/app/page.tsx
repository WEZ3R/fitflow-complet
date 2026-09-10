"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
    } else if (user.role === "ADMIN") {
      // Un administrateur n'a ni profil coach ni profil client : il n'a donc pas
      // d'onboarding à passer, et son point d'entrée est la file de modération.
      router.push("/admin/reports");
    } else if (user.role === "COACH") {
      const onboarded = user.coachProfile?.onboardingCompletedAt;
      router.push(onboarded ? "/coach/dashboard" : "/coach/onboarding");
    } else {
      const onboarded = user.clientProfile?.onboardingCompletedAt;
      router.push(onboarded ? "/client/dashboard" : "/client/onboarding");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
    </div>
  );
}
