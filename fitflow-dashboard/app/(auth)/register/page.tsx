"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phone: "",
    role: "CLIENT",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { register } = useAuth();
  const router = useRouter();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (formData.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setLoading(true);
    const { confirmPassword, ...registerData } = formData;
    const result = await register({ ...registerData, phone: registerData.phone || undefined });

    if (result.success) {
      // Rediriger vers l'onboarding selon le rôle
      if (formData.role === "CLIENT") {
        router.push("/client/onboarding");
      } else {
        router.push("/coach/onboarding");
      }
    } else {
      setError(result.error || "Erreur lors de l'inscription");
    }

    setLoading(false);
  };

  return (
    <div data-surface="auth" className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/logo-vert-256.png" alt="FitFlow Logo" className="h-16 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Inscription</h1>
          <p className="text-gray-600 mt-2">Rejoignez FitFlow</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Switch Client / Coach */}
          <div className="flex rounded-lg bg-gray-100 p-1">
            {(["CLIENT", "COACH"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setFormData({ ...formData, role: r })}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  formData.role === r
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {r === "CLIENT" ? "Je recherche un coach" : "Je suis coach"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Prénom" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="Jean" required />
            <Input label="Nom" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Dupont" required />
          </div>

          <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="votre@email.com" required />

          <Input label="Téléphone (facultatif)" type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+33 6 00 00 00 00" />

          <Input label="Mot de passe" type="password" name="password" value={formData.password} onChange={handleChange} placeholder="6 caractères minimum" required />

          <Input label="Confirmer le mot de passe" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Répéter le mot de passe" required />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Inscription..." : "Créer mon compte"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Se connecter
          </Link>
        </div>
      </Card>
    </div>
  );
}
