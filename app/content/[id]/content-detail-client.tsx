"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Heart,
  Share2,
  ExternalLink,
  Building2,
  Tag,
  Globe,
  Video,
  Loader2,
  Play,
  Pencil,
  Mail,
  Monitor,
  Lock,
  ArrowRight,
  Eye,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { useAuth } from "@/hooks/use-auth";
import { useAuthContext } from "@/components/auth-provider";
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase";
import { ImageGallery } from "@/components/ui/lightbox";
import { getCreativeByIdOrSlug, getRelatedCampaigns } from "@/app/actions/creative";
import { useFavorites } from "@/hooks/use-favorites";
import { cn, getGoogleDriveImageUrl, fixBrokenEncoding } from "@/lib/utils";
import { detectVideoPlatform, getEmbedUrl, getVideoPlatformLabel, getOriginalVideoUrl } from "@/lib/video-utils";
import { isPaidPlan, canAccessPremiumContent } from "@/lib/pricing";
import { useRequireActiveSubscription } from "@/hooks/use-require-active-subscription";
import { UpgradePopup } from "@/components/upgrade-popup";
import { ReactionButtons } from "@/components/ui/reaction-buttons";
import { AddToCollectionModal } from "@/components/collections/add-to-collection-modal";
import { ConsultationBottomSheet } from "@/components/consultation-bottom-sheet";
import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const SwipeableCarousel = dynamic(() => import("@/components/ui/swipeable-carousel").then(m => m.SwipeableCarousel), { ssr: false });

const MONTHLY_CLICK_LIMIT = 10;

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  video_url: string | null;
  platforms: string[] | null;
  category: string | null;
  tags: string[] | null;
  status: string | null;
  access_level?: string | null;
  brand?: string | null;
  agency?: string | null;
  country?: string | null;
  format?: string | null;
  date?: string | null;
  year?: number | null;
  images?: string[] | null;
  analyse?: string | null;
  how_to_use?: string | null;
  summary?: string | null;
  slug?: string | null;
  axe?: string[] | null;
  created_at: string;
  publication_url?: string | null;
}

/**
 * Formate le texte de description en HTML.
 * - Si c'est déjà du HTML (contient des balises), le retourne tel quel
 * - Sinon, convertit les retours à la ligne en <br>, **bold** en <strong>, etc.
 */
function formatDescription(text: string): string {
  // Si c'est déjà du HTML (contient des balises), sanitize et retourne.
  // ATTENTION : ne JAMAIS retourner le HTML brut sans sanitize — le
  // contenu provient de la table campaigns (écrite par les admins) mais
  // un admin compromis ou un import non vérifié pourrait injecter du JS
  // qui s'exécuterait sur la page consultée par tous les utilisateurs.
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return sanitizeHtml(text);
  }

  let html = text
    // Échapper les caractères HTML dangereux
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // **bold** → <strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // *italic* → <em>
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Les lignes vides → paragraphes
    .replace(/\n\s*\n/g, '</p><p>')
    // Les retours à la ligne simples → <br>
    .replace(/\n/g, '<br/>')

  return `<p>${html}</p>`;
}

function stripMarkup(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

export default function ContentDetailClient({ id }: { id: string }) {
  // Force le choix d'un plan : redirige vers /subscribe?required=1
  // si l'utilisateur n'a pas d'abonnement actif.
  const { checking: subChecking, locked: subLocked } = useRequireActiveSubscription();

  const [content, setContent] = useState<Campaign | null>(null);
  const [relatedContent, setRelatedContent] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isFavorite, toggleFavorite, isAuthenticated } = useFavorites();
  const { isAdmin } = useAuth();
  const { refreshClickCounters, userPlan: contextUserPlan } = useAuthContext();
  const [isToggling, setIsToggling] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"axe" | "utilisation">("axe");
  const articleRef = useRef<HTMLDivElement>(null);
  const [userPlan, setUserPlan] = useState("");
  const [monthlyClicks, setMonthlyClicks] = useState(0);
  const [monthlyExplored, setMonthlyExplored] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [bottomSheetRemaining, setBottomSheetRemaining] = useState(0);
  const trackedRef = useRef(false);
  const isFreeUser = !isPaidPlan(userPlan);
  // Gate Premium : seuls les abonnés Basic ou Pro (ou admins) peuvent voir une campagne premium.
  const isPremiumContent = (content?.access_level || '').toLowerCase() === 'premium';
  const canViewPremium = isAdmin || canAccessPremiumContent(contextUserPlan);
  const isPremiumLocked = isPremiumContent && !canViewPremium;
  const router = useRouter();

  // Vérifier l'état d'authentification directement
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setIsUserAuthenticated(!!user);
      } catch {
        setIsUserAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, []);

  // Tracker la consultation UNE FOIS le contenu chargé.
  // Le useRef + sessionStorage flag évitent les doublons (StrictMode dev,
  // Fast Refresh, navigation circulaire dans une fenêtre courte).
  useEffect(() => {
    if (!authChecked || !isUserAuthenticated) return;
    if (!content) return; // attendre que la campagne soit chargée
    if (isPremiumLocked) return; // pas de tracking pour un contenu verrouillé
    if (trackedRef.current) return;
    trackedRef.current = true;

    const trackConsultation = async () => {
      try {
        // Dédup courte fenêtre : si on a tracké ce même contenu très récemment
        // (ex. retour arrière, re-mount), ne pas re-POST.
        const trackedKey = `tracked-${id}`;
        let recentlyTracked = false;
        try {
          const ts = sessionStorage.getItem(trackedKey);
          if (ts) {
            const age = Date.now() - parseInt(ts, 10);
            if (age >= 0 && age < 30_000) recentlyTracked = true;
          }
        } catch { /* sessionStorage indisponible */ }

        if (recentlyTracked) {
          // Lire l'état pour l'affichage sans incrémenter
          const getRes = await fetch('/api/track-click');
          if (getRes.ok) {
            const getData = await getRes.json();
            setMonthlyClicks(getData.clicks || 0);
            setMonthlyExplored(getData.explored || 0);
            if (!getData.isFree) setUserPlan('Pro');
            if (getData.isFree && (getData.clicks || 0) >= MONTHLY_CLICK_LIMIT) {
              setIsBlocked(true);
              setShowUpgrade(true);
            }
            // Synchroniser le compteur global (navbar)
            refreshClickCounters().catch(() => {});
            // Afficher le bottom sheet informatif tant qu'il reste des consultations
            if (getData.isFree && getData.limit != null) {
              const remaining = Math.max(0, getData.limit - (getData.clicks || 0));
              setBottomSheetRemaining(remaining);
              setBottomSheetOpen(true);
              setTimeout(() => setBottomSheetOpen(false), 4000);
            }
          }
          return;
        }

        // Tracker le clic (POST). L'API renvoie 403 si limite déjà atteinte.
        const postRes = await fetch('/api/track-click', { method: 'POST' });
        const data = await postRes.json().catch(() => ({} as any));
        if (!postRes.ok || !data.allowed) {
          setIsBlocked(true);
          setShowUpgrade(true);
          if (data.clicks != null) setMonthlyClicks(data.clicks);
          return;
        }

        if (!data.isFree) setUserPlan('Pro');
        setMonthlyClicks(data.clicks || 0);
        if (data.explored != null) setMonthlyExplored(data.explored);

        // Mettre à jour le compteur global (navbar) après un clic tracké
        refreshClickCounters().catch(() => {});

        // Poser le flag pour la dédup courte fenêtre
        try {
          sessionStorage.setItem(trackedKey, Date.now().toString());
        } catch { /* ignore */ }

        // Bottom sheet : afficher le compteur de consultations restantes à chaque
        // consultation pour les utilisateurs gratuits (auto-fermeture après 4s).
        if (data.isFree && data.clicks != null && data.limit != null) {
          const remaining = Math.max(0, data.limit - data.clicks);
          setBottomSheetRemaining(remaining);
          setBottomSheetOpen(true);
          setTimeout(() => setBottomSheetOpen(false), 4000);
        }
      } catch { /* ignore */ }
    };
    trackConsultation();
  }, [authChecked, isUserAuthenticated, id, content, refreshClickCounters]);

  // Barre de progression de lecture
  useEffect(() => {
    const handleScroll = () => {
      const articleEl = articleRef.current;
      if (!articleEl) return;

      const rect = articleEl.getBoundingClientRect();
      const articleTop = rect.top + window.scrollY;
      const articleHeight = rect.height;
      const scrolled = window.scrollY - articleTop;
      const viewportHeight = window.innerHeight;
      const scrollableHeight = Math.max(1, articleHeight - viewportHeight);
      const progress = Math.min(100, Math.max(0, (scrolled / scrollableHeight) * 100));
      setReadProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [content]);

  useEffect(() => {
    const fetchContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Vérifier le cache sessionStorage
        const cacheKey = `campaign_${id}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
          try {
            const { campaign: cached, related: cachedRelated, timestamp } = JSON.parse(cachedData);
            // Cache valide pendant 5 minutes
            if (Date.now() - timestamp < 5 * 60 * 1000) {
              setContent(cached);
              setRelatedContent(cachedRelated || []);
              setIsLoading(false);
              return;
            }
          } catch { /* cache invalide, on continue */ }
        }

        // Utiliser la server action (service role, pas de RLS)
        const result = await getCreativeByIdOrSlug(id);

        if (!result.success || !result.data) {
          setError('Contenu non trouvé');
          setIsLoading(false);
          return;
        }

        const campaign = result.data;

        setContent({
          ...campaign,
          title: fixBrokenEncoding(campaign.title),
          description: fixBrokenEncoding(campaign.description),
          brand: fixBrokenEncoding(campaign.brand),
          agency: fixBrokenEncoding(campaign.agency),
          country: fixBrokenEncoding(campaign.country),
          category: fixBrokenEncoding(campaign.category),
        } as Campaign);

        // Récupérer les contenus similaires via server action
        const relatedResult = await getRelatedCampaigns(
          campaign.id,
          campaign.tags,
          campaign.category,
          campaign.brand
        );

        const related = (relatedResult.data || []).map((r: any) => ({
          ...r,
          title: fixBrokenEncoding(r.title),
          description: fixBrokenEncoding(r.description),
          brand: fixBrokenEncoding(r.brand),
          agency: fixBrokenEncoding(r.agency),
          country: fixBrokenEncoding(r.country),
          category: fixBrokenEncoding(r.category),
        }));

        setRelatedContent(related);

        // Sauvegarder en cache sessionStorage
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            campaign,
            related,
            timestamp: Date.now(),
          }));
        } catch { /* quota exceeded, ignore */ }
      } catch (err) {
        console.error('Error:', err);
        setError('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {isUserAuthenticated ? (
          <DashboardNavbar
            userPlan={userPlan}
            monthlyClicks={monthlyClicks}
            monthlyClickLimit={MONTHLY_CLICK_LIMIT}
            isFreeUser={isFreeUser}
            monthlyExplored={monthlyExplored}
            showSearch={false}
          />
        ) : (
          <Navbar />
        )}
        <main className="container mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 h-5 w-40 animate-pulse rounded-md bg-muted" />
          <div className="mb-8 space-y-3">
            <div className="h-9 w-full max-w-3xl animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_500px]">
            <div className="space-y-6">
              <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-muted" />
              <div className="rounded-xl border border-border p-6">
                <div className="mb-4 h-6 w-52 animate-pulse rounded-md bg-muted" />
                <div className="space-y-3">
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
              <div className="h-64 animate-pulse rounded-xl bg-muted" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Si l'utilisateur free a atteint sa limite, bloquer l'accès à la page
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNavbar
          userPlan={userPlan}
          monthlyClicks={monthlyClicks}
          monthlyClickLimit={MONTHLY_CLICK_LIMIT}
          isFreeUser={isFreeUser}
          monthlyExplored={monthlyExplored}
          showSearch={false}
        />
        <main className="container mx-auto px-4 py-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la bibliothèque
          </Link>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Vous avez atteint votre limite de {MONTHLY_CLICK_LIMIT} campagnes consultables ce mois.
              </p>
              <Button
                className="mt-4 bg-[#F2B33D] hover:bg-[#d99a2a] text-white"
                onClick={() => router.push('/subscribe')}
              >
                Passer à un plan payant
              </Button>
            </CardContent>
          </Card>
        </main>
        <UpgradePopup
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          reason="clicks"
        />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-background">
        {isUserAuthenticated ? (
          <DashboardNavbar
            userPlan={userPlan}
            monthlyClicks={monthlyClicks}
            monthlyClickLimit={MONTHLY_CLICK_LIMIT}
            isFreeUser={isFreeUser}
            monthlyExplored={monthlyExplored}
            showSearch={false}
          />
        ) : (
          <Navbar />
        )}
        <main className="container mx-auto px-4 py-8">
          <Link
            href={isUserAuthenticated ? "/dashboard" : "/"}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {isUserAuthenticated ? "Retour à la bibliothèque" : "Retour à l'accueil"}
          </Link>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">{error || 'Contenu non trouvé'}</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Gate Premium : campagne réservée aux abonnés Basic ou Pro.
  // Free et Basic sont bloqués avec un écran d'upsell.
  if (isPremiumLocked) {
    return (
      <div className="min-h-screen bg-background">
        {isUserAuthenticated ? (
          <DashboardNavbar
            userPlan={userPlan}
            monthlyClicks={monthlyClicks}
            monthlyClickLimit={MONTHLY_CLICK_LIMIT}
            isFreeUser={isFreeUser}
            monthlyExplored={monthlyExplored}
            showSearch={false}
          />
        ) : (
          <Navbar />
        )}
        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <Link
            href={isUserAuthenticated ? "/dashboard" : "/"}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {isUserAuthenticated ? "Retour à la bibliothèque" : "Retour à l'accueil"}
          </Link>
          <Card className="border-amber-300/60 shadow-lg shadow-amber-400/10">
            <CardContent className="p-8 sm:p-10 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                <Lock className="h-6 w-6 text-amber-600" />
              </div>
              <Badge className="mb-4 bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 border border-amber-300/60">
                Campagne Premium
              </Badge>
              <h1 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-bold text-[#0F0F0F] mb-3">
                Accessible avec Basic ou Pro
              </h1>
              <p className="text-[#0F0F0F]/70 text-sm sm:text-base mb-6 max-w-md mx-auto">
                Les campagnes Premium font partie de notre sélection exclusive.
                Passez en Basic ou Pro pour débloquer l'accès complet, l'analyse stratégique
                et tous les contenus réservés.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  className="h-11 px-6 bg-[#F2B33D] hover:bg-[#d99a2a] text-white font-semibold"
                  onClick={() => router.push('/subscribe?plan=basic')}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Passer en Basic
                </Button>
                <Button
                  variant="outline"
                  className="h-11 px-6 font-semibold"
                  onClick={() => router.push('/pricing')}
                >
                  Voir les plans
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Extraire les infos depuis les champs. Les champs absents sont masques
  // plutot qu'affiches en "N/A", pour garder la fiche fiable et scannable.
  const platform = content.platforms?.filter(Boolean).join(", ") || "";
  const sector = content.category || "";
  const format = content.format || content.tags?.[0] || "";
  const country = content.country || "";
  const brand = content.brand || '';
  const agency = content.agency || '';
  const plainDescription = stripMarkup(content.description);
  const subtitle = [brand, sector].filter(Boolean).join(" - ");
  const infoItems = [
    brand && { icon: Building2, label: "Marque", value: brand },
    sector && { icon: Tag, label: "Secteur", value: sector },
    country && { icon: Globe, label: "Pays", value: country },
    format && { icon: Mail, label: "Format", value: format },
    platform && { icon: Monitor, label: "Plateforme", value: platform },
    agency && { icon: Building2, label: "Agence", value: agency },
  ].filter(Boolean) as Array<{
    icon: typeof Building2;
    label: string;
    value: string;
  }>;

  const hasGallery = !!(content.thumbnail || (content.images && content.images.length > 0));

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: content.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Lien copié !");
    }
  };

  const handleAddToCollection = () => {
    if (!isAuthenticated) {
      window.location.href = `/login?redirect=/content/${id}`;
      return;
    }
    setCollectionModalOpen(true);
  };

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) {
      window.location.href = `/login?redirect=/content/${id}`;
      return;
    }
    if (isToggling) return;
    const shouldFavorite = !isFavorite(content.id);
    setIsToggling(true);
    try {
      const ok = await toggleFavorite(content.id);
      if (ok) {
        toast.success(shouldFavorite ? "Campagne sauvegardée" : "Campagne retirée des favoris");
      }
    } finally {
      setIsToggling(false);
    }
  };

  const handleJumpToAnalysis = () => {
    setActiveTab("axe");
    requestAnimationFrame(() => {
      document.getElementById("campaign-analysis")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  // ===== MODE APERÇU PUBLIC (visiteurs non connectés) =====
  if (authChecked && !isUserAuthenticated) {
    const previewImageUrl = content.thumbnail
      ? getGoogleDriveImageUrl(content.thumbnail)
      : content.images?.[0]
        ? getGoogleDriveImageUrl(content.images[0])
        : null;

    return (
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Breadcrumb / Retour */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;accueil
          </Link>

          {/* Grille aperçu : image + infos */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">

            {/* Colonne gauche : Image avec overlay */}
            <div className="space-y-6">
              {/* Image créative avec gradient de flou */}
              <div className="relative rounded-2xl overflow-hidden shadow-xl border border-border">
                {previewImageUrl ? (
                  <div className="relative">
                    <Image
                      src={previewImageUrl}
                      alt={content.title}
                      width={1200}
                      height={900}
                      className="h-auto max-h-[600px] w-full object-contain bg-gray-50"
                      priority
                    />
                    {/* Gradient overlay en bas */}
                    <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-background dark:via-background/80" />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                      <div className="flex items-center gap-2 bg-white/95 dark:bg-background/95 backdrop-blur-sm rounded-full px-5 py-2.5 shadow-lg border border-border">
                        <Lock className="h-4 w-4 text-[#F2B33D]" />
                        <span className="text-sm font-medium text-muted-foreground">Contenu complet : plan actif requis</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-[#F2B33D]/10 to-[#F5F5F5]/30 flex items-center justify-center">
                    <Eye className="h-16 w-16 text-[#F2B33D]/30" />
                  </div>
                )}
              </div>

              {/* Section floutée — simuler du contenu verrouillé */}
              <div className="relative">
                <div className="space-y-4 select-none pointer-events-none" aria-hidden="true">
                  <Card className="border-l-4 border-l-[#F2B33D]/30 shadow-sm opacity-50 blur-[6px]">
                    <CardContent className="p-6">
                      <div className="h-5 w-24 bg-muted rounded mb-3" />
                      <div className="space-y-2">
                        <div className="h-3 w-full bg-muted rounded" />
                        <div className="h-3 w-5/6 bg-muted rounded" />
                        <div className="h-3 w-4/6 bg-muted rounded" />
                        <div className="h-3 w-full bg-muted rounded" />
                        <div className="h-3 w-3/4 bg-muted rounded" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-[#F2B33D]/30 shadow-sm opacity-50 blur-[6px]">
                    <CardContent className="p-6">
                      <div className="h-5 w-32 bg-muted rounded mb-3" />
                      <div className="space-y-2">
                        <div className="h-3 w-full bg-muted rounded" />
                        <div className="h-3 w-2/3 bg-muted rounded" />
                        <div className="h-3 w-5/6 bg-muted rounded" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {/* Overlay central avec CTA */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center bg-white/95 dark:bg-background/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-[#F2B33D]/20 max-w-sm mx-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F2B33D]/10 mb-3">
                      <Lock className="h-6 w-6 text-[#F2B33D]" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground mb-1">Analyse complète</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Créez votre compte, choisissez un plan, puis accédez à l&apos;analyse détaillée et aux axes stratégiques.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        asChild
                        className="w-full bg-[#F2B33D] hover:bg-[#6b2d76] text-white font-semibold shadow-lg shadow-[#F2B33D]/25"
                      >
                        <Link href={`/register?redirect=/content/${content.slug || content.id}`}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Créer un compte et choisir un plan
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="w-full border-[#F2B33D]/30 text-[#F2B33D] hover:bg-[#F2B33D]/5"
                      >
                        <Link href={`/login?redirect=/content/${content.slug || content.id}`}>
                          Déjà membre ? Se connecter
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Colonne droite : Sidebar infos + CTA */}
            <div className="lg:sticky lg:top-6 space-y-6">
              {/* Titre */}
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground font-[family-name:var(--font-heading)]">
                  {content.title}
                </h1>
                {subtitle && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Badges axes */}
              {content.axe && content.axe.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {content.axe.map((a) => (
                    <Badge
                      key={a}
                      className="bg-[#F2B33D]/10 text-[#F2B33D] border-[#F2B33D]/20 hover:bg-[#F2B33D]/20"
                    >
                      {a}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Carte Informations (aperçu limité) */}
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <h2 className="font-bold text-lg flex items-center gap-2">
                    <Eye className="h-5 w-5 text-[#F2B33D]" />
                    Aperçu
                  </h2>

                  <div className="space-y-3">
                    {infoItems.slice(0, 5).map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-3 text-sm">
                        <Icon className="h-4 w-4 text-[#F2B33D]" />
                        <span className="text-muted-foreground">{label}:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* CTA Card — inscription */}
              <Card className="shadow-lg border-[#F2B33D]/20 bg-gradient-to-br from-[#F2B33D]/5 via-transparent to-[#F5F5F5]/20">
                <CardContent className="p-6 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F2B33D]/10 mb-4">
                    <Sparkles className="h-7 w-7 text-[#F2B33D]" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Accédez à tout le contenu</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    Analyses stratégiques, axes de communication, descriptions complètes et plus de <strong>contenus exclusifs</strong>.
                  </p>
                  <Button
                    asChild
                    className="w-full bg-[#F2B33D] hover:bg-[#6b2d76] text-white font-semibold shadow-lg shadow-[#F2B33D]/25 h-12 text-base"
                  >
                    <Link href={`/register?redirect=/content/${content.slug || content.id}`}>
                      Créer un compte et choisir un plan
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3">
                    Déjà membre ?{" "}
                    <Link href={`/login?redirect=/content/${content.slug || content.id}`} className="text-[#F2B33D] font-semibold hover:underline">
                      Se connecter
                    </Link>
                  </p>
                </CardContent>
              </Card>

              {/* Bouton partage (même non connecté) */}
              <Button
                variant="outline"
                className="w-full gap-2 border-border hover:border-[#F2B33D]/30 hover:text-[#F2B33D]"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
                Partager cette campagne
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Garde abonnement : pas d'accès au détail tant que l'utilisateur n'a pas de plan actif.
  if (subChecking || subLocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#F2B33D] border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {subLocked ? "On prépare votre accès Laveiye…" : "Chargement…"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar showSearch={false} />

      {/* Barre de progression de lecture */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted/30">
        <div
          className="h-full bg-gradient-to-r from-[#F2B33D] to-[#a855f7] transition-all duration-150 ease-out"
          style={{ width: `${readProgress}%` }}
        />
      </div>

      <main ref={articleRef} className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back button */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la bibliothèque
        </Link>

        {/* ===== EN-TÊTE : Titre + axes + sous-titre ===== */}
        <div className="mb-6">
          <div className="flex flex-wrap items-baseline gap-3 justify-between">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground font-[family-name:var(--font-heading)]">
              {content.title}
            </h1>
            {content.axe && content.axe.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  {content.axe.length > 1 ? "Axes" : "Axe"} :
                </span>
                {content.axe.map((axe) => (
                  <span
                    key={axe}
                    className="inline-flex items-center rounded-full border border-[#F2B33D]/40 bg-[#F2B33D]/10 px-2.5 py-0.5 text-xs font-medium text-[#b8850a] dark:text-[#F2B33D]"
                  >
                    {axe}
                  </span>
                ))}
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-muted-foreground mt-1 text-sm">
              {subtitle}
            </p>
          )}
        </div>

        {/* ===== GRILLE 2 COLONNES : contenu gauche + sidebar droite ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_500px] gap-8 items-start">

          {/* ---- Colonne gauche : contenu principal ---- */}
          <div className="space-y-6 min-w-0">

            {/* Media principal */}
            {hasGallery && (
              <section className="space-y-3" aria-label="Visuels de la campagne">
                <ImageGallery
                  mainImage={content.thumbnail}
                  images={content.images || []}
                  title={content.title}
                  campaignId={content.id}
                  onAddToCollection={handleAddToCollection}
                  onShare={handleShare}
                  onToggleFavorite={handleToggleFavorite}
                  floatingActionLabel="Voir l'analyse"
                  onFloatingAction={handleJumpToAnalysis}
                  isFavorited={isFavorite(content.id)}
                />

                {plainDescription && (
                  <p className="px-1 text-sm leading-relaxed text-muted-foreground">
                    {truncateText(plainDescription, 220)}
                  </p>
                )}
              </section>
            )}

            <Card className="shadow-sm lg:hidden">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={isFavorite(content.id) ? "default" : "outline"}
                    className={cn(
                      "min-h-11 gap-2 whitespace-normal px-3 py-2 text-center leading-tight",
                      isFavorite(content.id)
                        ? "bg-[#F2B33D] text-[#0F0F0F] hover:bg-[#E4A82F] hover:text-[#0F0F0F]"
                        : "hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                    )}
                    disabled={isToggling}
                    onClick={handleToggleFavorite}
                    aria-pressed={isFavorite(content.id)}
                  >
                    {isToggling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Heart className={cn("h-4 w-4", isFavorite(content.id) && "fill-current")} />
                    )}
                    {isFavorite(content.id) ? "Favori" : "Sauvegarder"}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 gap-2 whitespace-normal px-3 py-2 text-center leading-tight hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                    onClick={handleAddToCollection}
                  >
                    <FolderPlus className="h-4 w-4" />
                    Ajouter à une collection
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 gap-2 whitespace-normal px-3 py-2 text-center leading-tight hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4" />
                    Partager
                  </Button>
                  {content.publication_url && (
                    <Button
                      asChild
                      variant="outline"
                      className="min-h-11 w-full gap-2 whitespace-normal border-[#F2B33D]/40 px-3 py-2 text-center leading-tight text-[#0F0F0F] hover:border-[#F2B33D] hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                    >
                      <a href={content.publication_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Source
                      </a>
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex justify-center border-t border-border pt-3">
                  <ReactionButtons campaignId={content.id} />
                </div>
              </CardContent>
            </Card>

            {/* Video player — embed multi-plateforme (affiché dans les 2 tabs si présent) */}
            {content.video_url && (() => {
              const originalVideoUrl = getOriginalVideoUrl(content.video_url);
              const videoPlatform = detectVideoPlatform(originalVideoUrl);
              const embedUrl = getEmbedUrl(content.video_url);
              const platformLabel = getVideoPlatformLabel(videoPlatform);

              if (videoPlatform === "linkedin" || videoPlatform === "facebook" || videoPlatform === "instagram") {
                const iconBg = videoPlatform === "linkedin"
                  ? "bg-[#0A66C2]"
                  : videoPlatform === "instagram"
                    ? "bg-gradient-to-br from-[#F2B33D] via-[#F2B33D] to-orange-400"
                    : "bg-[#1877F2]";

                return (
                  <Card className="overflow-hidden">
                    <CardContent className="p-0">
                      <a
                        href={originalVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block relative group"
                      >
                        <div className="relative aspect-[9/16] max-h-[500px] w-full overflow-hidden bg-gray-100">
                          <Image
                            src={getGoogleDriveImageUrl(content.thumbnail || '') || "/placeholder.jpg"}
                            alt={content.title}
                            fill
                            sizes="(max-width: 1024px) 100vw, 800px"
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                            <div className="bg-white/95 rounded-full p-5 shadow-xl group-hover:scale-110 transition-transform">
                              <Play className="h-10 w-10 text-[#0F0F0F] ml-1" />
                            </div>
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 pt-20">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-full text-white ${iconBg}`}>
                              <Play className="h-5 w-5 ml-0.5" />
                            </div>
                            <div>
                              <p className="font-semibold text-white text-lg">Voir la vidéo sur {platformLabel}</p>
                              <p className="text-sm text-white/70">Cliquez pour ouvrir dans un nouvel onglet</p>
                            </div>
                            <ExternalLink className="h-5 w-5 text-white/70 ml-auto" />
                          </div>
                        </div>
                      </a>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Card>
                  <CardContent className="p-4">
                    <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Vidéo {platformLabel}
                    </h2>
                    <div className="rounded-lg overflow-hidden">
                      <iframe
                        src={embedUrl}
                        className="w-full aspect-video rounded-lg"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        title={`Vidéo ${platformLabel} de la campagne`}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Navigation de lecture */}
            <div id="campaign-analysis" className="scroll-mt-24 flex overflow-x-auto pb-1">
              <div
                className="inline-flex rounded-full border border-border bg-muted/30 p-1"
                role="tablist"
                aria-label="Sections de la campagne"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "axe"}
                  onClick={() => setActiveTab("axe")}
                  className={cn(
                    "whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 sm:px-6",
                    activeTab === "axe"
                      ? "bg-[#F2B33D] text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Analyse stratégique
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "utilisation"}
                  onClick={() => setActiveTab("utilisation")}
                  className={cn(
                    "whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 sm:px-6",
                    activeTab === "utilisation"
                      ? "bg-[#F2B33D] text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Infos & tags
                </button>
              </div>
            </div>

            {/* ---- Onglet AXE : Analyse + Comment s'en servir ---- */}
            {activeTab === "axe" && (
              <div className="space-y-6">
                {content.analyse && (
                  <Card className="border-l-4 border-l-[#F2B33D] shadow-sm">
                    <CardContent className="p-6">
                      <h2 className="font-bold text-lg mb-3">Analyse</h2>
                      <div
                        className="text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: formatDescription(content.analyse) }}
                      />
                    </CardContent>
                  </Card>
                )}

                {content.how_to_use && (
                  <Card className="border-l-4 border-l-[#F2B33D] shadow-sm">
                    <CardContent className="p-6">
                      <h2 className="font-bold text-lg mb-3">Comment s'en servir</h2>
                      <div
                        className="text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: formatDescription(content.how_to_use) }}
                      />
                    </CardContent>
                  </Card>
                )}

                {!content.analyse && !content.how_to_use && content.description && (
                  <Card className="border-l-4 border-l-[#F2B33D] shadow-sm">
                    <CardContent className="p-6">
                      <h2 className="font-bold text-lg mb-3">Analyse</h2>
                      <div
                        className="text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: formatDescription(content.description) }}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ---- Onglet UTILISATION : Description + Tags ---- */}
            {activeTab === "utilisation" && (
              <div className="space-y-6">
                {content.description && (
                  <Card className="border-l-4 border-l-[#F2B33D] shadow-sm">
                    <CardContent className="p-6">
                      <h2 className="font-bold text-lg mb-3">Description</h2>
                      <div
                        className="text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: formatDescription(content.description) }}
                      />
                    </CardContent>
                  </Card>
                )}

                {content.summary && (
                  <Card className="border-l-4 border-l-[#F2B33D] shadow-sm">
                    <CardContent className="p-6">
                      <h2 className="font-bold text-lg mb-3">Résumé</h2>
                      <div
                        className="text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: formatDescription(content.summary) }}
                      />
                    </CardContent>
                  </Card>
                )}

                {content.tags && content.tags.length > 0 && (
                  <Card className="border-l-4 border-l-[#F2B33D] shadow-sm">
                    <CardContent className="p-6">
                      <h2 className="font-bold text-lg mb-3">Tags</h2>
                      <div className="flex flex-wrap gap-2">
                        {[...new Set(content.tags)].map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="cursor-pointer hover:bg-[#F2B33D] hover:text-white transition-colors"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ---- Contenus similaires — Grille 2 colonnes, 8 items ---- */}
            {relatedContent.length > 0 && (
              <div className="mt-2">
                <h3 className="font-bold text-xl mb-5">Contenus similaires</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relatedContent.map((item) => (
                    <Link
                      key={item.id}
                      href={`/content/${item.slug || item.id}`}
                      className="flex gap-4 group p-4 rounded-xl border border-border hover:border-[#F2B33D]/30 hover:shadow-md transition-all bg-card"
                      onClick={async (e) => {
                        if (isFreeUser && isBlocked) {
                          e.preventDefault();
                          setShowUpgrade(true);
                          return;
                        }
                        if (isFreeUser) {
                          e.preventDefault();
                          try {
                            const res = await fetch('/api/track-click'); // GET
                            if (res.ok) {
                              const data = await res.json();
                              if (data.isFree && data.limit != null && (data.clicks || 0) >= data.limit) {
                                setIsBlocked(true);
                                setShowUpgrade(true);
                                return;
                              }
                            }
                          } catch { /* laisser passer */ }
                          router.push(`/content/${item.slug || item.id}`);
                        }
                      }}
                    >
                      <div className="relative w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                        {item.thumbnail ? (
                          <Image
                            src={getGoogleDriveImageUrl(item.thumbnail)}
                            alt={item.title}
                            fill
                            sizes="64px"
                            className="object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-bold">
                            {item.title.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-semibold text-foreground group-hover:text-[#F2B33D] transition-colors line-clamp-1">
                          {item.title}
                        </h4>
                        {item.summary ? (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {item.summary.replace(/<[^>]*>/g, '').substring(0, 120)}{item.summary.length > 120 ? '...' : ''}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.brand || item.category}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ---- Colonne droite : Sidebar sticky ---- */}
          <div className="lg:sticky lg:top-6 space-y-6">
            <Card className="hidden shadow-sm lg:block">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h2 className="font-bold text-lg">Actions</h2>
                  <p className="text-sm text-muted-foreground">
                    Gardez cette campagne sous la main ou partagez-la avec votre équipe.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={isFavorite(content.id) ? "default" : "outline"}
                    className={cn(
                      "min-h-11 justify-start gap-2 whitespace-normal px-3 py-2 text-left leading-tight",
                      isFavorite(content.id)
                        ? "bg-[#F2B33D] text-[#0F0F0F] hover:bg-[#E4A82F] hover:text-[#0F0F0F]"
                        : "hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                    )}
                    disabled={isToggling}
                    onClick={handleToggleFavorite}
                    aria-pressed={isFavorite(content.id)}
                  >
                    {isToggling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Heart className={cn("h-4 w-4", isFavorite(content.id) && "fill-current")} />
                    )}
                    {isFavorite(content.id) ? "Dans vos favoris" : "Sauvegarder"}
                  </Button>

                  <Button
                    variant="outline"
                    className="min-h-11 justify-start gap-2 whitespace-normal px-3 py-2 text-left leading-tight hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                    onClick={handleAddToCollection}
                  >
                    <FolderPlus className="h-4 w-4" />
                    Ajouter à une collection
                  </Button>

                  <Button
                    variant="outline"
                    className="min-h-11 justify-start gap-2 hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4" />
                    Partager
                  </Button>

                  {content.publication_url && (
                    <Button
                      asChild
                      variant="outline"
                      className="min-h-11 w-full justify-start gap-2 border-[#F2B33D]/40 text-[#0F0F0F] hover:border-[#F2B33D] hover:bg-[#FFF6E3] hover:text-[#0F0F0F] font-semibold"
                    >
                      <a href={content.publication_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Voir la publication
                      </a>
                    </Button>
                  )}

                  {isAdmin && content.id && (
                    <Link href={`/admin/campaigns?edit=${content.id}`} className="col-span-2">
                      <Button
                        variant="outline"
                        className="min-h-11 w-full justify-start gap-2 text-[#0F0F0F] border-[#0F0F0F]/20 hover:bg-[#F5F5F5]"
                      >
                        <Pencil className="h-4 w-4" />
                        Modifier la campagne
                      </Button>
                    </Link>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <p className="mb-2 text-sm font-semibold text-muted-foreground">Réactions</p>
                  <ReactionButtons campaignId={content.id} />
                </div>
              </CardContent>
            </Card>

            {/* Carte Informations */}
            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-4">
                <h2 className="font-bold text-lg">Informations</h2>

                {infoItems.length > 0 ? (
                  <div className="space-y-3">
                    {infoItems.map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-3 text-sm">
                        <Icon className="h-4 w-4 text-[#F2B33D]" />
                        <span className="text-muted-foreground">{label}:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Les informations de campagne seront ajoutées prochainement.
                  </p>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </main>

      {/* Modale d'ajout à une collection */}
      <AddToCollectionModal
        open={collectionModalOpen}
        onOpenChange={setCollectionModalOpen}
        campaignId={content.id}
        campaignTitle={content.title}
      />

      {/* Upgrade popup pour les free users */}
      <UpgradePopup
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="clicks"
      />

      {/* Bottom sheet consultations restantes (free users) */}
      <ConsultationBottomSheet
        open={bottomSheetOpen}
        onClose={() => setBottomSheetOpen(false)}
        remainingConsultations={bottomSheetRemaining}
        totalLimit={MONTHLY_CLICK_LIMIT}
      />
    </div>
  );
}
