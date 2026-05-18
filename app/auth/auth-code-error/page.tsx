"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase";

function AuthCodeErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const errorDescription = searchParams.get("error_description");

  const errorCode = searchParams.get("error_code");

  // Récupération du flux "implicit grant" : Supabase peut livrer la session
  // dans le hash fragment (#access_token=...&refresh_token=...) au lieu d'un
  // code PKCE en query. Le serveur ne voit pas le hash → on a atterri ici.
  // On hydrate la session côté client puis on redirige vers /dashboard.
  const [recovering, setRecovering] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  // Erreur Supabase dans hash fragment (#error=...&error_code=otp_expired&...)
  // useSearchParams ne lit que la query string, donc on parse window.location.hash.
  const [hashErrorCode, setHashErrorCode] = useState<string | null>(null);
  const [hashErrorDescription, setHashErrorDescription] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (!hash || !hash.startsWith("#")) return;
    const params = new URLSearchParams(hash.slice(1));
    if (params.get("error")) {
      setHashErrorCode(params.get("error_code"));
      setHashErrorDescription(params.get("error_description"));
    }
  }, []);

  // Si l'utilisateur est déjà connecté (cookie/session valides), on saute
  // l'écran d'erreur et on redirige vers /dashboard. Couvre le cas du double
  // clic sur un lien : le 1er clic a déjà créé la session, le 2e atterrit ici.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then((res: any) => {
        if (cancelled) return;
        const u = res?.data?.user;
        if (u) {
          window.history.replaceState(null, "", window.location.pathname);
          router.replace("/dashboard");
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (!hash || !hash.includes("access_token=")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;

    setRecovering(true);

    // Pose les cookies de session côté serveur via /api/auth/hydrate.
    // Évite le SDK Supabase côté client (qui peut hang sur navigator.locks
    // conflict avec onAuthStateChange dans AuthProvider).
    fetch("/api/auth/hydrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token, refresh_token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("[auth-code-error] hydrate a échoué", err);
          setRecovering(false);
          return;
        }
        window.location.href = "/dashboard";
      })
      .catch((e: unknown) => {
        console.error("[auth-code-error] exception hydrate", e);
        setRecovering(false);
      });
  }, [router]);

  const getMessage = () => {
    const code = hashErrorCode || errorCode;
    const desc = hashErrorDescription || errorDescription;
    if (code === "otp_expired") {
      return "Le lien a expiré ou a déjà été utilisé. Renvoie un nouvel email de vérification ci-dessous.";
    }
    if (code === "access_denied") {
      return "L'accès a été refusé. Le lien est invalide ou a été révoqué.";
    }
    if (desc) return decodeURIComponent(desc.replace(/\+/g, " "));
    if (reason === "missing_code") return "Le code d'authentification est manquant dans l'URL.";
    if (reason === "exchange_failed") return "L'échange du code d'authentification a échoué.";
    return "Le lien d'authentification n'est pas valide ou a expiré.";
  };

  if (checkingSession || recovering) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F5F5] via-white to-white p-4">
        <Card className="max-w-md w-full shadow-xl border-2">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-bold text-[#0F0F0F]">
              Connexion en cours…
            </CardTitle>
            <CardDescription>Finalisation de votre vérification.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F5F5] via-white to-white p-4">
      <Card className="max-w-md w-full shadow-xl border-2">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-xl font-bold text-[#0F0F0F]">
            Erreur d&apos;authentification
          </CardTitle>
          <CardDescription className="text-base">
            {getMessage()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <h3 className="font-semibold text-sm text-amber-900 mb-2">
              Causes possibles :
            </h3>
            <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
              <li>Le lien a expiré (valide 1 heure)</li>
              <li>Le lien a déjà été utilisé</li>
              <li>Le lien est incorrect ou incomplet</li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Renvoyer l'email de vérification (inscription)
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!resendEmail) return
                setResendLoading(true)
                try {
                  const supabase = createClient()
                  const { error } = await supabase.auth.resend({
                    type: "signup",
                    email: resendEmail,
                    options: {
                      emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
                    },
                  })
                  if (error) {
                    setResendMsg(`Erreur : ${error.message}`)
                  } else {
                    setResendMsg("Email envoyé. Vérifie aussi tes spams.")
                  }
                } finally {
                  setResendLoading(false)
                }
              }}
              className="flex flex-col gap-2"
            >
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="ton@email.com"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
              <Button type="submit" className="w-full" disabled={resendLoading || !resendEmail}>
                <Mail className="mr-2 h-4 w-4" />
                {resendLoading ? "Envoi…" : "Renvoyer l'email de vérification"}
              </Button>
              {resendMsg && (
                <p className="text-xs text-center text-muted-foreground">{resendMsg}</p>
              )}
            </form>

            <div className="flex flex-col gap-2 pt-2 border-t">
              <Button variant="outline" asChild className="w-full">
                <Link href="/forgot-password">
                  Mot de passe oublié
                </Link>
              </Button>
              <Button variant="ghost" asChild className="w-full">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour à la connexion
                </Link>
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Si le problème persiste, contactez le support à{" "}
              <a href="mailto:contacts@bigfiveabidjan.com" className="text-primary hover:underline">
                contacts@bigfiveabidjan.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthCodeErrorContent />
    </Suspense>
  );
}
