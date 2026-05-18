"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Calendar,
  Users,
  ArrowLeft,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";

type SessionStatus = "draft" | "open" | "closed" | "archived";

interface DecrypteSession {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  session_month: string;
  meeting_url: string | null;
  max_seats: number | null;
  status: SessionStatus;
  campaign_ids: string[];
  campaign_titles: string[];
  notes: string | null;
  registrations_count: number;
  created_at: string;
}

interface Campaign {
  id: string;
  title: string;
  brand?: string | null;
  status?: string | null;
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  draft: "Brouillon",
  open: "Ouverte",
  closed: "Fermee",
  archived: "Archivee",
};

const STATUS_COLOR: Record<SessionStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  open: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-amber-50 text-amber-700 border-amber-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
};

interface FormState {
  id: string | null;
  title: string;
  description: string;
  scheduled_at: string; // datetime-local string
  meeting_url: string;
  max_seats: string;
  status: SessionStatus;
  campaign_ids: string[];
  notes: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  description: "",
  scheduled_at: "",
  meeting_url: "",
  max_seats: "",
  status: "draft",
  campaign_ids: [],
  notes: "",
};

function toLocalDatetime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminDecrypteSessionsPage() {
  const [sessions, setSessions] = useState<DecrypteSession[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [campaignFilter, setCampaignFilter] = useState("");

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/decrypte/sessions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");
      setSessions(data.sessions || []);
      setWarning(data.warning || null);
      setWarningMessage(data.message || null);
    } catch (err: any) {
      toast.error(err.message || "Impossible de charger les seances");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/campaigns");
      const data = await res.json();
      if (!res.ok) return;
      setCampaigns(data.campaigns || []);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadCampaigns();
  }, [loadSessions, loadCampaigns]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (s: DecrypteSession) => {
    setForm({
      id: s.id,
      title: s.title,
      description: s.description || "",
      scheduled_at: toLocalDatetime(s.scheduled_at),
      meeting_url: s.meeting_url || "",
      max_seats: s.max_seats == null ? "" : String(s.max_seats),
      status: s.status,
      campaign_ids: [...(s.campaign_ids || [])],
      notes: s.notes || "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setCampaignFilter("");
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Titre requis");
      return;
    }
    setIsSaving(true);
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      scheduled_at: form.scheduled_at
        ? new Date(form.scheduled_at).toISOString()
        : null,
      meeting_url: form.meeting_url.trim() || null,
      max_seats: form.max_seats === "" ? null : Number(form.max_seats),
      status: form.status,
      campaign_ids: form.campaign_ids,
      notes: form.notes.trim() || null,
    };
    try {
      const url = form.id
        ? `/api/admin/decrypte/sessions/${form.id}`
        : "/api/admin/decrypte/sessions";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Echec de l'enregistrement");
      toast.success(form.id ? "Seance mise a jour" : "Seance creee");
      closeForm();
      loadSessions();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setIsSaving(false);
    }
  };

  const removeSession = async (s: DecrypteSession) => {
    if (
      !confirm(
        `Supprimer la seance "${s.title}" ? Les inscriptions liees ne seront plus rattachees.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/admin/decrypte/sessions/${s.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Echec");
      toast.success("Seance supprimee");
      loadSessions();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  const quickStatus = async (s: DecrypteSession, status: SessionStatus) => {
    try {
      const res = await fetch(`/api/admin/decrypte/sessions/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Echec");
      toast.success(`Seance ${STATUS_LABEL[status].toLowerCase()}`);
      loadSessions();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  const filteredCampaigns = campaigns.filter(
    (c) =>
      !campaignFilter ||
      c.title.toLowerCase().includes(campaignFilter.toLowerCase()) ||
      (c.brand || "").toLowerCase().includes(campaignFilter.toLowerCase())
  );

  const toggleCampaign = (id: string) => {
    setForm((f) => ({
      ...f,
      campaign_ids: f.campaign_ids.includes(id)
        ? f.campaign_ids.filter((x) => x !== id)
        : [...f.campaign_ids, id],
    }));
  };

  return (
    <div className="p-6 lg:p-10 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/decrypte"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Retour aux inscriptions
          </Link>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 font-heading flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-orange-500" />
            Seances #BigFiveDecrypte
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Definissez les dates, les campagnes a decrypter et la capacite des
            seances proposees aux abonnes Pro.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <Plus className="h-4 w-4 mr-2" /> Nouvelle seance
        </Button>
      </div>

      {warning === "table_missing" && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-900">
              <strong>Migration requise.</strong>{" "}
              {warningMessage ||
                "Appliquez scripts/decrypte-sessions.sql dans Supabase."}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {sessions.length} seance{sessions.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Aucune seance pour le moment. Cliquez sur "Nouvelle seance".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Titre</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Campagnes</th>
                    <th className="px-4 py-3">Inscrits</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{s.title}</div>
                        {s.description && (
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {s.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {s.scheduled_at
                            ? new Date(s.scheduled_at).toLocaleString("fr-FR", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "—"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {s.session_month}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[s.status]}`}
                        >
                          {STATUS_LABEL[s.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(s.campaign_titles || []).slice(0, 3).map((t, i) => (
                            <span
                              key={i}
                              className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                            >
                              {t}
                            </span>
                          ))}
                          {(s.campaign_titles?.length || 0) > 3 && (
                            <span className="text-xs text-slate-500">
                              +{(s.campaign_titles?.length || 0) - 3}
                            </span>
                          )}
                          {!s.campaign_titles?.length && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1 text-slate-700">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {s.registrations_count}
                          {s.max_seats != null && (
                            <span className="text-slate-400">
                              /{s.max_seats}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {s.status !== "open" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => quickStatus(s, "open")}
                              className="text-emerald-700 hover:bg-emerald-50"
                            >
                              Ouvrir
                            </Button>
                          )}
                          {s.status === "open" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => quickStatus(s, "closed")}
                              className="text-amber-700 hover:bg-amber-50"
                            >
                              Fermer
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSession(s)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="font-heading text-lg font-semibold">
                {form.id ? "Modifier la seance" : "Nouvelle seance"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitForm} className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="title" className="text-sm font-semibold">
                    Titre *
                  </Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="Decrypte – Janvier 2026"
                    required
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="scheduled_at"
                    className="text-sm font-semibold"
                  >
                    Date & heure
                  </Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, scheduled_at: e.target.value }))
                    }
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="status" className="text-sm font-semibold">
                    Statut
                  </Label>
                  <select
                    id="status"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        status: e.target.value as SessionStatus,
                      }))
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="draft">Brouillon (cache)</option>
                    <option value="open">Ouverte aux inscriptions</option>
                    <option value="closed">Fermee (visible)</option>
                    <option value="archived">Archivee</option>
                  </select>
                </div>

                <div>
                  <Label
                    htmlFor="meeting_url"
                    className="text-sm font-semibold"
                  >
                    Lien de reunion (Zoom / Meet)
                  </Label>
                  <Input
                    id="meeting_url"
                    type="url"
                    value={form.meeting_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, meeting_url: e.target.value }))
                    }
                    placeholder="https://zoom.us/j/..."
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="max_seats" className="text-sm font-semibold">
                    Capacite (places)
                  </Label>
                  <Input
                    id="max_seats"
                    type="number"
                    min={0}
                    value={form.max_seats}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, max_seats: e.target.value }))
                    }
                    placeholder="Illimite"
                    className="mt-1.5"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label
                    htmlFor="description"
                    className="text-sm font-semibold"
                  >
                    Description
                  </Label>
                  <textarea
                    id="description"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    rows={3}
                    className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Theme de la seance, intervenant, plan..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-sm font-semibold mb-1.5 block">
                    Campagnes a decrypter
                  </Label>
                  <Input
                    type="search"
                    placeholder="Rechercher une campagne par titre ou marque..."
                    value={campaignFilter}
                    onChange={(e) => setCampaignFilter(e.target.value)}
                    className="mb-2"
                  />
                  <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200">
                    {filteredCampaigns.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500">
                        Aucune campagne trouvee.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {filteredCampaigns.map((c) => (
                          <li key={c.id}>
                            <label className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.campaign_ids.includes(c.id)}
                                onChange={() => toggleCampaign(c.id)}
                                className="h-4 w-4 accent-amber-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-900 truncate">
                                  {c.title}
                                </div>
                                {c.brand && (
                                  <div className="text-xs text-slate-500">
                                    {c.brand}
                                  </div>
                                )}
                              </div>
                              {c.status && (
                                <span className="text-xs text-slate-400">
                                  {c.status}
                                </span>
                              )}
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="mt-1.5 text-xs text-slate-500">
                    {form.campaign_ids.length} campagne(s) selectionnee(s)
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="notes" className="text-sm font-semibold">
                    Notes internes
                  </Label>
                  <textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={2}
                    className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Visible uniquement par l'equipe Big Five"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeForm}
                  disabled={isSaving}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : form.id ? (
                    "Enregistrer"
                  ) : (
                    "Creer la seance"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
