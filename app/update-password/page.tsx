"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Loading component for Suspense fallback
function UpdatePasswordLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F5F5] via-white to-white">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#0F0F0F]" />
        <p className="text-lg font-medium">Chargement...</p>
      </div>
    </div>
  );
}

// Main content component that uses useSearchParams
function UpdatePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const supabase = createClient();

  // Vérifier la session et traiter les tokens de l'URL
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const handleAuthCallback = async () => {
      try {
        // Nettoyer le cookie de récupération s'il existe
        if (typeof window !== 'undefined') {
          document.cookie = 'sb-password-recovery=; path=/; max-age=0';
        }

        // Vérifier s'il y a un hash dans l'URL (token de récupération - flux implicite)
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          
          // Si on a un hash avec access_token (lien de réinitialisation via flux implicite)
          if (hash && hash.includes('access_token')) {
            // Supabase gère automatiquement le hash et crée une session
            // Attendre que Supabase traite le token
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Vérifier s'il y a une erreur dans l'URL
          const errorParam = searchParams.get('error');
          const errorDescription = searchParams.get('error_description');
          if (errorParam) {
            if (mounted) {
              setErrorMessage(errorDescription || 'Lien invalide ou expiré');
              setIsValidSession(false);
            }
            return;
          }
        }

        // Écouter les changements d'auth — PASSWORD_RECOVERY / SIGNED_IN /
        // INITIAL_SESSION valident la session. Pas de boucle de retry getUser() :
        // onAuthStateChange est la source de vérité du flux implicite.
        const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(async (event, sess) => {
          if (!mounted) return;
          if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && sess?.user)) {
            setIsValidSession(true);
          }
        });
        subscription = sub;

        // 1 seul getUser() pour valider le token côté serveur.
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!mounted) return;

        if (user) {
          setIsValidSession(true);
          return;
        }

        // Sinon laisser ≤3s à onAuthStateChange pour fire PASSWORD_RECOVERY
        // (cas du flux implicite : le hash met un instant à être consommé).
        setTimeout(() => {
          if (!mounted) return;
          setIsValidSession((prev) => {
            if (prev !== null) return prev;
            setErrorMessage(error?.message || 'Session non trouvée. Le lien a peut-être expiré.');
            return false;
          });
        }, 3000);
      } catch (err) {
        console.error('Auth callback error:', err);
        if (mounted) {
          setErrorMessage('Une erreur est survenue');
          setIsValidSession(false);
        }
      }
    };

    handleAuthCallback();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [supabase.auth, searchParams]);

  const passwordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    return strength;
  };

  const getStrengthLabel = (strength: number) => {
    if (strength <= 1) return { label: "Faible", color: "bg-red-500" };
    if (strength <= 2) return { label: "Moyen", color: "bg-orange-500" };
    if (strength <= 3) return { label: "Bon", color: "bg-yellow-500" };
    if (strength <= 4) return { label: "Fort", color: "bg-green-500" };
    return { label: "Très fort", color: "bg-emerald-500" };
  };

  const strength = passwordStrength(password);
  const strengthInfo = getStrengthLabel(strength);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Erreur", {
        description: "Les mots de passe ne correspondent pas",
      });
      return;
    }

    if (password.length < 8) {
      toast.error("Erreur", {
        description: "Le mot de passe doit contenir au moins 8 caractères",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error("Erreur", {
          description: error.message,
        });
      } else {
        setIsSuccess(true);
        toast.success("Mot de passe mis à jour", {
          description: "Votre mot de passe a été modifié avec succès.",
        });
        
        // Rediriger vers le dashboard après 2 secondes
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      }
    } catch (error) {
      toast.error("Une erreur est survenue", {
        description: "Veuillez réessayer plus tard",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Afficher un loader pendant la vérification de session
  if (isValidSession === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F5F5] via-white to-white">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#0F0F0F]" />
          <p className="text-lg font-medium">Vérification...</p>
        </div>
      </div>
    );
  }

  // Session invalide - lien expiré ou accès direct
  if (!isValidSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F5F5] via-white to-white p-4">
        <Card className="max-w-md w-full shadow-xl border-2">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Lock className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-xl font-bold text-[#0F0F0F]">
              Lien expiré ou invalide
            </CardTitle>
            <CardDescription className="text-base">
              {errorMessage || "Le lien de réinitialisation a expiré ou n'est pas valide."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Veuillez demander un nouveau lien de réinitialisation.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full bg-[#F2B33D] hover:bg-[#F2B33D]">
                <Link href="/forgot-password">
                  Demander un nouveau lien
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour à la connexion
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Succès
  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F5F5] via-white to-white p-4">
        <Card className="max-w-md w-full shadow-xl border-2">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-xl font-bold text-[#0F0F0F]">
              Mot de passe mis à jour !
            </CardTitle>
            <CardDescription className="text-base">
              Votre mot de passe a été modifié avec succès.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Vous allez être redirigé vers votre tableau de bord...
            </p>
            <Button asChild className="w-full">
              <Link href="/dashboard">
                Aller au tableau de bord
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Formulaire de réinitialisation
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="mb-8">
            <Link
              href="/login"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </Link>
          </div>

          <div className="mb-8 animate-fade-in-up">
            <Link href="/" className="group inline-flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 blur transition-opacity duration-300 group-hover:opacity-100" />
                <img
                  src="/logo.png"
                  alt="Laveiye"
                  className="relative"
                />
              </div>
              <span className="font-sans text-xl font-bold text-foreground">
                Laveiye
              </span>
            </Link>
          </div>

          <div>
            <h1 className="font-sans text-2xl font-bold text-foreground">
              Nouveau mot de passe
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choisissez un nouveau mot de passe sécurisé pour votre compte.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Nouveau mot de passe
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              
              {/* Indicateur de force du mot de passe */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          level <= strength ? strengthInfo.color : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Force : <span className="font-medium">{strengthInfo.label}</span>
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirmer le mot de passe
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 pl-10 pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              
              {/* Indicateur de correspondance */}
              {confirmPassword && (
                <p className={`text-xs mt-1 ${
                  password === confirmPassword ? "text-green-600" : "text-red-500"
                }`}>
                  {password === confirmPassword
                    ? "✓ Les mots de passe correspondent"
                    : "✗ Les mots de passe ne correspondent pas"}
                </p>
              )}
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Le mot de passe doit contenir :</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li className={password.length >= 8 ? "text-green-600" : ""}>
                  Au moins 8 caractères
                </li>
                <li className={/[A-Z]/.test(password) ? "text-green-600" : ""}>
                  Une lettre majuscule
                </li>
                <li className={/[a-z]/.test(password) ? "text-green-600" : ""}>
                  Une lettre minuscule
                </li>
                <li className={/[0-9]/.test(password) ? "text-green-600" : ""}>
                  Un chiffre
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-[#F2B33D] hover:bg-[#F2B33D] font-semibold"
              disabled={isLoading || password !== confirmPassword || password.length < 8}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                "Mettre à jour le mot de passe"
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Panneau décoratif côté droit */}
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 bg-[#F2B33D]">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="max-w-lg text-center text-white">
              <Lock className="mx-auto h-16 w-16 mb-6 opacity-90" />
              <h2 className="text-3xl font-bold mb-4">
                Sécurisez votre compte
              </h2>
              <p className="text-lg text-white/80">
                Choisissez un mot de passe fort et unique pour protéger votre accès 
                à la bibliothèque créative Laveiye.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<UpdatePasswordLoading />}>
      <UpdatePasswordContent />
    </Suspense>
  );
}
