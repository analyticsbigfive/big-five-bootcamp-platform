"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAdmin } from "../AdminContext";
import type { ContentItem } from "@/components/dashboard/content-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Trash2,
  Edit,
  MoreVertical,
  Globe,
  Megaphone,
  Eye,
  ImagePlus,
  X,
  Video,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Send,
  FileText,
  Image,
  Sparkles,
  Check,
  Upload,
  Crown,
  Users,
  Star,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { CSVImporter } from "@/components/admin/csv-importer";
import { cn, getGoogleDriveImageUrl, generateSlug } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { detectVideoPlatform, getEmbedUrl, isSupportedVideoUrl, getYouTubeThumbnail, getVideoPlatformLabel, getOriginalVideoUrl } from "@/lib/video-utils";
import { ImageUpload, ImageUploadButton } from "@/components/ui/image-upload";
import { useTempsForts } from "@/components/temps-forts/use-temps-forts";

const FALLBACK_PLATFORMS = ["Facebook", "Instagram", "TikTok", "YouTube", "LinkedIn", "Twitter/X"];
const countries = ["Bénin", "Côte d'Ivoire", "Sénégal", "Burkina Faso", "Togo", "Guinée"];
const FALLBACK_SECTORS = ["Telecoms", "E-commerce", "Banque/Finance", "FMCG", "Tech", "Energie", "Industrie"];
const formats = ["Story", "Carrousel", "Vidéo", "Image", "Photo", "Vidéos Ad", "Image Ad", "Carrousel Ad"];
const FALLBACK_AXES = [
  "Focus produit", "Bénéfice produit", "Démonstration", "Utilisation",
  "Offre / Promotion", "Storytelling", "Transparence", "Humanisation",
  "RSE", "Langage de la cible", "Preuve sociale", "Gamification intelligente", "Education"
];
const statuses = ["Brouillon", "En attente", "Publié"] as const;

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
}

function withFallback(values: string[], fallback: string[]): string[] {
  return values.length > 0 ? values : fallback;
}

const FORM_STEPS = [
  { id: 1, title: "Informations", icon: FileText, description: "Détails de base" },
  { id: 2, title: "Médias", icon: Image, description: "Images et vidéos" },
  { id: 3, title: "Analyse", icon: Sparkles, description: "Analyse et pourquoi cet axe" },
];

/**
 * Convertit une URL vidéo en URL embed (multi-plateforme)
 * Wrapper local autour de getEmbedUrl pour lisibilité
 */
function convertToVideoEmbed(url: string): string {
  return getEmbedUrl(url);
}

/**
 * Récupère l'URL Facebook originale à partir d'une URL qui pourrait déjà être embed
 * Utilisé pour normaliser les URLs collées par les admins
 */
function normalizeVideoUrl(url: string): string {
  return getOriginalVideoUrl(url);
}

const defaultFormData: Omit<ContentItem, "id"> = {
  title: "",
  summary: "",
  description: "",
  imageUrl: "",
  images: [],
  videoUrl: "",
  platform: "Facebook",
  country: "Côte d'Ivoire",
  sector: "Telecoms",
  format: "Story",
  axe: [],
  tags: [],
  date: "",
  brand: "",
  agency: "",
  year: new Date().getFullYear(),
  isVideo: false,
  status: "Brouillon",
  accessLevel: "free",
  analyse: "",
  howToUse: "",
  slug: "",
  featured: false,
  publicationUrl: "",
  tempsFortSlugs: [],
};

function CampaignsPageContent() {
  const { campaigns, addCampaign, updateCampaign, deleteCampaign, isUsingLocalData, refreshCampaigns, userEmail } = useAdmin();
  const { tempsForts: TEMPS_FORTS } = useTempsForts();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSector, setFilterSector] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<ContentItem | null>(null);
  const [formData, setFormData] = useState<Omit<ContentItem, "id">>(defaultFormData);
  const [tagInput, setTagInput] = useState("");
  const [imageInput, setImageInput] = useState("");
  const [previewCampaign, setPreviewCampaign] = useState<ContentItem | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const ITEMS_PER_PAGE = 20;

  const campaignOptions = useMemo(() => {
    const allTags: string[] = [];
    const allAxes: string[] = [];

    campaigns.forEach((campaign) => {
      campaign.tags?.forEach((tag) => allTags.push(tag));
      campaign.axe?.forEach((axe) => allAxes.push(axe));
    });

    return {
      platforms: withFallback(uniqueSorted(campaigns.map((campaign) => campaign.platform)), FALLBACK_PLATFORMS),
      countries: withFallback(uniqueSorted(campaigns.map((campaign) => campaign.country)), countries),
      sectors: withFallback(uniqueSorted(campaigns.map((campaign) => campaign.sector)), FALLBACK_SECTORS),
      formats: withFallback(uniqueSorted(campaigns.map((campaign) => campaign.format)), formats),
      axes: withFallback(uniqueSorted(allAxes), FALLBACK_AXES),
      tags: uniqueSorted(allTags),
    };
  }, [campaigns]);

  const existingTags = campaignOptions.tags;

  // Filtrer les suggestions de tags basées sur l'input
  const filteredTagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return existingTags.slice(0, 10);
    return existingTags
      .filter((tag) => 
        tag.toLowerCase().includes(tagInput.toLowerCase()) &&
        !formData.tags.includes(tag)
      )
      .slice(0, 10);
  }, [tagInput, existingTags, formData.tags]);

  // Ouvrir automatiquement le formulaire si ?action=new
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setEditingCampaign(null);
      setFormData(defaultFormData);
      setTagInput("");
      setImageInput("");
      setIsDialogOpen(true);
    }
  }, [searchParams]);

  // Ouvrir automatiquement l'édition si ?edit=CAMPAIGN_ID
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && campaigns.length > 0) {
      const campaignToEdit = campaigns.find((c) => c.id === editId);
      if (campaignToEdit) {
        handleOpenEdit(campaignToEdit);
        setIsDialogOpen(true);
      }
    }
  }, [searchParams, campaigns]);

  const filteredCampaigns = campaigns.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.agency || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = filterSector === "all" || item.sector === filterSector;
    const tempsFortFilter = searchParams.get("temps_fort");
    const matchesTempsFort = !tempsFortFilter || (item.tempsFortSlugs || []).includes(tempsFortFilter);
    return matchesSearch && matchesSector && matchesTempsFort;
  });

  const totalPages = Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE);
  const paginatedCampaigns = filteredCampaigns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleOpenAdd = () => {
    setEditingCampaign(null);
    setFormData(defaultFormData);
    setTagInput("");
    setImageInput("");
    setCurrentStep(1);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: ContentItem) => {
    setEditingCampaign(item);
    setFormData({
      title: item.title,
      summary: item.summary || "",
      description: item.description,
      imageUrl: item.imageUrl,
      images: item.images || [],
      videoUrl: item.videoUrl || "",
      platform: item.platform,
      country: item.country,
      sector: item.sector,
      format: item.format,
      tags: item.tags,
      date: item.date,
      brand: item.brand || "",
      agency: item.agency || "",
      year: item.year || new Date().getFullYear(),
      isVideo: item.isVideo || false,
      status: item.status || "Brouillon",
      accessLevel: item.accessLevel || "free",
      slug: item.slug || "",
      axe: item.axe || [],
      analyse: item.analyse || "",
      howToUse: item.howToUse || "",
      featured: item.featured || false,
      publicationUrl: item.publicationUrl || "",
      tempsFortSlugs: item.tempsFortSlugs || [],
    });
    setTagInput("");
    setImageInput("");
    setCurrentStep(1);
    setIsDialogOpen(true);
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
  };

  const handleAddImage = () => {
    const url = imageInput.trim();
    if (url && !(formData.images || []).includes(url)) {
      setFormData({ ...formData, images: [...(formData.images || []), url] });
      setImageInput("");
    }
  };

  const handleRemoveImage = (url: string) => {
    setFormData({ ...formData, images: (formData.images || []).filter((img) => img !== url) });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }
    
    // Sauvegarder l'URL originale de la vidéo (la conversion embed se fait à l'affichage)
    const processedFormData = {
      ...formData,
      videoUrl: formData.videoUrl ? getOriginalVideoUrl(formData.videoUrl.trim()) : "",
      // Auto-générer le slug si vide
      slug: formData.slug || generateSlug(formData.title),
    };
    
    if (editingCampaign) {
      await updateCampaign(editingCampaign.id, processedFormData);
    } else {
      await addCampaign(processedFormData);
    }
    setIsDialogOpen(false);
    setCurrentStep(1);
  };

  const handleDelete = async (id: string) => {
    await deleteCampaign(id);
  };

  const handlePublish = async (item: ContentItem) => {
    const newStatus = item.status === "Publié" ? "Brouillon" : "Publié";
    await updateCampaign(item.id, { status: newStatus });
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
    if (selectedIds.size === paginatedCampaigns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedCampaigns.map((c) => c.id)));
    }
  };

  const handleBatchDelete = async () => {
    setIsBatchDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await deleteCampaign(id);
      }
      toast.success(`${ids.length} campagne${ids.length > 1 ? "s" : ""} supprimée${ids.length > 1 ? "s" : ""}`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsBatchDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const sectorColor = (sector: string) => {
    const colors: Record<string, string> = {
      Telecoms: "bg-blue-100 text-blue-700",
      "E-commerce": "bg-[#F5F5F5] text-[#0F0F0F]",
      "Banque/Finance": "bg-[#F5F5F5] text-[#0F0F0F]",
      FMCG: "bg-orange-100 text-orange-700",
      Tech: "bg-cyan-100 text-cyan-700",
      Energie: "bg-yellow-100 text-yellow-700",
      Industrie: "bg-slate-100 text-slate-700",
    };
    return colors[sector] || "bg-gray-100 text-gray-600";
  };

  return (
    <div className="space-y-6">
      {/* Avertissement si données de test */}
      {isUsingLocalData && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-800">Mode démonstration</h3>
            <p className="text-sm text-amber-700 mt-1">
              Vous voyez des données d'exemple car la connexion à la base de données n'est pas disponible.
              {userEmail && (
                <span className="block mt-1">
                  <strong>Connecté avec :</strong> {userEmail}
                </span>
              )}
              {!userEmail && (
                <span className="block mt-1 text-red-600">
                  ⚠️ Aucune session détectée. Veuillez vous reconnecter.
                </span>
              )}
            </p>
            <div className="flex gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-amber-700 border-amber-300 hover:bg-amber-100"
                onClick={() => refreshCampaigns()}
              >
                Réessayer la connexion
              </Button>
              {!userEmail && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                  onClick={() => window.location.href = '/admin/login'}
                >
                  Se reconnecter
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-[family-name:var(--font-heading)]">
            Exemples de Campagnes
          </h1>
          <p className="text-gray-500 mt-1">
            Gerez les exemples de campagnes affiches sur la plateforme ({campaigns.length} campagnes)
          </p>
        </div>
        <div className="flex gap-2">
          <CSVImporter onImportComplete={() => refreshCampaigns()} />
          <Button onClick={handleOpenAdd} className="bg-[#FF6B35] hover:bg-[#e55a2b] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une campagne
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par titre, marque ou agence..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <Select value={filterSector} onValueChange={(v) => { setFilterSector(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px] bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Filtrer par secteur" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 text-gray-900">
                <SelectItem value="all">Tous les secteurs</SelectItem>
                {campaignOptions.sectors.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selectedIds.size === paginatedCampaigns.length}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm font-medium text-red-800">
              {selectedIds.size} campagne{selectedIds.size > 1 ? "s" : ""} sélectionnée{selectedIds.size > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-gray-600 hover:text-gray-900"
            >
              Tout désélectionner
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer la sélection
            </Button>
          </div>
        </div>
      )}

      {/* Campaign List */}
      <div className="grid gap-4">
        {/* Select All row */}
        {filteredCampaigns.length > 0 && selectedIds.size === 0 && (
          <div className="flex items-center gap-3 px-4 py-2">
            <Checkbox
              checked={false}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs text-gray-400">Tout sélectionner</span>
          </div>
        )}
        {filteredCampaigns.length === 0 ? (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-8 text-center">
              <Megaphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucune campagne trouvee</p>
            </CardContent>
          </Card>
        ) : (
          paginatedCampaigns.map((item) => (
            <Card key={item.id} className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Checkbox de sélection */}
                    <div className="flex-shrink-0 pt-1">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </div>
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                      {item.imageUrl ? (
                        <img
                          src={getGoogleDriveImageUrl(item.imageUrl)}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Megaphone className="h-6 w-6 text-[#FF6B35]" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 font-medium truncate">{item.title}</h3>
                      <p className="text-gray-500 text-sm mt-0.5 truncate">
                        {item.brand && <span>{item.brand}</span>}
                        {item.agency && <span> - {item.agency}</span>}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {/* Badge de statut */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.status === "Publié" ? "bg-green-100 text-green-700" :
                          item.status === "En attente" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            item.status === "Publié" ? "bg-green-500" :
                            item.status === "En attente" ? "bg-yellow-500" :
                            "bg-gray-400"
                          }`}></span>
                          {item.status || "Brouillon"}
                        </span>
                        {/* Badge Premium/Gratuit */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.accessLevel === "premium" 
                            ? "bg-amber-100 text-amber-700" 
                            : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {item.accessLevel === "premium" ? (
                            <><Crown className="h-3 w-3" /> Premium</>
                          ) : (
                            <><Users className="h-3 w-3" /> Gratuit</>
                          )}
                        </span>
                        {/* Badge Featured */}
                        {item.featured && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#F2B33D]/20 text-[#b45309]">
                            <Star className="h-3 w-3 fill-current" /> Semaine
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sectorColor(item.sector)}`}>
                          {item.sector}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <Globe className="h-3 w-3 mr-1" />
                          {item.country}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {item.platform}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {item.format}
                        </span>
                        {item.date && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {item.date}
                          </span>
                        )}
                      </div>
                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#FF6B35]/20 text-[#FF6B35]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-gray-200 text-gray-900 shadow-lg">
                      <DropdownMenuItem
                        onClick={() => setPreviewCampaign(item)}
                        className="hover:bg-gray-100 cursor-pointer"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Apercu
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => window.open(`/content/${item.slug || item.id}`, '_blank')}
                        className="hover:bg-gray-100 cursor-pointer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Voir le détail
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handlePublish(item)}
                        className={`hover:bg-gray-100 cursor-pointer ${
                          item.status === "Publié" ? "text-yellow-600" : "text-green-600"
                        }`}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {item.status === "Publié" ? "Dépublier" : "Publier"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateCampaign(item.id, { featured: !item.featured })}
                        className={`hover:bg-gray-100 cursor-pointer ${
                          item.featured ? "text-[#b45309]" : "text-gray-600"
                        }`}
                      >
                        <Star className={`h-4 w-4 mr-2 ${item.featured ? "fill-current" : ""}`} />
                        {item.featured ? "Retirer de la semaine" : "Campagne de la semaine"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleOpenEdit(item)}
                        className="hover:bg-gray-100 cursor-pointer"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Affichage {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredCampaigns.length)} sur {filteredCampaigns.length} campagnes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="text-gray-700 border-gray-300"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Précédent
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  if (totalPages <= 7) return true;
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .map((page, idx, arr) => (
                  <span key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-1 text-gray-400">…</span>
                    )}
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={currentPage === page ? "bg-[#FF6B35] hover:bg-[#e55a2b] text-white min-w-[36px]" : "text-gray-700 border-gray-300 min-w-[36px]"}
                    >
                      {page}
                    </Button>
                  </span>
                ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="text-gray-700 border-gray-300"
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewCampaign} onOpenChange={() => { setPreviewCampaign(null); setPreviewImageIndex(0); }}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-[600px] max-h-[90vh] overflow-y-auto shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{previewCampaign?.title}</DialogTitle>
            <DialogDescription className="sr-only">Aperçu de la campagne</DialogDescription>
          </DialogHeader>
          {previewCampaign && (() => {
            const allImages = [previewCampaign.imageUrl, ...(previewCampaign.images || [])].filter(Boolean).map(getGoogleDriveImageUrl);
            const embedVideoUrl = previewCampaign.videoUrl ? convertToVideoEmbed(previewCampaign.videoUrl) : "";
            return (
              <div className="space-y-4">
                {allImages.length > 0 && (
                  <div className="relative rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={allImages[previewImageIndex] || ""}
                      alt={`${previewCampaign.title} - ${previewImageIndex + 1}`}
                      className="w-full h-48 object-cover"
                    />
                    {allImages.length > 1 && (
                      <>
                        <button
                          onClick={() => setPreviewImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                          title="Image précédente"
                          aria-label="Image précédente"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setPreviewImageIndex((prev) => (prev + 1) % allImages.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                          title="Image suivante"
                          aria-label="Image suivante"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                          {allImages.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setPreviewImageIndex(i)}
                              className={`w-2 h-2 rounded-full ${i === previewImageIndex ? "bg-[#FF6B35]" : "bg-white/50"}`}
                              title={`Aller à l'image ${i + 1}`}
                              aria-label={`Aller à l'image ${i + 1}`}
                            />
                          ))}
                        </div>
                        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                          {previewImageIndex + 1} / {allImages.length}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {embedVideoUrl && (
                  <div className="rounded-lg overflow-hidden">
                    <div className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                      <Video className="h-3 w-3" /> Vidéo
                    </div>
                    <iframe
                      src={embedVideoUrl}
                      title={`Vidéo: ${previewCampaign.title}`}
                      className="w-full aspect-video rounded-lg border border-gray-200"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                )}
                {previewCampaign.description && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Description</h4>
                    <div
                      className="text-gray-600 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewCampaign.description) }}
                    />
                  </div>
                )}
                {previewCampaign.analyse && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Analyse</h4>
                    <div
                      className="text-gray-600 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewCampaign.analyse) }}
                    />
                  </div>
                )}
                {previewCampaign.howToUse && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Comment s'en servir</h4>
                    <div
                      className="text-gray-600 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewCampaign.howToUse) }}
                    />
                  </div>
                )}
                {previewCampaign.summary && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Résumé</h4>
                    <div
                      className="text-gray-600 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewCampaign.summary) }}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-lg p-4">
                  <div>
                    <span className="text-gray-500">Marque:</span>{" "}
                    <span className="text-gray-900 font-medium">{previewCampaign.brand || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Agence:</span>{" "}
                    <span className="text-gray-900 font-medium">{previewCampaign.agency || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Plateforme:</span>{" "}
                    <span className="text-gray-900 font-medium">{previewCampaign.platform}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Pays:</span>{" "}
                    <span className="text-gray-900 font-medium">{previewCampaign.country}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Secteur:</span>{" "}
                    <span className="text-gray-900 font-medium">{previewCampaign.sector}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Format:</span>{" "}
                    <span className="text-gray-900 font-medium">{previewCampaign.format}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Date:</span>{" "}
                    <span className="text-gray-900 font-medium">{previewCampaign.date || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Année:</span>{" "}
                    <span className="text-gray-900 font-medium">{previewCampaign.year || "-"}</span>
                  </div>
                </div>
                {previewCampaign.tags.length > 0 && (
                  <div>
                    <span className="text-gray-500 text-sm">Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {previewCampaign.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog - Multi-Step Form */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setCurrentStep(1);
      }}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {editingCampaign ? "Modifier la campagne" : "Ajouter une campagne"}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {editingCampaign
                ? "Modifiez les informations de la campagne."
                : "Remplissez les informations pour creer une nouvelle campagne."}
            </DialogDescription>
          </DialogHeader>

          {/* Stepper Header */}
          <div className="flex items-center justify-between px-2 py-4 border-b border-gray-200">
            {FORM_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div 
                  className={cn(
                    "flex items-center cursor-pointer",
                    currentStep >= step.id ? "opacity-100" : "opacity-50"
                  )}
                  onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                >
                  <div 
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                      currentStep === step.id 
                        ? "border-primary bg-primary text-white" 
                        : currentStep > step.id 
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-gray-300 text-gray-400"
                    )}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <step.icon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="ml-2 hidden sm:block">
                    <p className={cn(
                      "text-xs font-medium",
                      currentStep === step.id ? "text-gray-900" : "text-gray-500"
                    )}>
                      {step.title}
                    </p>
                  </div>
                </div>
                {index < FORM_STEPS.length - 1 && (
                  <div 
                    className={cn(
                      "w-8 sm:w-16 h-0.5 mx-2",
                      currentStep > step.id ? "bg-green-500" : "bg-gray-200"
                    )} 
                  />
                )}
              </div>
            ))}
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 px-1">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="camp-title" className="text-gray-700">Titre *</Label>
                  <Input
                    id="camp-title"
                    value={formData.title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      const updates: any = { title: newTitle };
                      // Auto-générer le slug si c'est une nouvelle campagne ou si le slug est vide
                      if (!editingCampaign || !formData.slug) {
                        updates.slug = generateSlug(newTitle);
                      }
                      setFormData({ ...formData, ...updates });
                    }}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                    placeholder="Ex: MTN Ghana - Mobile Money Campaign"
                  />
                </div>

                {/* Permalien / Slug */}
                <div className="space-y-2">
                  <Label htmlFor="camp-slug" className="text-gray-700">
                    Permalien (URL SEO)
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 whitespace-nowrap">/content/</span>
                    <Input
                      id="camp-slug"
                      value={formData.slug || ""}
                      onChange={(e) => {
                        // Nettoyer le slug en temps réel
                        const cleaned = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9\s-]/g, '')
                          .replace(/\s+/g, '-')
                          .replace(/-+/g, '-');
                        setFormData({ ...formData, slug: cleaned });
                      }}
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 font-mono text-sm"
                      placeholder="mon-titre-de-campagne"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-gray-300 text-gray-600 hover:bg-gray-100 whitespace-nowrap text-xs"
                      onClick={() => setFormData({ ...formData, slug: generateSlug(formData.title) })}
                      title="Regénérer depuis le titre"
                    >
                      🔄 Auto
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    URL finale : <span className="font-mono text-primary">/content/{formData.slug || "..."}</span> — Idéal pour le référencement (SEO)
                  </p>
                </div>

                {/* Summary - Résumé */}
                <div className="space-y-2">
                  <Label htmlFor="camp-summary" className="text-gray-700">Résumé</Label>
                  <Input
                    id="camp-summary"
                    value={formData.summary || ""}
                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                    placeholder="Une phrase qui résume la campagne..."
                    maxLength={150}
                  />
                  <p className="text-xs text-gray-500">
                    Court résumé affiché sur les cartes (max. 150 caractères)
                  </p>
                </div>

                {/* Brand & Agency */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="camp-brand" className="text-gray-700">Marque</Label>
                    <Input
                      id="camp-brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                      placeholder="Ex: MTN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="camp-agency" className="text-gray-700">Agence</Label>
                    <Input
                      id="camp-agency"
                      value={formData.agency}
                      onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                      placeholder="Ex: Ogilvy Africa"
                    />
                  </div>
                </div>

                {/* Platform & Country */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <SingleCheckboxGroup
                    label="Plateforme"
                    options={campaignOptions.platforms}
                    value={formData.platform}
                    onChange={(value) => setFormData({ ...formData, platform: value })}
                  />
                  <SingleCheckboxGroup
                    label="Pays"
                    options={campaignOptions.countries}
                    value={formData.country}
                    onChange={(value) => setFormData({ ...formData, country: value })}
                  />
                </div>

                {/* Sector & Format */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <SingleCheckboxGroup
                    label="Secteur"
                    options={campaignOptions.sectors}
                    value={formData.sector}
                    onChange={(value) => setFormData({ ...formData, sector: value })}
                  />
                  <SingleCheckboxGroup
                    label="Format"
                    options={campaignOptions.formats}
                    value={formData.format}
                    onChange={(value) => setFormData({ ...formData, format: value })}
                  />
                </div>

                {/* Axe (multi-select checkboxes) */}
                <div className="space-y-2">
                  <Label className="text-gray-700">Axe(s)</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 border border-gray-300 rounded-md bg-white max-h-48 overflow-y-auto">
                    {campaignOptions.axes.map((a) => (
                      <label key={a} className="flex items-center gap-2 cursor-pointer text-sm text-gray-900 hover:bg-gray-50 rounded px-1 py-0.5">
                        <Checkbox
                          checked={(formData.axe || []).includes(a)}
                          onCheckedChange={(checked) => {
                            const current = formData.axe || [];
                            setFormData({
                              ...formData,
                              axe: checked
                                ? [...current, a]
                                : current.filter((x) => x !== a),
                            });
                          }}
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Temps forts associés (multi-select checkboxes) */}
                <div className="space-y-2">
                  <Label className="text-gray-700">Temps forts associés</Label>
                  <p className="text-xs text-gray-500">Cochez les événements auxquels cette campagne se rattache (ex: Coupe du monde, Ramadan…).</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border border-gray-300 rounded-md bg-white max-h-56 overflow-y-auto">
                    {TEMPS_FORTS.map((tf) => (
                      <label key={tf.slug} className="flex items-center gap-2 cursor-pointer text-sm text-gray-900 hover:bg-gray-50 rounded px-1 py-0.5">
                        <Checkbox
                          checked={(formData.tempsFortSlugs || []).includes(tf.slug)}
                          onCheckedChange={(checked) => {
                            const current = formData.tempsFortSlugs || [];
                            setFormData({
                              ...formData,
                              tempsFortSlugs: checked
                                ? [...current, tf.slug]
                                : current.filter((s) => s !== tf.slug),
                            });
                          }}
                        />
                        <span className="flex-1">
                          <span className="font-medium">{tf.shortTitle || tf.title}</span>
                          <span className="ml-1 text-xs text-gray-500">· {tf.category}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Date & Year */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="camp-date" className="text-gray-700">Date de la campagne</Label>
                    <DatePicker
                      date={formData.date ? new Date(formData.date) : undefined}
                      onDateChange={(date) => {
                        if (date) {
                          const formattedDate = date.toISOString().split('T')[0];
                          setFormData({ 
                            ...formData, 
                            date: formattedDate,
                            year: date.getFullYear()
                          });
                        } else {
                          setFormData({ ...formData, date: "" });
                        }
                      }}
                      placeholder="Sélectionner une date"
                      displayFormat="dd MMM yyyy"
                      className="bg-white border-gray-300 text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="camp-year" className="text-gray-700">Annee</Label>
                    <Input
                      id="camp-year"
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                      className="bg-white border-gray-300 text-gray-900"
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-gray-700">Statut de publication</Label>
                  <Select
                    value={formData.status || "Brouillon"}
                    onValueChange={(value: "Brouillon" | "En attente" | "Publié") => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 text-gray-900">
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          <span className={`inline-flex items-center gap-2 ${
                            s === "Publié" ? "text-green-600" : 
                            s === "En attente" ? "text-yellow-600" : 
                            "text-gray-500"
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${
                              s === "Publié" ? "bg-green-500" : 
                              s === "En attente" ? "bg-yellow-500" : 
                              "bg-gray-400"
                            }`}></span>
                            {s}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Access Level */}
                <div className="space-y-2">
                  <Label className="text-gray-700">Niveau d'accès</Label>
                  <Select
                    value={formData.accessLevel || "free"}
                    onValueChange={(value: "free" | "premium") => setFormData({ ...formData, accessLevel: value })}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 text-gray-900">
                      <SelectItem value="free">
                        <span className="inline-flex items-center gap-2 text-green-600">
                          <Users className="h-4 w-4" />
                          Gratuit - Visible par tous
                        </span>
                      </SelectItem>
                      <SelectItem value="premium">
                        <span className="inline-flex items-center gap-2 text-amber-600">
                          <Crown className="h-4 w-4" />
                          Premium - Accessible avec Basic ou Pro
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Les campagnes Premium ne sont pas visibles sur la page Démo.
                  </p>
                </div>

                {/* Featured - Campagne de la semaine */}
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all",
                      formData.featured
                        ? "border-[#F2B33D] bg-[#F2B33D]/10"
                        : "border-gray-300 bg-white group-hover:border-[#F2B33D]/50"
                    )}>
                      <Star className={cn(
                        "h-5 w-5 transition-colors",
                        formData.featured ? "text-[#F2B33D] fill-[#F2B33D]" : "text-gray-400"
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">Campagne de la semaine</span>
                        <Checkbox
                          checked={formData.featured || false}
                          onCheckedChange={(checked) => setFormData({ ...formData, featured: !!checked })}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Mise en avant dans la section « Meilleures campagnes de la semaine » du dashboard.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Lien vers la publication d'origine */}
                <div className="space-y-2">
                  <Label htmlFor="camp-publication-url" className="text-gray-700 flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-[#F2B33D]" />
                    Lien vers la publication d'origine
                  </Label>
                  <Input
                    id="camp-publication-url"
                    type="url"
                    value={formData.publicationUrl || ""}
                    onChange={(e) => setFormData({ ...formData, publicationUrl: e.target.value })}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                    placeholder="https://www.facebook.com/... ou https://www.instagram.com/p/..."
                  />
                  <p className="text-xs text-gray-500">
                    URL de la publication originale sur les réseaux sociaux (Facebook, Instagram, LinkedIn, etc.)
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Media */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Image principale — Upload */}
                <ImageUpload
                  value={formData.imageUrl ? getGoogleDriveImageUrl(formData.imageUrl) : formData.imageUrl}
                  onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                  label="Image principale (thumbnail) *"
                  required
                  previewClassName="w-40 h-40"
                />

                {/* Images supplementaires - Champs répétables */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-700">Visuels supplémentaires (carousel)</Label>
                    <span className="text-xs text-gray-500">
                      {(formData.images || []).length} image{(formData.images || []).length !== 1 ? 's' : ''} ajoutée{(formData.images || []).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {/* Liste des images existantes avec champs éditables */}
                  <div className="space-y-2">
                    {(formData.images || []).map((img, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                        {/* Miniature */}
                        <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                          {img ? (
                            <img src={getGoogleDriveImageUrl(img)} alt={`Visuel ${idx + 1}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <ImagePlus className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        
                        {/* Numéro et input */}
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-medium w-6">#{idx + 1}</span>
                          <Input
                            value={img}
                            onChange={(e) => {
                              const newImages = [...(formData.images || [])];
                              newImages[idx] = e.target.value;
                              setFormData({ ...formData, images: newImages });
                            }}
                            className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 text-sm"
                            placeholder="URL de l'image..."
                          />
                        </div>
                        
                        {/* Boutons d'action */}
                        <div className="flex items-center gap-1">
                          {/* Monter */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-gray-600"
                            onClick={() => {
                              if (idx > 0) {
                                const newImages = [...(formData.images || [])];
                                [newImages[idx - 1], newImages[idx]] = [newImages[idx], newImages[idx - 1]];
                                setFormData({ ...formData, images: newImages });
                              }
                            }}
                            disabled={idx === 0}
                            title="Monter"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          
                          {/* Descendre */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-gray-600"
                            onClick={() => {
                              const images = formData.images || [];
                              if (idx < images.length - 1) {
                                const newImages = [...images];
                                [newImages[idx], newImages[idx + 1]] = [newImages[idx + 1], newImages[idx]];
                                setFormData({ ...formData, images: newImages });
                              }
                            }}
                            disabled={idx === (formData.images || []).length - 1}
                            title="Descendre"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          
                          {/* Supprimer */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveImage(img)}
                            title="Supprimer"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Boutons pour ajouter une nouvelle image */}
                  <div className="flex gap-2">
                    <ImageUploadButton
                      onUploaded={(url) => {
                        setFormData({ ...formData, images: [...(formData.images || []), url] });
                      }}
                      className="flex-1"
                    />
                    <div className="flex gap-2 flex-1">
                      <Input
                        value={imageInput}
                        onChange={(e) => setImageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddImage();
                          }
                        }}
                        className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                        placeholder="Ou coller une URL..."
                      />
                      <Button
                        type="button"
                        onClick={handleAddImage}
                        variant="outline"
                        className="border-gray-300 text-gray-700 hover:bg-gray-100 gap-2"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500">
                    💡 Astuce : Uploadez ou collez des URLs pour créer un carousel. Réorganisez l'ordre avec les flèches.
                  </p>
                </div>

                {/* Video checkbox — Ceci est une publication vidéo */}
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="camp-video"
                      checked={formData.isVideo || false}
                      onCheckedChange={(checked) => setFormData({ ...formData, isVideo: !!checked })}
                    />
                    <Label htmlFor="camp-video" className="cursor-pointer text-gray-700 font-medium">
                      <Video className="h-4 w-4 inline mr-1.5" />
                      Ceci est une publication vidéo
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">
                    Cochez si la campagne est principalement une vidéo (Facebook, YouTube, LinkedIn, Twitter/X). 
                    La thumbnail sera récupérée automatiquement depuis le réseau social.
                  </p>
                </div>

                {/* URL Video — Visible uniquement si isVideo est coché */}
                {formData.isVideo && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="camp-video-url" className="text-gray-700">
                      <Video className="h-4 w-4 inline mr-1" />
                      URL de la vidéo
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="camp-video-url"
                        value={formData.videoUrl || ""}
                        onChange={(e) => {
                          const newUrl = e.target.value;
                          setFormData({ ...formData, videoUrl: newUrl });
                        }}
                        className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                        placeholder="https://facebook.com/.../videos/... ou youtube.com/watch?v=... ou x.com/.../status/..."
                      />
                      {formData.videoUrl && formData.videoUrl.trim() && (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-[#F2B33D] text-[#F2B33D] hover:bg-[#F2B33D]/10 whitespace-nowrap"
                          onClick={async () => {
                            const videoUrl = formData.videoUrl?.trim();
                            if (!videoUrl) return;
                            
                            toast.info("Récupération de la thumbnail...");
                            
                            try {
                              // YouTube: thumbnail synchrone
                              const platform = detectVideoPlatform(videoUrl);
                              if (platform === "youtube") {
                                const thumb = getYouTubeThumbnail(videoUrl);
                                if (thumb) {
                                  setFormData({ ...formData, imageUrl: thumb });
                                  toast.success("Thumbnail YouTube récupérée !");
                                  return;
                                }
                              }
                              
                              // Autres plateformes: appel API
                              const res = await fetch(`/api/video-thumbnail?url=${encodeURIComponent(videoUrl)}`);
                              const data = await res.json();
                              
                              if (data.success && data.thumbnailUrl) {
                                setFormData({ ...formData, imageUrl: data.thumbnailUrl });
                                toast.success(`Thumbnail ${getVideoPlatformLabel(data.platform)} récupérée !`);
                              } else {
                                toast.warning("Impossible de récupérer la thumbnail automatiquement. Ajoutez-la manuellement.");
                              }
                            } catch {
                              toast.error("Erreur lors de la récupération de la thumbnail");
                            }
                          }}
                        >
                          🖼️ Récupérer thumbnail
                        </Button>
                      )}
                    </div>
                    
                    {/* Indicateur de plateforme détectée */}
                    {formData.videoUrl && formData.videoUrl.trim() && (
                      <div className="flex items-center gap-2">
                        {(() => {
                          const platform = detectVideoPlatform(formData.videoUrl || "");
                          const platformStyles: Record<string, string> = {
                            youtube: "bg-red-100 text-red-700",
                            facebook: "bg-blue-100 text-blue-700",
                            twitter: "bg-gray-100 text-gray-700",
                            linkedin: "bg-sky-100 text-sky-700",
                            unknown: "bg-yellow-100 text-yellow-700",
                          };
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${platformStyles[platform]}`}>
                              {platform === "unknown" ? "⚠️ Plateforme non reconnue" : `✓ ${getVideoPlatformLabel(platform)} détecté`}
                            </span>
                          );
                        })()}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500">
                      💡 Plateformes supportées : YouTube, Facebook, LinkedIn, Twitter/X. Collez le lien de la publication vidéo.
                    </p>
                    
                    {/* Aperçu vidéo embed */}
                    {formData.videoUrl && formData.videoUrl.trim() && isSupportedVideoUrl(formData.videoUrl) && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                        <iframe
                          src={convertToVideoEmbed(formData.videoUrl)}
                          title="Aperçu vidéo"
                          className="w-full aspect-video"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Description & Tags */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Description with WYSIWYG */}
                <div className="space-y-2">
                  <Label className="text-gray-700">Description</Label>
                  <RichTextEditor
                    content={formData.description}
                    onChange={(content) => setFormData({ ...formData, description: content })}
                    placeholder="Décrivez la campagne, son contexte, ses objectifs..."
                    className="bg-white border-gray-300"
                  />
                </div>

                {/* Analyse with WYSIWYG — saves to analyse in DB */}
                <div className="space-y-2">
                  <Label className="text-gray-700">Analyse</Label>
                  <RichTextEditor
                    content={formData.analyse || ""}
                    onChange={(content) => setFormData({ ...formData, analyse: content })}
                    placeholder="Analysez la campagne, sa stratégie, ses résultats et ses points clés..."
                    className="bg-white border-gray-300"
                  />
                </div>

                {/* Comment s'en servir — saves to how_to_use in DB */}
                <div className="space-y-2">
                  <Label className="text-gray-700">Comment s'en servir</Label>
                  <RichTextEditor
                    content={formData.howToUse || ""}
                    onChange={(content) => setFormData({ ...formData, howToUse: content })}
                    placeholder="Expliquez comment s'inspirer de cette campagne et l'appliquer concrètement..."
                    className="bg-white border-gray-300"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label className="text-gray-700">Tags</Label>
                  <MultiCheckboxGroup
                    options={campaignOptions.tags}
                    selectedValues={formData.tags}
                    emptyLabel="Aucun tag existant dans la base pour le moment."
                    onToggle={(tag, checked) => {
                      const current = formData.tags || [];
                      setFormData({
                        ...formData,
                        tags: checked ? [...current, tag] : current.filter((item) => item !== tag),
                      });
                    }}
                  />
                  <div className="relative">
                    <div className="flex gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => {
                          setTagInput(e.target.value);
                          setShowTagSuggestions(true);
                        }}
                        onFocus={() => setShowTagSuggestions(true)}
                        onBlur={() => {
                          // Délai pour permettre le clic sur les suggestions
                          setTimeout(() => setShowTagSuggestions(false), 200);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                            setShowTagSuggestions(false);
                          }
                          if (e.key === "Escape") {
                            setShowTagSuggestions(false);
                          }
                        }}
                        className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                        placeholder="Ajouter un tag ou sélectionner..."
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          handleAddTag();
                          setShowTagSuggestions(false);
                        }}
                        variant="outline"
                        className="border-gray-300 text-gray-700 hover:bg-gray-100"
                      >
                        +
                      </Button>
                    </div>
                    
                    {/* Suggestions de tags */}
                    {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        <div className="p-2 text-xs text-gray-500 border-b border-gray-100">
                          💡 Tags existants (cliquez pour ajouter)
                        </div>
                        {filteredTagSuggestions.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between group"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (!formData.tags.includes(tag)) {
                                setFormData({ ...formData, tags: [...formData.tags, tag] });
                              }
                              setTagInput("");
                              setShowTagSuggestions(false);
                            }}
                          >
                            <span className="text-gray-700">{tag}</span>
                            <span className="text-xs text-gray-400 group-hover:text-primary">+ Ajouter</span>
                          </button>
                        ))}
                        {tagInput.trim() && !existingTags.includes(tagInput.trim()) && (
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm bg-primary/5 hover:bg-primary/10 flex items-center gap-2 border-t border-gray-100"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleAddTag();
                              setShowTagSuggestions(false);
                            }}
                          >
                            <Plus className="h-3 w-3 text-primary" />
                            <span className="text-primary">Créer "{tagInput.trim()}"</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Tags sélectionnés */}
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-primary/70 ml-1"
                            title="Supprimer le tag"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500">
                    💡 Tapez pour filtrer les tags existants ou créez-en un nouveau en appuyant sur Entrée.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer with Navigation */}
          <DialogFooter className="border-t border-gray-200 pt-4 flex-row justify-between">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100 gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Annuler
              </Button>
              {currentStep < 3 ? (
                <Button 
                  type="button"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  disabled={currentStep === 1 && !formData.title.trim()}
                  className="bg-primary hover:bg-primary/90 text-white gap-2"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  type="button"
                  onClick={handleSubmit}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  {editingCampaign ? "Enregistrer" : "Ajouter"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Vous êtes sur le point de supprimer{" "}
              <span className="font-bold text-red-600">{selectedIds.size} campagne{selectedIds.size > 1 ? "s" : ""}</span>.
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isBatchDeleting}
              className="border-gray-300 text-gray-700"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={isBatchDeleting}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {isBatchDeleting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Supprimer {selectedIds.size} campagne{selectedIds.size > 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SingleCheckboxGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-gray-700">{label}</Label>
      <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-gray-300 bg-white p-3 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-gray-900 hover:bg-gray-50"
          >
            <Checkbox
              checked={value === option}
              onCheckedChange={(checked) => onChange(checked ? option : "")}
            />
            <span className="min-w-0 truncate">{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function MultiCheckboxGroup({
  options,
  selectedValues,
  onToggle,
  emptyLabel,
}: {
  options: string[];
  selectedValues: string[];
  onToggle: (value: string, checked: boolean) => void;
  emptyLabel: string;
}) {
  if (options.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-gray-300 bg-white p-3 sm:grid-cols-2">
      {options.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-gray-900 hover:bg-gray-50"
        >
          <Checkbox
            checked={(selectedValues || []).includes(option)}
            onCheckedChange={(checked) => onToggle(option, !!checked)}
          />
          <span className="min-w-0 truncate">{option}</span>
        </label>
      ))}
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    }>
      <CampaignsPageContent />
    </Suspense>
  );
}
