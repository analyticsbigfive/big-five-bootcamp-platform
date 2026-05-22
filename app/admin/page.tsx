"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Megaphone, 
  PlusCircle, 
  Globe, 
  Building2, 
  ArrowRight, 
  TrendingUp, 
  Eye,
  Sparkles,
  BarChart3,
  Activity
} from "lucide-react";
import { useAdmin } from "./AdminContext";
import { RevenueSummary } from "./revenue-summary";

export default function AdminDashboardPage() {
  const { campaigns } = useAdmin();
  const [stats, setStats] = useState({ users: 0, campaigns: 0, brands: 0, countries: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setIsLoading(false);
      })
      .catch(() => {
        setStats({ users: 0, campaigns: 0, brands: 0, countries: 0 });
        setIsLoading(false);
      });
  }, []);

  const quickActions = [
    { 
      href: "/admin/campaigns?action=new", 
      label: "Ajouter une campagne", 
      description: "Créer du nouveau contenu",
      icon: PlusCircle, 
      gradient: "from-emerald-500 to-teal-600",
      shadowColor: "shadow-emerald-500/25"
    },
    { 
      href: "/admin/campaigns", 
      label: "Gérer les campagnes", 
      description: "Modifier ou supprimer",
      icon: Megaphone, 
      gradient: "from-[#F2B33D] to-[#F2B33D]",
      shadowColor: "shadow-blue-500/25"
    },
    { 
      href: "/admin/users", 
      label: "Gérer les utilisateurs", 
      description: "Accès et permissions",
      icon: Users, 
      gradient: "from-[#F2B33D] to-[#F2B33D]",
      shadowColor: "shadow-[#F2B33D]/25"
    },
  ];

  const statsCards = [
    {
      title: "Total Campagnes",
      value: stats.campaigns,
      description: "Campagnes publiées",
      icon: Megaphone,
      gradient: "from-orange-500 to-amber-500",
      bgGradient: "from-orange-500/10 to-amber-500/10"
    },
    {
      title: "Utilisateurs",
      value: stats.users,
      description: "Comptes actifs",
      icon: Users,
      gradient: "from-[#F2B33D] to-cyan-500",
      bgGradient: "from-[#F2B33D]/10 to-cyan-500/10"
    },
    {
      title: "Marques",
      value: stats.brands,
      description: "Marques différentes",
      icon: Building2,
      gradient: "from-[#F2B33D] to-[#F2B33D]",
      bgGradient: "from-[#F2B33D]/10 to-[#F2B33D]/10"
    },
    {
      title: "Pays",
      value: stats.countries,
      description: "Pays représentés",
      icon: Globe,
      gradient: "from-emerald-500 to-teal-500",
      bgGradient: "from-emerald-500/10 to-teal-500/10"
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#F2B33D]">
              Dashboard
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Vue d'ensemble de la plateforme Laveiye
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
            <Activity className="w-4 h-4" />
            <span>Système opérationnel</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Actions rapides</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="group cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border-0 bg-white dark:bg-slate-800/50 overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${action.gradient} text-white shadow-lg ${action.shadowColor} group-hover:scale-110 transition-transform`}>
                      <action.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white">{action.label}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{action.description}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Statistiques en temps réel</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((stat, index) => (
            <Card key={index} className="border-0 bg-white dark:bg-slate-800/50 overflow-hidden group hover:shadow-lg transition-all relative">
              <CardContent className="p-6">
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} text-white shadow-lg`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    {isLoading ? (
                      <div className="h-9 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                    ) : (
                      <p className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                    )}
                    <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">{stat.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{stat.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Revenue Summary */}
      <RevenueSummary />

      {/* Recent Activity */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-[#0F0F0F]" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Activité récente</h2>
        </div>
        {campaigns.length === 0 ? (
          <Card className="border-0 bg-white dark:bg-slate-800/50">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <Activity className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Aucune campagne pour le moment.
              </p>
              <Link href="/admin/campaigns?action=new">
                <Button className="bg-[#F2B33D] hover:bg-[#d99a2a] text-white shadow-lg shadow-[#F2B33D]/25">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Créer votre première campagne
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 bg-white dark:bg-slate-800/50">
            <CardContent className="p-4">
              <div className="space-y-3">
                {campaigns.slice(0, 5).map((campaign) => (
                  <div key={campaign.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/10 to-amber-500/10">
                      <Megaphone className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {campaign.title}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {campaign.brand || "Sans marque"} {campaign.sector ? `· ${campaign.sector}` : ""}
                      </p>
                    </div>
                    <div className="text-xs text-slate-400">
                      {campaign.date ? new Date(campaign.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                    </div>
                  </div>
                ))}
              </div>
              {campaigns.length > 5 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-center">
                  <Link href="/admin/campaigns">
                    <Button variant="ghost" className="text-orange-600 hover:text-orange-700">
                      Voir toutes les campagnes ({campaigns.length})
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
