"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Tag,
  Copy,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface Registration {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  promo_code: string;
  mailchimp_status: string | null;
  mailchimp_synced_at: string | null;
  mailchimp_error: string | null;
  promo_redeemed_at: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  synced: number;
  redeemed: number;
}

export default function KeynoteAdminPage() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, synced: 0, redeemed: 0 });
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async (q?: string) => {
    setIsLoading(true);
    try {
      const url = q ? `/api/admin/keynote?q=${encodeURIComponent(q)}` : "/api/admin/keynote";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setRows(data.registrations || []);
      setStats(data.stats || { total: 0, synced: 0, redeemed: 0 });
    } catch (err: any) {
      toast.error(err.message || "Impossible de charger les inscriptions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(search);
  };

  const sync = async (onlyFailed: boolean) => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/admin/keynote/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyFailed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur sync");
      if ((data.total || 0) === 0) {
        toast.info("Aucun inscrit à synchroniser");
      } else {
        toast.success(`${data.synced} / ${data.total} synchronisés`);
      }
      if (data.usingMainAudience) {
        toast.warning(
          "Audience Keynote non configurée — utilisation de l'audience principale Mailchimp"
        );
      }
      if (data.errors?.length) {
        console.warn("Sync errors:", data.errors);
        const first = data.errors[0];
        toast.error(
          `${data.errors.length} erreur(s). Ex : ${first.email} → ${first.error}`,
          { duration: 8000 }
        );
      }
      fetchData(search);
    } catch (err: any) {
      toast.error(err.message || "Erreur de synchronisation");
    } finally {
      setIsSyncing(false);
    }
  };

  const exportCsv = () => {
    window.location.href = "/api/admin/keynote/export";
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

  const deleteByIds = async (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(`Supprimer ${ids.length} inscription(s) ? Cette action est irr\u00e9versible.`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/keynote/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur suppression");
      toast.success(`${data.deleted} inscription(s) supprim\u00e9e(s)`);
      setSelectedIds(new Set());
      fetchData(search);
    } catch (err: any) {
      toast.error(err.message || "Erreur de suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteFakes = async () => {
    if (
      !confirm(
        "D\u00e9tecter et supprimer tous les emails jetables / fake / test ? Action irr\u00e9versible."
      )
    )
      return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/keynote/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyFakes: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur suppression");
      if (data.deleted === 0) {
        toast.info("Aucun email fake d\u00e9tect\u00e9");
      } else {
        toast.success(`${data.deleted} email(s) fake supprim\u00e9(s)`);
        if (data.emails?.length) console.log("Fakes supprim\u00e9s:", data.emails);
      }
      setSelectedIds(new Set());
      fetchData(search);
    } catch (err: any) {
      toast.error(err.message || "Erreur de suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copié");
    } catch {
      toast.error("Copie impossible");
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
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 font-heading">
            Keynote — 21 mai 2026
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Inscriptions, codes promo de pré-lancement et synchronisation Mailchimp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" /> Exporter CSV
          </Button>
          <Button
            variant="outline"
            onClick={deleteFakes}
            disabled={isDeleting || isLoading}
            className="text-red-700 hover:bg-red-50 border-red-200"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4 mr-2" />
            )}
            Supprimer fakes
          </Button>
          <Button variant="outline" onClick={() => sync(true)} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Resync échecs
          </Button>
          <Button onClick={() => sync(false)} disabled={isSyncing} className="bg-amber-500 hover:bg-amber-600">
            {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Tout synchroniser
          </Button>
          <Button
            variant="outline"
            disabled={isImporting}
            onClick={async () => {
              setIsImporting(true);
              try {
                const res = await fetch("/api/admin/keynote/import", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erreur import");
                toast.success(
                  `${data.imported} importé${data.imported > 1 ? "s" : ""} · ${data.skipped} ignoré${data.skipped > 1 ? "s" : ""}`
                );
                if (data.errors?.length) {
                  console.warn("Import errors:", data.errors);
                  toast.warning(`${data.errors.length} erreur(s) — voir console`);
                }
                fetchData(search);
              } catch (err: any) {
                toast.error(err.message || "Import Mailchimp échoué");
              } finally {
                setIsImporting(false);
              }
            }}
          >
            {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Importer Mailchimp
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Inscriptions totales
            </CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Synchronisés Mailchimp
            </CardDescription>
            <CardTitle className="text-3xl">{stats.synced}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-amber-500" /> Codes utilisés
            </CardDescription>
            <CardTitle className="text-3xl">{stats.redeemed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par email, nom, code promo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" variant="outline">
              Rechercher
            </Button>
            {search && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  fetchData("");
                }}
              >
                Réinitialiser
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          <span className="text-sm font-medium text-amber-900">
            {selectedIds.size} inscription(s) sélectionnée(s)
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={isDeleting}
            >
              Annuler
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteByIds(Array.from(selectedIds))}
              disabled={isDeleting}
              className="text-red-700 hover:bg-red-50 border-red-200"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer la sélection
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">Aucune inscription pour l&apos;instant.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selectedIds.size === rows.length}
                      onChange={toggleSelectAll}
                      aria-label="Tout sélectionner"
                    />
                  </th>
                  <th className="text-left font-semibold px-4 py-3">Date</th>
                  <th className="text-left font-semibold px-4 py-3">Inscrit</th>
                  <th className="text-left font-semibold px-4 py-3">Email</th>
                  <th className="text-left font-semibold px-4 py-3">Pays</th>
                  <th className="text-left font-semibold px-4 py-3">Code promo</th>
                  <th className="text-left font-semibold px-4 py-3">Mailchimp</th>
                  <th className="text-left font-semibold px-4 py-3">Utilisé</th>
                  <th className="text-left font-semibold px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        aria-label={`Sélectionner ${r.email}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.email}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.country || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => copyCode(r.promo_code)}
                        className="inline-flex items-center gap-2 font-mono text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                        title="Copier"
                      >
                        {r.promo_code}
                        <Copy className="h-3 w-3" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <StatusBadge s={r.mailchimp_status} />
                        {r.mailchimp_error && (
                          <span className="text-[10px] text-red-500" title={r.mailchimp_error}>
                            {r.mailchimp_error.slice(0, 40)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {r.promo_redeemed_at
                        ? new Date(r.promo_redeemed_at).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => deleteByIds([r.id])}
                        disabled={isDeleting}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
                        title="Supprimer"
                        aria-label={`Supprimer ${r.email}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
