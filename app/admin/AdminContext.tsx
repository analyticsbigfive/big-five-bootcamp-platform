"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from "react";
import type { ContentItem } from "@/components/dashboard/content-card";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { invalidateTempsFortsCache } from "@/components/temps-forts/use-temps-forts";

export type { ContentItem };

type AdminContextType = {
  campaigns: ContentItem[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  isUsingLocalData: boolean;
  userEmail: string | null;
  logout: () => void;
  addCampaign: (item: Omit<ContentItem, "id">) => void;
  updateCampaign: (id: string, item: Partial<ContentItem>) => void;
  deleteCampaign: (id: string) => void;
  refreshCampaigns: () => Promise<void>;
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useState<ContentItem[]>([]);
  const [isUsingLocalData, setIsUsingLocalData] = useState(false);

  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const initialCheckDone = useRef(false);
  const knownUserIdRef = useRef<string | null>(null);

  // Utiliser useMemo pour éviter de recréer le client à chaque rendu
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  // Auth Logic
  useEffect(() => {
    let cancelled = false;

    const checkUser = async () => {
      try {
        // getUser() valide le token côté serveur (fiable après refresh)
        // Pas de getSession() — INITIAL_SESSION de onAuthStateChange suffit
        // si on a besoin du token. On n'expose ici que email / role / id.
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user?.email) {
          setAuthEmail(user.email);
          setAuthUserId(user.id);
          knownUserIdRef.current = user.id;
        }

        if (user?.email) {
          // D'abord vérifier les métadonnées de l'utilisateur auth
          const userMetadata = user.user_metadata;
          if (userMetadata?.role === 'admin') {
            setUserRole('admin');
            setAuthLoading(false);
            return;
          }

          // Liste des emails admin autorisés (fallback principal)
          const adminEmails = ['jeanluc@bigfiveabidjan.com', 'cossi@bigfiveabidjan.com', 'yannick@bigfiveabidjan.com', 'franck@bigfiveabidjan.com', 'stephanie@bigfiveabidjan.com'];

          // Vérifier d'abord si l'email est dans la liste admin connue
          if (adminEmails.includes(user.email)) {
            setUserRole('admin');
            setAuthLoading(false);
            return;
          }

          // Ensuite essayer de récupérer le rôle depuis la table users (optionnel)
          try {
            const { data: dbUser, error } = await supabase
              .from('users')
              .select('role')
              .eq('email', user.email)
              .maybeSingle();

            if (cancelled) return;
            if (!error && dbUser?.role) {
              setUserRole(dbUser.role);
            } else {
              setUserRole('user');
            }
          } catch (dbError) {
            if (cancelled) return;
            console.warn("Erreur DB, utilisation du fallback:", dbError);
            setUserRole('user');
          }
        }
      } catch (error: any) {
        // Ignorer les AbortError causés par le démontage du composant (React Strict Mode)
        if (error?.name === 'AbortError' || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        if (!cancelled) {
          console.error("Auth check error", error);
        }
      } finally {
        if (!cancelled) {
          initialCheckDone.current = true;
          setAuthLoading(false);
        }
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      // Ignorer les events tant que getUser() n'a pas fini
      if (!initialCheckDone.current) return;
      // TOKEN_REFRESHED fire à chaque refresh (≈ 1h) — pas besoin de re-checker
      // le rôle si le user n'a pas changé. Évite N requêtes DB par session.
      if (event === "TOKEN_REFRESHED" && session?.user?.id === knownUserIdRef.current) return;
      if (session?.user?.email) {
        setAuthEmail(session.user.email);
        setAuthUserId(session.user.id);
        knownUserIdRef.current = session.user.id;
      } else {
        setAuthEmail(null);
        setAuthUserId(null);
        knownUserIdRef.current = null;
      }
      if (session?.user?.email) {
        // Vérifier d'abord les métadonnées
        const userMetadata = session.user.user_metadata;
        if (userMetadata?.role === 'admin') {
          setUserRole('admin');
          setAuthLoading(false);
          return;
        }
        
        // Liste des emails admin autorisés
        const adminEmails = ['jeanluc@bigfiveabidjan.com', 'cossi@bigfiveabidjan.com', 'yannick@bigfiveabidjan.com', 'franck@bigfiveabidjan.com', 'stephanie@bigfiveabidjan.com'];
        
        // Vérifier si l'email est dans la liste admin connue
        if (adminEmails.includes(session.user.email)) {
          setUserRole('admin');
          setAuthLoading(false);
          return;
        }
        
        // Essayer la table users avec gestion d'erreur (optionnel)
        try {
          const { data: dbUser, error } = await supabase
            .from('users')
            .select('role')
            .eq('email', session.user.email)
            .maybeSingle();
          
          if (!error && dbUser?.role) {
            setUserRole(dbUser.role);
          } else {
            setUserRole('user');
          }
        } catch {
          setUserRole('user');
        }
      } else {
        setUserRole(null);
      }
      setAuthLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);


  const isLoading = authLoading || campaignsLoading;
  const isAuthenticated = !!authEmail;
  const isAdmin = userRole === "admin"; // Check role

  // Charger les campagnes depuis Supabase
  useEffect(() => {
    if (isAdmin && !authLoading) {
      // Petit délai pour s'assurer que les cookies sont synchronisés
      const timer = setTimeout(() => {
        loadCampaignsFromSupabase();
      }, 100);
      return () => clearTimeout(timer);
    } else if (!authLoading) {
      setCampaignsLoading(false);
    }
  }, [isAdmin, authLoading]);

  // Données d'exemple pour l'admin quand la base n'est pas configurée
  const getSampleCampaigns = (): ContentItem[] => [
    {
      id: "sample-1",
      title: "Campagne MTN Mobile Money",
      description: "Campagne digitale pour le lancement de MTN MoMo en Côte d'Ivoire",
      imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800",
      platform: "Facebook",
      platforms: ["Facebook"],
      country: "Côte d'Ivoire",
      sector: "Telecoms",
      format: "Vidéo",
      tags: ["Mobile Money", "Fintech", "Digital"],
      date: "2024-01-15",
      isVideo: true,
      brand: "MTN",
      agency: "Laveiye",
      year: 2024,
      status: "Publié",
    },
    {
      id: "sample-2",
      title: "Lancement Coca-Cola Zero Sugar",
      description: "Campagne 360° pour le nouveau Coca-Cola Zero Sugar",
      imageUrl: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=800",
      platform: "Instagram",
      platforms: ["Instagram"],
      country: "Sénégal",
      sector: "FMCG",
      format: "Image",
      tags: ["Boisson", "Lancement produit"],
      date: "2024-02-20",
      isVideo: false,
      brand: "Coca-Cola",
      agency: "Laveiye",
      year: 2024,
      status: "Publié",
    },
    {
      id: "sample-3",
      title: "Orange Bank Africa",
      description: "Campagne de sensibilisation aux services bancaires mobiles",
      imageUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800",
      platform: "YouTube",
      platforms: ["YouTube"],
      country: "Togo",
      sector: "Banque/Finance",
      format: "Vidéo",
      tags: ["Banque mobile", "Digital", "Fintech"],
      date: "2024-03-10",
      isVideo: true,
      brand: "Orange",
      agency: "Laveiye",
      year: 2024,
      status: "Brouillon",
    },
  ];

  const loadCampaignsFromSupabase = async () => {
    try {
      console.log('Loading campaigns from API...')
      
      // Utiliser l'API admin qui bypass RLS
      const response = await fetch('/api/admin/campaigns', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('API response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json();
        console.warn('API admin/campaigns non disponible:', errorData.error);
        // En mode développement, afficher un message plus explicite
        if (process.env.NODE_ENV === 'development') {
          console.info('💡 Pour accéder aux campagnes, connectez-vous avec un compte admin.')
        }
        setCampaigns(getSampleCampaigns());
        setIsUsingLocalData(true);
        return;
      }
      
      const { campaigns: data, error } = await response.json();

      if (error) {
        // Table campaigns n'existe pas encore
        console.warn('Table campaigns non disponible:', error);
        setCampaigns(getSampleCampaigns());
        setIsUsingLocalData(true);
        return;
      }

      if (!data || data.length === 0) {
        // Pas de campagnes, mais la table existe - ne pas utiliser de données d'exemple
        setCampaigns([]);
        setIsUsingLocalData(false);
        return;
      }

      setIsUsingLocalData(false);

      // Convertir les données Supabase au format ContentItem
      const formattedCampaigns: ContentItem[] = (data || []).map((campaign: any) => ({
        id: campaign.id,
        title: campaign.title,
        summary: campaign.summary || '',
        description: campaign.description || '',
        imageUrl: campaign.thumbnail || '',
        platform: campaign.platforms?.[0] || 'Facebook',
        platforms: campaign.platforms || [],
        country: campaign.country || '',
        sector: campaign.category || '',
        format: campaign.format || '',
        tags: campaign.tags || [],
        date: new Date(campaign.created_at).toISOString().split('T')[0],
        isVideo: !!campaign.video_url,
        images: campaign.images || [],
        videoUrl: campaign.video_url || undefined,
        brand: campaign.brand || '',
        agency: campaign.agency || '',
        axe: campaign.axe || [],
        analyse: campaign.analyse || '',
        howToUse: campaign.how_to_use || '',
        year: campaign.year || undefined,
        status: campaign.status || 'Brouillon',
        accessLevel: campaign.access_level || 'free',
        slug: campaign.slug || '',
        featured: campaign.featured || false,
        publicationUrl: campaign.publication_url || '',
        tempsFortSlugs: campaign.temps_fort_slugs || [],
      }));

      setCampaigns(formattedCampaigns);
    } catch (error: any) {
      console.warn('Erreur chargement campagnes, utilisation des données exemple:', error?.message || error);
      setCampaigns(getSampleCampaigns());
    } finally {
      setCampaignsLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    router.push("/admin/login");
  };

  // Mapper ContentItem vers colonnes DB
  const mapToDbRecord = (data: Partial<ContentItem>) => {
    const record: Record<string, any> = {};
    if (data.title !== undefined) record.title = data.title;
    if (data.summary !== undefined) record.summary = data.summary;
    if (data.description !== undefined) record.description = data.description;
    if (data.imageUrl !== undefined) record.thumbnail = data.imageUrl;
    if (data.platform !== undefined) record.platforms = data.platform ? [data.platform] : [];
    if (data.sector !== undefined) record.category = data.sector;
    if (data.videoUrl !== undefined) record.video_url = data.videoUrl || null;
    if (data.country !== undefined) record.country = data.country;
    if (data.format !== undefined) record.format = data.format;
    if (data.agency !== undefined) record.agency = data.agency;
    if (data.year !== undefined) record.year = data.year;
    if (data.images !== undefined) record.images = data.images;
    if (data.tags !== undefined) record.tags = data.tags;
    if (data.brand !== undefined) record.brand = data.brand;
    if (data.axe !== undefined) record.axe = data.axe;
    if (data.analyse !== undefined) record.analyse = data.analyse;
    if (data.howToUse !== undefined) record.how_to_use = data.howToUse;
    if (data.status !== undefined) record.status = data.status;
    if (data.accessLevel !== undefined) record.access_level = data.accessLevel;
    if (data.slug !== undefined) record.slug = data.slug;
    if (data.featured !== undefined) record.featured = data.featured;
    if (data.publicationUrl !== undefined) record.publication_url = data.publicationUrl || null;
    if (data.tempsFortSlugs !== undefined) record.temps_fort_slugs = data.tempsFortSlugs;
    return record;
  };

  // Campaign Actions
  const addCampaign = async (campaignData: Omit<ContentItem, "id">) => {
    // Si on utilise des données locales (table non disponible), ajouter localement
    if (isUsingLocalData) {
      const newCampaign: ContentItem = {
        ...campaignData,
        id: `local-${Date.now()}`,
      };
      setCampaigns(prev => [newCampaign, ...prev]);
      invalidateTempsFortsCache();
      toast.success("Campagne ajoutée localement", {
        description: "Note: La base de données n'est pas configurée. Les données seront perdues au rechargement."
      });
      return;
    }

    try {
      const record = mapToDbRecord(campaignData);
      if (!record.status) record.status = 'Brouillon';
      
      // Utiliser l'API admin
      const response = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(record),
      });
      
      const result = await response.json();
      
      if (!response.ok || result.error) {
        // Si erreur DB, basculer en mode local
        console.warn('DB non disponible, ajout local:', result.error);
        const newCampaign: ContentItem = {
          ...campaignData,
          id: `local-${Date.now()}`,
        };
        setCampaigns(prev => [newCampaign, ...prev]);
        invalidateTempsFortsCache();
        setIsUsingLocalData(true);
        toast.success("Campagne ajoutée localement", {
          description: "La table 'campaigns' n'existe pas dans Supabase. Exécutez le schéma SQL."
        });
        return;
      }
      toast.success("Campagne ajoutée avec succès");
      await loadCampaignsFromSupabase();
      invalidateTempsFortsCache();
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      // Fallback local
      const newCampaign: ContentItem = {
        ...campaignData,
        id: `local-${Date.now()}`,
      };
      setCampaigns(prev => [newCampaign, ...prev]);
      invalidateTempsFortsCache();
      setIsUsingLocalData(true);
      toast.warning("Campagne ajoutée en mode hors-ligne", {
        description: "Configurez Supabase pour persister les données."
      });
    }
  };

  const updateCampaign = async (id: string, updatedData: Partial<ContentItem>) => {
    // Si données locales ou ID local
    if (isUsingLocalData || id.startsWith('local-') || id.startsWith('sample-')) {
      setCampaigns(prev => prev.map(c => 
        c.id === id ? { ...c, ...updatedData } : c
      ));
      invalidateTempsFortsCache();
      toast.success("Campagne mise à jour localement");
      return;
    }

    try {
      const record = mapToDbRecord(updatedData);
      
      // Utiliser l'API admin
      const response = await fetch('/api/admin/campaigns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, ...record }),
      });
      
      const result = await response.json();
      
      if (!response.ok || result.error) {
        // Fallback local
        setCampaigns(prev => prev.map(c => 
          c.id === id ? { ...c, ...updatedData } : c
        ));
        invalidateTempsFortsCache();
        toast.success("Campagne mise à jour localement");
        return;
      }
      toast.success("Campagne mise à jour avec succès");
      await loadCampaignsFromSupabase();
      invalidateTempsFortsCache();
    } catch (error: any) {
      console.error('Error updating campaign:', error);
      setCampaigns(prev => prev.map(c => 
        c.id === id ? { ...c, ...updatedData } : c
      ));
      invalidateTempsFortsCache();
      toast.warning("Mise à jour locale uniquement");
    }
  };

  const deleteCampaign = async (id: string) => {
    // Si données locales ou ID local
    if (isUsingLocalData || id.startsWith('local-') || id.startsWith('sample-')) {
      setCampaigns(prev => prev.filter(c => c.id !== id));
      invalidateTempsFortsCache();
      toast.success("Campagne supprimée");
      return;
    }

    try {
      // Utiliser l'API admin
      const response = await fetch(`/api/admin/campaigns?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (!response.ok || result.error) {
        setCampaigns(prev => prev.filter(c => c.id !== id));
        invalidateTempsFortsCache();
        toast.success("Campagne supprimée localement");
        return;
      }
      toast.success("Campagne supprimée");
      await loadCampaignsFromSupabase();
      invalidateTempsFortsCache();
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      invalidateTempsFortsCache();
      toast.warning("Suppression locale uniquement");
    }
  };

  return (
    <AdminContext.Provider
      value={{
        campaigns,
        isAuthenticated,
        isAdmin,
        isLoading,
        isUsingLocalData,
        userEmail: authEmail,
        logout,
        addCampaign,
        updateCampaign,
        deleteCampaign,
        refreshCampaigns: loadCampaignsFromSupabase,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
