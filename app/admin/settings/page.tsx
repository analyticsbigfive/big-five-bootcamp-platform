"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Lock, Eye, EyeOff, Loader2, Mail, ShoppingCart, ExternalLink, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { parseMaintenanceMode, serializeMaintenanceMode } from "@/lib/maintenance-mode";

const parseBooleanSetting = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;

  return fallback;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SettingsPage() {
  // Chariow widget settings
  const [chariowProductId, setChariowProductId] = useState("");
  const [chariowStoreDomain, setChariowStoreDomain] = useState("bootcamps.bigfive.solutions");
  const [isLoadingChariow, setIsLoadingChariow] = useState(true);
  const [isSavingChariow, setIsSavingChariow] = useState(false);

  const [settings, setSettings] = useState({
    maintenanceMode: false,
    allowRegistrations: true,
    emailNotifications: true,
    publicAccess: true,
  });
  const [isLoadingGeneralSettings, setIsLoadingGeneralSettings] = useState(true);
  const [isSavingGeneralSettings, setIsSavingGeneralSettings] = useState(false);

  // Email contact settings
  const [contactToEmail, setContactToEmail] = useState("");
  const [contactFromEmail, setContactFromEmail] = useState("");
  const [resendInboundForwardTo, setResendInboundForwardTo] = useState("cossi@bigfiveabidjan.com");
  const [isLoadingEmailSettings, setIsLoadingEmailSettings] = useState(true);
  const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false);

  // Charger les paramètres email depuis la BDD
  useEffect(() => {
    const fetchEmailSettings = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (data.settings) {
          setContactToEmail(data.settings.contact_to_email || "support@laveiye.com");
          setContactFromEmail(data.settings.contact_from_email || "Laveiye <noreply@laveiye.com>");
          setResendInboundForwardTo(data.settings.resend_inbound_forward_to || "cossi@bigfiveabidjan.com");
        }
      } catch {
        console.error("Erreur chargement paramètres email");
      } finally {
        setIsLoadingEmailSettings(false);
      }
    };
    fetchEmailSettings();
  }, []);

  useEffect(() => {
    const fetchChariowSettings = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (data.settings) {
          setChariowProductId(data.settings.chariow_product_id || "");
          setChariowStoreDomain(data.settings.chariow_store_domain || "bootcamps.bigfive.solutions");
        }
      } catch {
        console.error("Erreur chargement paramètres Chariow");
      } finally {
        setIsLoadingChariow(false);
      }
    };
    fetchChariowSettings();
  }, []);

  useEffect(() => {
    const fetchGeneralSettings = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (data.settings) {
          setSettings({
            maintenanceMode: parseMaintenanceMode(data.settings.maintenance_mode, false),
            allowRegistrations: parseBooleanSetting(data.settings.allow_registrations, true),
            emailNotifications: parseBooleanSetting(data.settings.email_notifications, true),
            publicAccess: parseBooleanSetting(data.settings.public_access, true),
          });
        }
      } catch {
        console.error("Erreur chargement paramètres généraux");
      } finally {
        setIsLoadingGeneralSettings(false);
      }
    };
    fetchGeneralSettings();
  }, []);

  const handleSaveChariow = async () => {
    setIsSavingChariow(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            chariow_product_id: chariowProductId,
            chariow_store_domain: chariowStoreDomain,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      toast.success("Paramètres Chariow enregistrés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setIsSavingChariow(false);
    }
  };

  const handleSaveEmailSettings = async () => {
    const forwardTo = resendInboundForwardTo.trim();
    if (!EMAIL_RE.test(forwardTo)) {
      toast.error("Adresse de forward Resend invalide");
      return;
    }

    setIsSavingEmailSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            contact_to_email: contactToEmail,
            contact_from_email: contactFromEmail,
            resend_inbound_forward_to: forwardTo,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }

      toast.success("Paramètres email enregistrés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setIsSavingEmailSettings(false);
    }
  };

  // Email test (Gmail API relay)
  const [testEmailTo, setTestEmailTo] = useState("");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);

  const handleSendTestEmail = async () => {
    const target = testEmailTo.trim();
    if (!EMAIL_RE.test(target)) {
      toast.error("Adresse email invalide");
      return;
    }
    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch("/api/admin/send-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target, name: "Test admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(`Email envoyé à ${target}`);
      setTestEmailResult(`Email envoyé à ${target} (ID: ${data.id || "n/a"})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSaveGeneralSettings = async () => {
    setIsSavingGeneralSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            maintenance_mode: serializeMaintenanceMode(settings.maintenanceMode),
            allow_registrations: String(settings.allowRegistrations),
            email_notifications: String(settings.emailNotifications),
            public_access: String(settings.publicAccess),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }

      toast.success(
        settings.maintenanceMode
          ? "Mode maintenance activé"
          : "Mode maintenance désactivé"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setIsSavingGeneralSettings(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Les nouveaux mots de passe ne correspondent pas");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("Le nouveau mot de passe doit être différent de l'actuel");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erreur lors du changement de mot de passe");
        return;
      }

      toast.success("Mot de passe modifié avec succès");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-[family-name:var(--font-heading)]">
            Paramètres
          </h1>
          <p className="text-gray-600 mt-1">
            Configuration globale de la plateforme
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Password Change */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Lock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-gray-900">Changer le mot de passe</CardTitle>
                <CardDescription className="text-gray-600">
                  Modifiez votre mot de passe administrateur
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div>
              <Label htmlFor="currentPassword" className="text-gray-900">Mot de passe actuel</Label>
              <div className="relative mt-1.5">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Votre mot de passe actuel"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="newPassword" className="text-gray-900">Nouveau mot de passe</Label>
              <div className="relative mt-1.5">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirmPassword" className="text-gray-900">Confirmer le nouveau mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez le nouveau mot de passe"
                className="mt-1.5"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
              )}
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="bg-[#F2B33D] hover:bg-[#d99a2a] text-white shadow-lg shadow-[#F2B33D]/25"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Modification...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Modifier le mot de passe
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Email Contact Settings */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#F2B33D]/10">
                <Mail className="h-5 w-5 text-[#0F0F0F]" />
              </div>
              <div>
                <CardTitle className="text-gray-900">Emails de contact</CardTitle>
                <CardDescription className="text-gray-600">
                  Configurez les adresses email et le forward Resend
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            {isLoadingEmailSettings ? (
              <div className="flex items-center gap-2 text-gray-500 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Chargement des paramètres...</span>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="contactToEmail" className="text-gray-900">Email destinataire</Label>
                  <p className="text-xs text-gray-500 mb-1.5">L'adresse qui reçoit les messages du formulaire</p>
                  <Input
                    id="contactToEmail"
                    type="email"
                    value={contactToEmail}
                    onChange={(e) => setContactToEmail(e.target.value)}
                    placeholder="support@laveiye.com"
                  />
                </div>
                <div>
                  <Label htmlFor="contactFromEmail" className="text-gray-900">Email expéditeur</Label>
                  <p className="text-xs text-gray-500 mb-1.5">L'adresse affichée comme expéditeur (doit être vérifiée sur Resend)</p>
                  <Input
                    id="contactFromEmail"
                    type="text"
                    value={contactFromEmail}
                    onChange={(e) => setContactFromEmail(e.target.value)}
                    placeholder="Laveiye <noreply@laveiye.com>"
                  />
                </div>
                <div>
                  <Label htmlFor="resendInboundForwardTo" className="text-gray-900">Email de réception du forward Resend</Label>
                  <p className="text-xs text-gray-500 mb-1.5">L'adresse qui reçoit les emails entrants de support@laveiye.com via le webhook Resend</p>
                  <Input
                    id="resendInboundForwardTo"
                    type="email"
                    value={resendInboundForwardTo}
                    onChange={(e) => setResendInboundForwardTo(e.target.value)}
                    placeholder="cossi@bigfiveabidjan.com"
                  />
                </div>
                <Button
                  onClick={handleSaveEmailSettings}
                  disabled={isSavingEmailSettings || !contactToEmail || !resendInboundForwardTo}
                  className="bg-[#F2B33D] hover:bg-[#F2B33D] text-white shadow-lg shadow-[#F2B33D]/25"
                >
                  {isSavingEmailSettings ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Enregistrer les emails
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Chariow Widget Settings */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#F2B33D]/10">
                <ShoppingCart className="h-5 w-5 text-[#F2B33D]" />
              </div>
              <div>
                <CardTitle className="text-gray-900">Widget de paiement Chariow</CardTitle>
                <CardDescription className="text-gray-600">
                  Configurez le produit affiché sur la page keynote
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            {isLoadingChariow ? (
              <div className="flex items-center gap-2 text-gray-500 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Chargement...</span>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="chariowProductId" className="text-gray-900">
                    ID du produit
                  </Label>
                  <p className="text-xs text-gray-500 mb-1.5">
                    Valeur du champ <code className="bg-gray-100 px-1 rounded">data-product-id</code> du widget
                  </p>
                  <Input
                    id="chariowProductId"
                    type="text"
                    value={chariowProductId}
                    onChange={(e) => setChariowProductId(e.target.value)}
                    placeholder="prd_xxxxxxxxxx"
                  />
                </div>
                <div>
                  <Label htmlFor="chariowStoreDomain" className="text-gray-900">
                    Domaine de la boutique
                  </Label>
                  <p className="text-xs text-gray-500 mb-1.5">
                    Valeur du champ <code className="bg-gray-100 px-1 rounded">data-store-domain</code>
                  </p>
                  <Input
                    id="chariowStoreDomain"
                    type="text"
                    value={chariowStoreDomain}
                    onChange={(e) => setChariowStoreDomain(e.target.value)}
                    placeholder="bootcamps.bigfive.solutions"
                  />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    onClick={handleSaveChariow}
                    disabled={isSavingChariow || !chariowProductId}
                    className="bg-[#F2B33D] hover:bg-[#e0a435] text-white"
                  >
                    {isSavingChariow ? (
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
                  <a
                    href="/keynote"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Voir la page keynote
                  </a>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">Général</CardTitle>
            <CardDescription className="text-gray-600">
              Paramètres généraux de l'application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-gray-900 text-base">Mode Maintenance</Label>
                <p className="text-sm text-gray-600">
                  Désactive l'accès public au site pour maintenance
                </p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                disabled={isLoadingGeneralSettings || isSavingGeneralSettings}
                onCheckedChange={(checked) => setSettings({ ...settings, maintenanceMode: checked })}
              />
            </div>
            {settings.maintenanceMode && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Le site public affichera la page de maintenance. Les routes
                  administrateur restent accessibles pour gérer la plateforme.
                </p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-gray-900 text-base">Inscriptions</Label>
                <p className="text-sm text-gray-600">
                  Autoriser les nouvelles inscriptions utilisateurs
                </p>
              </div>
              <Switch
                checked={settings.allowRegistrations}
                disabled={isLoadingGeneralSettings || isSavingGeneralSettings}
                onCheckedChange={(checked) => setSettings({ ...settings, allowRegistrations: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Access Settings */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">Accès et Paiements</CardTitle>
            <CardDescription className="text-gray-600">
              Configuration des accès par défaut
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-gray-900 text-base">Accès Public</Label>
                <p className="text-sm text-gray-600">
                  Le contenu gratuit est visible sans connexion
                </p>
              </div>
              <Switch
                checked={settings.publicAccess}
                disabled={isLoadingGeneralSettings || isSavingGeneralSettings}
                onCheckedChange={(checked) => setSettings({ ...settings, publicAccess: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">Notifications</CardTitle>
            <CardDescription className="text-gray-600">
              Configuration des emails automatiques
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-gray-900 text-base">Emails Transactionnels</Label>
                <p className="text-sm text-gray-600">
                  Envoyer des emails de bienvenue et de confirmation
                </p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                disabled={isLoadingGeneralSettings || isSavingGeneralSettings}
                onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email test (relais Gmail API) */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-gray-900">Test du relais email</CardTitle>
                <CardDescription className="text-gray-600">
                  Envoie un email de test via le relais Gmail API configuré.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            <div>
              <Label htmlFor="testEmailTo" className="text-gray-900">Destinataire</Label>
              <p className="text-xs text-gray-500 mb-1.5">
                L'adresse qui recevra l'email de test.
              </p>
              <Input
                id="testEmailTo"
                type="email"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                placeholder="vous@example.com"
              />
            </div>
            {testEmailResult && (
              <p className="text-sm text-green-700 font-medium">✓ {testEmailResult}</p>
            )}
            <Button
              onClick={handleSendTestEmail}
              disabled={isSendingTestEmail || !testEmailTo}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSendingTestEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer un email test
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSaveGeneralSettings}
            disabled={isLoadingGeneralSettings || isSavingGeneralSettings}
            className="bg-[#FF6B35] hover:bg-[#e55a2b] text-white"
          >
            {isSavingGeneralSettings ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer les paramètres
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
