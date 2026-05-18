"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  RefreshCw,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Trash2,
  AlertTriangle,
  Sparkles,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Registration {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  topics_of_interest: string | null;
  preferred_channel: string | null;
  plan_at_signup: string;
  session_month: string;
  consent_contact: boolean;
  mailchimp_status: string | null;
  mailchimp_synced_at: string | null;
  mailchimp_error: string | null;
  source: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  synced: number;
  errors: number;
  pending: number;
}

export default function DecrypteAdminPage() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    synced: 0,
    errors: 0,
    pending: 0,
  });
  const [months, setMonths] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState<string>("");
  const [warning, setWarning] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(
    async (q?: string, m?: string) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (m) params.set("month", m);
        const url = `/api/admin/decrypte${
          params.toString() ? `?${params.toString()}` : ""
        }`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur");
        setRows(data.registrations || []);
        setStats(
          data.stats || { total: 0, synced: 0, errors: 0, pending: 0 }
        );
        setMonths(data.months || []);
        setWarning(data.warning || null);
        setWarningMessage(data.message || null);
      } catch (err: any) {
        toast.error(err.message || "Impossible de charger les inscriptions");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(search, month);
  };

  const onMonthChange = (m: string) => {
    setMonth(m);
    fetchData(search, m);
  };

  const sync = async (onlyFailed: boolean) => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/admin/decrypte/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyFailed, month: month || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur sync");
      if ((data.total || 0) === 0) {
        toast.info("Aucune inscription à synchroniser");
      } else {
        toast.success(`${data.synced} / ${data.total} synchronisé(s)`);
      }
      if (data.usingMainAudience) {
        toast.warning(
          "Audience #BigFiveDecrypte non configurée — utilisation de l'audience principale"
        );
      }
      if (data.errors?.length) {
        const first = data.errors[0];
        toast.error(
          `${data.errors.length} erreur(s). Ex : ${first.email} → ${first.error}`,
          { duration: 8000 }
        );
      }
      fetchData(search, month);
    } catch (err: any) {
      toast.error(err.message || "Erreur de synchronisation");
    } finally {
      setIsSyncing(false);
    }
  };

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    window.location.href = `/api/admin/decrypte/export${
      params.toString() ? `?${params.toString()}` : ""
    }`;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (
      !confirm(
        `Supprimer ${ids.length} inscription(s) ? Cette action est irréversible.`
      )
    )
      return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/decrypte/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(`${data.deleted} inscription(s) supprimée(s)`);
      setSelectedIds(new Set());
      fetchData(search, month);
    } catch (err: any) {
      toast.error(err.message || "Erreur de suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const StatusBadge = ({ s }: { s: string | null }) => {
    if (s === "subscribed")
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
          <CheckCircle2 className="h-3 w-3" /> Synchro
        </span>
      );
    if (s === "error")
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
          <XCircle className="h-3 w-3" /> Erreur
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
        <Clock className="h-3 w-3" /> En attente
      </span>
    );
  };

  return (
    <div className="p-6 lg:p-10 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 font-heading flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-orange-500" />
            #BigFiveDecrypte
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Inscriptions Pro aux sessions mensuelles de debrief, et
            synchronisation Mailchimp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/decrypte/sessions">
            <Button variant="outline">
              <Sparkles className="h-4 w-4 mr-2" /> Seances
            </Button>
          </Link>
          <Link href="/admin/mailchimp">
            <Button variant="outline">
              <Mail className="h-4 w-4 mr-2" /> Audience Mailchimp
            </Button>
          </Link>
          <Button variant="outline" onClick={exportCsv} disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" /> Exporter CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => sync(true)}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Resync échecs
          </Button>
          <Button
            onClick={() => sync(false)}
            disabled={isSyncing}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Tout synchroniser
          </Button>
        </div>
      </div>

      {warning === "table_missing" && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold mb-1">
                Table d'inscription non initialisée
              </p>
              <p>
                {warningMessage ||
                  "Appliquez le script SQL pour créer la table avant d'accepter des inscriptions."}
              </p>
              <p className="mt-2 font-mono text-xs bg-white border border-amber-200 rounded px-2 py-1 inline-block">
                scripts/bigfive-decrypte-registrations.sql
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Inscriptions
            </CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Synchro
              Mailchimp
            </CardDescription>
            <CardTitle className="text-3xl">{stats.synced}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" /> Erreurs sync
            </CardDescription>
            <CardTitle className="text-3xl">{stats.errors}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" /> En attente
            </CardDescription>
            <CardTitle className="text-3xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search + Filtre mois */}
      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={onSearch}
            className="flex flex-wrap gap-2 items-center"
          >
            <div className="relative flex-1 min-w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par email, nom, entreprise…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              aria-label="Filtrer par session"
              value={month}
              onChange={(e) => onMonthChange(e.target.value)}
              className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="">Toutes sessions</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Rechercher
            </Button>
            {(search || month) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setMonth("");
                  fetchData("", "");
                }}
              >
                Réinitialiser
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Actions selection */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-sm font-medium text-slate-700">
            {selectedIds.size} sélectionnée(s)
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              sync(false).then(() => undefined) /* sync sélection via ids */
            }
            className="ml-auto"
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Resync
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={deleteSelected}
            disabled={isDeleting}
            className="text-red-700 border-red-200 hover:bg-red-50"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            Supprimer
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin inline-block mr-2" />
              Chargement…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              Aucune inscription pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input
                        aria-label="Sélectionner toutes les inscriptions"
                        type="checkbox"
                        checked={
                          rows.length > 0 && selectedIds.size === rows.length
                        }
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-3 py-2">Inscrit</th>
                    <th className="px-3 py-2">Entreprise / Poste</th>
                    <th className="px-3 py-2">Session</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Mailchimp</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <Fragment key={r.id}>
                      <tr
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() =>
                          setExpandedId(expandedId === r.id ? null : r.id)
                        }
                      >
                        <td
                          className="px-3 py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            aria-label={`Sélectionner ${r.email}`}
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">
                            {r.full_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {r.email}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-slate-700">
                            {r.company || "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {r.job_title || ""}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.session_month}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.plan_at_signup}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge s={r.mailchimp_status} />
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString("fr-FR")}
                        </td>
                      </tr>
                      {expandedId === r.id && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase">
                                  Téléphone
                                </p>
                                <p className="text-slate-700">
                                  {r.phone || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase">
                                  Canal préféré
                                </p>
                                <p className="text-slate-700">
                                  {r.preferred_channel || "—"}
                                </p>
                              </div>
                              <div className="md:col-span-2">
                                <p className="text-xs font-medium text-slate-500 uppercase">
                                  Sujets d'intérêt
                                </p>
                                <p className="text-slate-700 whitespace-pre-wrap">
                                  {r.topics_of_interest || "—"}
                                </p>
                              </div>
                              {r.mailchimp_error && (
                                <div className="md:col-span-2">
                                  <p className="text-xs font-medium text-red-600 uppercase">
                                    Erreur Mailchimp
                                  </p>
                                  <p className="text-red-700 font-mono text-xs">
                                    {r.mailchimp_error}
                                  </p>
                                </div>
                              )}
                              {r.mailchimp_synced_at && (
                                <div>
                                  <p className="text-xs font-medium text-slate-500 uppercase">
                                    Dernière synchro
                                  </p>
                                  <p className="text-slate-700 text-xs">
                                    {new Date(
                                      r.mailchimp_synced_at
                                    ).toLocaleString("fr-FR")}
                                  </p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase">
                                  Source
                                </p>
                                <p className="text-slate-700 text-xs">
                                  {r.source || "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
