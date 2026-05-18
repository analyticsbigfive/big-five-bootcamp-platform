"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Save,
  Loader2,
  Mail,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Users,
  Eye,
  EyeOff,
  Zap,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

interface LibraryMetadata {
  totalCampaigns: number;
  brands: string[];
  sectors: string[];
  axes: string[];
  countries: string[];
  period: { from: string; to: string };
  platformUrl: string;
  latestCampaigns: { title: string; url: string; brand: string; sector: string }[];
  recommendedSendTime: string;
}

export default function MailchimpSettingsPage() {
  // Configuration Mailchimp
  const [apiKey, setApiKey] = useState("");
  const [audienceId, setAudienceId] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [defaultTag, setDefaultTag] = useState("");

  // Audience keynote (séparée de l'audience principale)
  const [keynoteAudienceId, setKeynoteAudienceId] = useState("");
  const [keynoteTag, setKeynoteTag] = useState("");
  const [keynotePromoTag, setKeynotePromoTag] = useState("");

  // Audience #BigFiveDecrypte (séparée — debrief mensuel Pro)
  const [decrypteAudienceId, setDecrypteAudienceId] = useState("");
  const [decrypteTag, setDecrypteTag] = useState("");

  // États UI
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Résultats
  const [testResult, setTestResult] = useState<{
    success: boolean;
    accountName?: string;
    email?: string;
    error?: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    synced: number;
    errors: string[];
  } | null>(null);
  const [metadata, setMetadata] = useState<LibraryMetadata | null>(null);

  // Charger la configuration existante
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (data.settings) {
          // La clé API est masquée côté serveur, on affiche un placeholder
          setApiKey(data.settings.mailchimp_api_key || "");
          setAudienceId(data.settings.mailchimp_audience_id || "");
          setFromName(data.settings.mailchimp_from_name || "");
          setFromEmail(data.settings.mailchimp_from_email || "");
          setDefaultTag(data.settings.mailchimp_default_tag || "");
          setKeynoteAudienceId(data.settings.mailchimp_keynote_audience_id || "");
          setKeynoteTag(data.settings.mailchimp_keynote_tag || "");
          setKeynotePromoTag(data.settings.mailchimp_keynote_promo_tag || "");
          setDecrypteAudienceId(data.settings.mailchimp_decrypte_audience_id || "");
          setDecrypteTag(data.settings.mailchimp_decrypte_tag || "");
        }
      } catch {
        console.error("Erreur chargement configuration Mailchimp");
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // Sauvegarder la configuration
  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("La clé API Mailchimp est requise");
      return;
    }
    if (!audienceId.trim()) {
      toast.error("L'ID de l'audience est requis");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            mailchimp_api_key: apiKey,
            mailchimp_audience_id: audienceId.trim(),
            mailchimp_from_name: fromName,
            mailchimp_from_email: fromEmail,
            mailchimp_default_tag: defaultTag.trim(),
            mailchimp_keynote_audience_id: keynoteAudienceId.trim(),
            mailchimp_keynote_tag: keynoteTag.trim(),
            mailchimp_keynote_promo_tag: keynotePromoTag.trim(),
            mailchimp_decrypte_audience_id: decrypteAudienceId.trim(),
            mailchimp_decrypte_tag: decrypteTag.trim(),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      toast.success("Configuration Mailchimp enregistrée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  // Tester la connexion
  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      toast.error("Veuillez saisir une clé API");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/admin/mailchimp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      const data = await res.json();
      setTestResult(data);

      if (data.success) {
        toast.success(`Connexion réussie ! Compte : ${data.accountName}`);
      } else {
        toast.error(data.error || "Échec de la connexion");
      }
    } catch {
      toast.error("Erreur lors du test de connexion");
      setTestResult({ success: false, error: "Erreur réseau" });
    } finally {
      setIsTesting(false);
    }
  };

  // Synchroniser les utilisateurs
  const handleSyncUsers = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch("/api/admin/mailchimp/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      setSyncResult(data);

      if (data.success) {
        toast.success(`${data.synced} utilisateur(s) synchronisé(s)`);
      } else {
        toast.error(data.error || "Échec de la synchronisation");
      }
    } catch {
      toast.error("Erreur lors de la synchronisation");
    } finally {
      setIsSyncing(false);
    }
  };

  // Charger les métadonnées
  const handleLoadMetadata = async () => {
    setIsLoadingMetadata(true);

    try {
      const res = await fetch("/api/admin/mailchimp/metadata");
      const data = await res.json();

      if (data.success) {
        setMetadata(data.metadata);
      } else {
        toast.error(data.error || "Erreur chargement métadonnées");
      }
    } catch {
      toast.error("Erreur lors du chargement des métadonnées");
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-[family-name:var(--font-heading)]">
            Configuration Mailchimp
          </h1>
          <p className="text-gray-600 mt-1">
            Gérez l'intégration avec Mailchimp pour les campagnes email
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Chargement de la configuration...</span>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Configuration API */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Mail className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-gray-900">Paramètres API</CardTitle>
                  <CardDescription className="text-gray-600">
                    Configurez la connexion à votre compte Mailchimp
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              {/* Clé API */}
              <div>
                <Label htmlFor="mc-api-key" className="text-gray-900">
                  Clé API Mailchimp *
                </Label>
                <p className="text-xs text-gray-500 mb-1.5">
                  Trouvez-la dans Mailchimp → Account → Extras → API Keys
                </p>
                <div className="relative">
                  <Input
                    id="mc-api-key"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us21"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* ID Audience */}
              <div>
                <Label htmlFor="mc-audience-id" className="text-gray-900">
                  ID de l'audience/liste *
                </Label>
                <p className="text-xs text-gray-500 mb-1.5">
                  Mailchimp → Audience → Settings → Audience name and defaults
                </p>
                <Input
                  id="mc-audience-id"
                  value={audienceId}
                  onChange={(e) => setAudienceId(e.target.value)}
                  placeholder="a1b2c3d4e5"
                />
              </div>

              {/* Nom expéditeur */}
              <div>
                <Label htmlFor="mc-from-name" className="text-gray-900">
                  Nom de l'expéditeur
                </Label>
                <Input
                  id="mc-from-name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Laveiye"
                />
              </div>

              {/* Email expéditeur */}
              <div>
                <Label htmlFor="mc-from-email" className="text-gray-900">
                  Email de l'expéditeur
                </Label>
                <Input
                  id="mc-from-email"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="contact@laveiye.com"
                />
              </div>

              {/* Tag par défaut */}
              <div>
                <Label htmlFor="mc-default-tag" className="text-gray-900">
                  Tag par défaut (optionnel)
                </Label>
                <p className="text-xs text-gray-500 mb-1.5">
                  Tag appliqué automatiquement aux contacts synchronisés
                </p>
                <Input
                  id="mc-default-tag"
                  value={defaultTag}
                  onChange={(e) => setDefaultTag(e.target.value)}
                  placeholder="laveiye-platform"
                />
              </div>

              {/* Boutons action */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  onClick={handleTestConnection}
                  disabled={isTesting || !apiKey.trim()}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Test en cours...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Tester la connexion
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={isSaving || !apiKey.trim() || !audienceId.trim()}
                  className="bg-[#F2B33D] hover:bg-[#d99a2a] text-white shadow-lg shadow-[#F2B33D]/25"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </div>

              {/* Résultat du test */}
              {testResult && (
                <div
                  className={`mt-3 p-3 rounded-lg border ${
                    testResult.success
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      {testResult.success ? (
                        <>
                          <p className="font-medium">Connexion réussie !</p>
                          <p className="text-sm">
                            Compte : {testResult.accountName} ({testResult.email})
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium">Échec de la connexion</p>
                          <p className="text-sm">{testResult.error}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audience Keynote (séparée) */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Mail className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-gray-900">Audience Keynote (LAVEIYE)</CardTitle>
                  <CardDescription className="text-gray-600">
                    Audience Mailchimp dédiée aux inscriptions keynote et codes promo. Séparée des emails marketing classiques.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div>
                <Label htmlFor="mc-keynote-audience-id" className="text-gray-900">
                  ID de l'audience keynote
                </Label>
                <p className="text-xs text-gray-500 mb-1.5">
                  ID de la liste Mailchimp recevant les inscriptions à la keynote (ex : <code>e799f1a2ee</code>). Si vide, l'audience principale est utilisée.
                </p>
                <Input
                  id="mc-keynote-audience-id"
                  value={keynoteAudienceId}
                  onChange={(e) => setKeynoteAudienceId(e.target.value)}
                  placeholder="e799f1a2ee"
                />
              </div>

              <div>
                <Label htmlFor="mc-keynote-tag" className="text-gray-900">
                  Tag inscription keynote
                </Label>
                <p className="text-xs text-gray-500 mb-1.5">
                  Tag appliqué aux contacts inscrits à la keynote
                </p>
                <Input
                  id="mc-keynote-tag"
                  value={keynoteTag}
                  onChange={(e) => setKeynoteTag(e.target.value)}
                  placeholder="keynote-2026"
                />
              </div>

              <div>
                <Label htmlFor="mc-keynote-promo-tag" className="text-gray-900">
                  Tag code promo
                </Label>
                <p className="text-xs text-gray-500 mb-1.5">
                  Tag appliqué pour la synchronisation des codes promo générés
                </p>
                <Input
                  id="mc-keynote-promo-tag"
                  value={keynotePromoTag}
                  onChange={(e) => setKeynotePromoTag(e.target.value)}
                  placeholder="promo-pre-launch"
                />
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-900">
                <p className="font-medium mb-1">Champs de fusion (merge fields) à créer dans cette audience :</p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  <li><code>FNAME</code> — Prénom (par défaut)</li>
                  <li><code>LNAME</code> — Nom (par défaut)</li>
                  <li><code>COUNTRY</code> — Pays (Text)</li>
                  <li><code>PROMO</code> — Code promo généré (Text)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Audience #BigFiveDecrypte */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Mail className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-gray-900">Audience #BigFiveDecrypte</CardTitle>
                  <CardDescription className="text-gray-600">
                    Audience dédiée aux inscriptions Pro à la session mensuelle de debrief. Les demandes envoyées depuis <code>/decrypte</code> sont automatiquement ajoutées à cette audience.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div>
                <Label htmlFor="mc-decrypte-audience-id" className="text-gray-900">
                  ID de l'audience Decrypte
                </Label>
                <p className="text-xs text-gray-500 mb-1.5">
                  ID de la liste Mailchimp recevant les inscriptions #BigFiveDecrypte. Si vide, l'audience principale est utilisée.
                </p>
                <Input
                  id="mc-decrypte-audience-id"
                  value={decrypteAudienceId}
                  onChange={(e) => setDecrypteAudienceId(e.target.value)}
                  placeholder="a1b2c3d4e5"
                />
              </div>

              <div>
                <Label htmlFor="mc-decrypte-tag" className="text-gray-900">
                  Tag Decrypte
                </Label>
                <p className="text-xs text-gray-500 mb-1.5">
                  Tag appliqué aux inscrits (par défaut : <code>bigfive-decrypte</code>). Un tag complémentaire <code>decrypte-YYYY-MM</code> est ajouté automatiquement.
                </p>
                <Input
                  id="mc-decrypte-tag"
                  value={decrypteTag}
                  onChange={(e) => setDecrypteTag(e.target.value)}
                  placeholder="bigfive-decrypte"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                <p className="font-medium mb-1">Champs de fusion (merge fields) recommandés :</p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  <li><code>FNAME</code> / <code>LNAME</code> — Nom complet (par défaut)</li>
                  <li><code>COMPANY</code> — Entreprise (Text)</li>
                  <li><code>JOBTITLE</code> — Poste (Text)</li>
                  <li><code>TOPICS</code> — Sujets d'intérêt (Text)</li>
                  <li><code>PHONE</code> — Téléphone (Text)</li>
                  <li><code>SESSION</code> — Session du mois (Text, ex: <code>2026-05</code>)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Synchronisation utilisateurs */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#F2B33D]/10">
                  <Users className="h-5 w-5 text-[#0F0F0F]" />
                </div>
                <div>
                  <CardTitle className="text-gray-900">Synchronisation des utilisateurs</CardTitle>
                  <CardDescription className="text-gray-600">
                    Synchronisez les utilisateurs inscrits avec votre audience Mailchimp
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Cette action va ajouter ou mettre à jour tous les utilisateurs de la plateforme
                dans votre audience Mailchimp. Les informations synchronisées incluent le nom,
                l'email et le plan d'abonnement.
              </p>

              <Button
                onClick={handleSyncUsers}
                disabled={isSyncing}
                variant="outline"
                className="border-[#0F0F0F]/30 text-[#0F0F0F] hover:bg-[#F5F5F5]"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Synchronisation...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Synchroniser maintenant
                  </>
                )}
              </Button>

              {syncResult && (
                <div
                  className={`p-3 rounded-lg border ${
                    syncResult.success
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  {syncResult.success ? (
                    <div>
                      <p className="font-medium">
                        <CheckCircle2 className="h-4 w-4 inline mr-1" />
                        {syncResult.synced} utilisateur(s) synchronisé(s)
                      </p>
                      {syncResult.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-amber-700">
                            {syncResult.errors.length} erreur(s) :
                          </p>
                          <ul className="text-xs list-disc list-inside mt-1 max-h-24 overflow-auto">
                            {syncResult.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="font-medium">
                      <XCircle className="h-4 w-4 inline mr-1" />
                      Erreur : {syncResult.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Métadonnées Creative Library */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <BarChart3 className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <CardTitle className="text-gray-900">Métadonnées Creative Library</CardTitle>
                  <CardDescription className="text-gray-600">
                    Données disponibles pour les campagnes email Mailchimp
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Ces métadonnées peuvent être incluses dans vos campagnes email Mailchimp
                pour informer vos abonnés du contenu de la bibliothèque.
              </p>

              <Button
                onClick={handleLoadMetadata}
                disabled={isLoadingMetadata}
                variant="outline"
                className="border-cyan-300 text-cyan-700 hover:bg-cyan-50"
              >
                {isLoadingMetadata ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Charger les métadonnées
                  </>
                )}
              </Button>

              {metadata && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Campagnes publiées :</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {metadata.totalCampaigns}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Période :</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {metadata.period.from} — {metadata.period.to}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="text-gray-500">Marques ({metadata.brands.length}) :</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {metadata.brands.slice(0, 15).map((b) => (
                        <span
                          key={b}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700"
                        >
                          {b}
                        </span>
                      ))}
                      {metadata.brands.length > 15 && (
                        <span className="text-xs text-gray-500">
                          +{metadata.brands.length - 15} autres
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="text-gray-500">Secteurs ({metadata.sectors.length}) :</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {metadata.sectors.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#F5F5F5] text-[#0F0F0F]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="text-gray-500">Pays ({metadata.countries.length}) :</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {metadata.countries.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="text-gray-500">Axes créatifs ({metadata.axes.length}) :</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {metadata.axes.map((a) => (
                        <span
                          key={a}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm pt-2 border-t">
                    <span className="text-gray-500">Lien plateforme :</span>
                    <a
                      href={metadata.platformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 hover:underline"
                    >
                      {metadata.platformUrl}
                    </a>
                  </div>

                  {/* Créneau d'envoi recommandé */}
                  <div className="text-sm pt-2 border-t">
                    <span className="text-gray-500">🕐 Créneau d'envoi recommandé :</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {metadata.recommendedSendTime}
                    </span>
                  </div>

                  {/* Dernières campagnes ajoutées */}
                  {metadata.latestCampaigns && metadata.latestCampaigns.length > 0 && (
                    <div className="text-sm pt-2 border-t">
                      <span className="text-gray-500 font-medium">
                        🆕 Dernières campagnes ajoutées ({metadata.latestCampaigns.length}) :
                      </span>
                      <div className="mt-2 space-y-2">
                        {metadata.latestCampaigns.map((campaign, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-2.5"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {campaign.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {campaign.brand} · {campaign.sector}
                              </p>
                            </div>
                            <a
                              href={campaign.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-3 text-xs text-blue-600 hover:underline whitespace-nowrap"
                            >
                              Voir →
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
