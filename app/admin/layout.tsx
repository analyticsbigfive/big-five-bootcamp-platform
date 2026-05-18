"use client";

import React from "react"
import { AdminProvider } from "./AdminContext";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdmin } from "./AdminContext";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  Megaphone,
  PlusCircle,
  Settings,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Bell,
  Mail,
  Palette,
  CreditCard,
  Building2,
  CalendarHeart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Image from "next/image";

const sidebarLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, description: "Vue d'ensemble" },
  { href: "/admin/campaigns", label: "Campagnes", icon: Megaphone, description: "Gérer le contenu" },
  { href: "/admin/temps-forts", label: "Temps forts", icon: CalendarHeart, description: "Événements & campagnes" },
  { href: "/admin/users", label: "Utilisateurs", icon: Users, description: "Gérer les accès" },
  { href: "/admin/brand-requests", label: "Veille concurrentielle", icon: Building2, description: "Demandes de veille" },
  { href: "/admin/mailchimp", label: "Mailchimp", icon: Mail, description: "Email marketing" },
  { href: "/admin/keynote", label: "Keynote 21 mai", icon: Megaphone, description: "Inscriptions & codes promo" },
  { href: "/admin/decrypte", label: "#BigFiveDecrypte", icon: Sparkles, description: "Inscriptions session Pro" },
  { href: "/admin/branding", label: "Branding", icon: Palette, description: "Logo et identité" },
  { href: "/admin/payment-methods", label: "Paiements", icon: CreditCard, description: "Moyens de paiement" },
  { href: "/admin/settings", label: "Paramètres", icon: Settings, description: "Configuration" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminProvider>
  );
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isAdmin, isLoading, logout } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== "/admin/login") {
      router.push("/admin/login");
    }
    if (!isLoading && isAuthenticated && !isAdmin && pathname !== "/admin/login") {
      router.push("/admin/login");
    }
  }, [isAuthenticated, isAdmin, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-orange-500" />
            </div>
          </div>
          <p className="text-white/60 text-sm font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  // If on login page, render just the children (the login form)
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // If not authenticated or not admin, don't render anything (will redirect)
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-white text-2xl font-bold mb-3">Accès refusé</h2>
          <p className="text-white/60 mb-6">Vous devez être administrateur pour accéder à cette section.</p>
          <Button
            onClick={() => router.push("/admin/login")}
            className="bg-[#F2B33D] hover:bg-[#d99a2a] text-white shadow-lg shadow-[#F2B33D]/25 px-8"
          >
            Se connecter
          </Button>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Mobile header */}
      <div className="lg:hidden bg-gradient-to-r from-slate-900 to-slate-800 p-4 flex items-center justify-between text-white shadow-lg">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 rounded-xl shadow-lg shadow-orange-500/30">
            <Image
              src="/niggaz/normalGlogo.png"
              alt="Laveiye"
              width={24}
              height={24}
              className="h-6 w-6"
            />
          </div>
          <div>
            <span className="font-heading text-lg font-bold">Laveiye</span>
            <span className="text-xs text-white/60 block">Admin Panel</span>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-white hover:bg-white/10 rounded-xl"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-0 left-0 z-40 h-screen w-72 
            bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900
            text-white border-r border-white/5
            transform transition-all duration-300 ease-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            shadow-2xl shadow-black/50
          `}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 hidden lg:block">
              <Link href="/admin" className="flex items-center gap-4 group">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-xl shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/50 transition-all group-hover:scale-105">
                  <Image
                    src="/logo.png"
                    alt="Laveiye"
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                    priority
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-heading text-xl font-bold text-white">Laveiye</span>
                  <span className="text-orange-400/80 text-xs font-medium">Admin Panel</span>
                </div>
              </Link>
            </div>

            {/* Quick Action */}
            <div className="px-4 mb-2">
              <Link
                href="/admin/campaigns?action=new"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl
                  bg-[#F2B33D] hover:bg-[#d99a2a]
                  text-white font-medium
                  shadow-lg shadow-[#F2B33D]/30
                  hover:shadow-[#F2B33D]/50 hover:scale-[1.02]
                  transition-all duration-200
                  group"
              >
                <div className="p-1.5 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <span>Nouvelle campagne</span>
                <ChevronRight className="h-4 w-4 ml-auto opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Link>
            </div>

            {/* Divider */}
            <div className="mx-4 my-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            
            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
              <p className="px-4 py-2 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                Navigation
              </p>
              {sidebarLinks.map((link) => {
                const isActive = pathname.startsWith(link.href) && (link.href === "/admin" ? pathname === "/admin" : true);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group
                      ${isActive
                        ? "bg-white/10 text-white shadow-lg border border-white/10"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                      }
                    `}
                  >
                    <div className={`p-2 rounded-lg transition-colors ${isActive ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white/60"}`}>
                      <link.icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{link.label}</span>
                      <span className="text-[10px] text-white/40">{link.description}</span>
                    </div>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 shadow-lg shadow-orange-500/50"></div>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User section */}
            <div className="p-4 border-t border-white/5">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-orange-500/30">
                  A
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">Administrateur</p>
                  <p className="text-xs text-white/40 truncate">Laveiye Team</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
              >
                <LogOut className="h-4 w-4" />
                <span className="font-medium text-sm">Déconnexion</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-h-screen">
          {/* Top bar */}
          <div className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span>Plateforme active</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full"></span>
              </Button>
            </div>
          </div>
          
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
