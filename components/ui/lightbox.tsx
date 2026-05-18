"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TouchEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Lock, FolderPlus, Heart, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getGoogleDriveImageUrl } from "@/lib/utils";
import { ReactionButtons } from "@/components/ui/reaction-buttons";
import { useAuthContext } from "@/components/auth-provider";
import { UpgradePopup } from "@/components/upgrade-popup";

interface LightboxProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  campaignId?: string;
  onAddToCollection?: () => void;
  onShare?: () => void;
  onToggleFavorite?: () => void;
  isFavorited?: boolean;
}

export function Lightbox({ images: rawImages, initialIndex = 0, isOpen, onClose, campaignId, onAddToCollection, onShare, onToggleFavorite, isFavorited }: LightboxProps) {
  const images = rawImages.map(getGoogleDriveImageUrl);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const { isPremium } = useAuthContext();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset index when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setIsZoomed(false);
    }
  }, [isOpen, initialIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    switch (e.key) {
      case "Escape":
        onClose();
        break;
      case "ArrowLeft":
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
        break;
      case "ArrowRight":
        setCurrentIndex((prev) => (prev + 1) % images.length);
        break;
    }
  }, [isOpen, images.length, onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || images.length <= 1 || isZoomed) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaY) > 80) return;

    if (deltaX > 0) goToPrevious();
    else goToNext();
  };

  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };

  const handleDownload = async () => {
    if (!isPremium) {
      setShowUpgrade(true);
      return;
    }
    if (isDownloading) return;
    setIsDownloading(true);
    const src = images[currentIndex];
    const fallbackName = `campagne-${campaignId || "visuel"}-${currentIndex + 1}`;
    try {
      const res = await fetch(src, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "jpg").split(";")[0];
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fallbackName}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // Fallback : ouverture dans un nouvel onglet si le fetch CORS échoue
      const link = document.createElement("a");
      link.href = src;
      link.download = fallbackName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const lightboxContent = (
    <div 
      className="fixed inset-0 bg-black/95 backdrop-blur-sm"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      {/* Header with controls */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-3 p-3 sm:p-4 bg-gradient-to-b from-black/50 to-transparent">
        <span className="text-white/80 text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className="text-white hover:bg-white/20"
              aria-label={isFavorited ? "Retirer des favoris" : "Ajouter aux favoris"}
              title={isFavorited ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
              <Heart className={`h-5 w-5 ${isFavorited ? "fill-current text-[#F2B33D]" : ""}`} />
            </Button>
          )}
          {onAddToCollection && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCollection();
              }}
              className="text-white hover:bg-white/20"
              aria-label="Ajouter à une collection"
              title="Ajouter à une collection"
            >
              <FolderPlus className="h-5 w-5" />
            </Button>
          )}
          {onShare && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              className="text-white hover:bg-white/20"
              aria-label="Partager"
              title="Partager"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleZoom();
            }}
            className="text-white hover:bg-white/20"
            aria-label={isZoomed ? "Dézoomer" : "Zoomer"}
            title={isZoomed ? "Dézoomer" : "Zoomer"}
          >
            {isZoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className={`text-white hover:bg-white/20 ${!isPremium ? "relative" : ""}`}
            aria-label={isPremium ? "Télécharger" : "Téléchargement : Basic ou Pro requis"}
            title={isPremium ? "Télécharger" : "Téléchargement : Basic ou Pro requis"}
            disabled={isDownloading}
          >
            <Download className={`h-5 w-5 ${!isPremium ? "opacity-60" : ""}`} />
            {!isPremium && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#F2B33D] text-[#0F0F0F]">
                <Lock className="h-2 w-2" />
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
            aria-label="Fermer"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main image */}
      <div 
        className="flex items-center justify-center w-full h-full px-4 pb-24 pt-16 sm:p-16"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className={`relative w-full h-full transition-transform duration-300 ${
            isZoomed ? "cursor-zoom-out scale-150" : "cursor-zoom-in"
          }`}
          onClick={toggleZoom}
        >
          <Image
            src={images[currentIndex]}
            alt={`Image ${currentIndex + 1}`}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        </div>
      </div>

      {/* Réactions Like / Dislike + Favoris + Partage dans la lightbox */}
      {campaignId && (
        <div
          className="absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 sm:bottom-24"
          onClick={(e) => e.stopPropagation()}
        >
          <ReactionButtons
            campaignId={campaignId}
            className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2"
          />
        </div>
      )}

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 backdrop-blur-sm transition-colors hover:bg-white/20 sm:left-4 sm:p-3"
            title="Image précédente"
            aria-label="Image précédente"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 backdrop-blur-sm transition-colors hover:bg-white/20 sm:right-4 sm:p-3"
            title="Image suivante"
            aria-label="Image suivante"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        </>
      )}

      {/* Thumbnails at bottom */}
      {images.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/50 to-transparent">
          <div className="flex justify-center gap-2 overflow-x-auto pb-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                aria-label={`Voir image ${index + 1}`}
                title={`Image ${index + 1}`}
                className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentIndex
                    ? "border-white scale-110"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <Image
                  src={image}
                  alt={`Miniature ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </button>
            ))}
          </div>
        </div>
      )}
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} reason="download" />
    </div>
  );

  return createPortal(lightboxContent, document.body);
}

interface ImageGalleryProps {
  mainImage: string | null;
  images: string[];
  title: string;
  campaignId?: string;
  onAddToCollection?: () => void;
  onShare?: () => void;
  onToggleFavorite?: () => void;
  floatingActionLabel?: string;
  onFloatingAction?: () => void;
  isFavorited?: boolean;
}

export function ImageGallery({ mainImage, images: rawImages, title, campaignId, onAddToCollection, onShare, onToggleFavorite, floatingActionLabel, onFloatingAction, isFavorited }: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Combine main image and additional images, converting Drive URLs
  const images = rawImages.map(getGoogleDriveImageUrl);
  const convertedMainImage = mainImage ? getGoogleDriveImageUrl(mainImage) : null;
  const allImages = [convertedMainImage, ...images].filter(Boolean) as string[];
  const supplementaryImages = images.filter(Boolean) as string[];
  const currentImage = allImages[currentIndex] || allImages[0] || "";
  const hasMultipleImages = allImages.length > 1;
  const galleryKey = [mainImage, ...rawImages].join("|");

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const goToPreviousImage = () => {
    setCurrentIndex((index) => (index - 1 + allImages.length) % allImages.length);
  };

  const goToNextImage = () => {
    setCurrentIndex((index) => (index + 1) % allImages.length);
  };

  useEffect(() => {
    setCurrentIndex(0);
  }, [galleryKey]);

  if (allImages.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
        <div className="text-4xl font-bold text-muted-foreground/20">
          {title.substring(0, 2).toUpperCase()}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Main image - visible slider when a campaign has multiple visuals */}
        <div
          className="relative overflow-hidden rounded-xl bg-gray-50 cursor-pointer group dark:bg-white/5"
          onClick={() => openLightbox(currentIndex)}
        >
          <div className="relative flex min-h-[260px] w-full items-center justify-center sm:min-h-[320px]">
            <Image
              src={currentImage}
              alt={title}
              width={800}
              height={800}
              className="h-auto max-h-[calc(100svh-230px)] w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.02] lg:max-h-[calc(100vh-210px)]"
              sizes="(max-width: 1024px) 100vw, 800px"
              priority
            />
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {hasMultipleImages && (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white opacity-90 backdrop-blur-sm transition-all hover:bg-black/65"
                aria-label="Visuel précédent"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPreviousImage();
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white opacity-90 backdrop-blur-sm transition-all hover:bg-black/65"
                aria-label="Visuel suivant"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextImage();
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                {currentIndex + 1}/{allImages.length}
              </div>
            </>
          )}
          {floatingActionLabel && onFloatingAction && (
            <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center px-4 sm:bottom-10">
              <Button
                type="button"
                className="h-11 rounded-full bg-[#F2B33D] px-5 text-sm font-bold text-[#0F0F0F] shadow-lg shadow-black/25 hover:bg-[#E4A82F] hover:text-[#0F0F0F]"
                onClick={(e) => {
                  e.stopPropagation();
                  onFloatingAction();
                }}
              >
                {floatingActionLabel}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Supplementary images gallery */}
        {supplementaryImages.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span>Galerie</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                {supplementaryImages.length} image{supplementaryImages.length > 1 ? "s" : ""}
              </span>
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {supplementaryImages.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index + 1)} // +1 because main image is at index 0
                  onDoubleClick={() => openLightbox(index + 1)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg bg-muted cursor-pointer group ring-offset-2 ring-offset-background transition-all",
                    currentIndex === index + 1 && "ring-2 ring-[#F2B33D]"
                  )}
                  aria-label={`Afficher image ${index + 2}`}
                  title={`Image ${index + 2}`}
                >
                  <Image
                    src={image}
                    alt={`${title} - Image ${index + 2}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                    sizes="(max-width: 640px) 25vw, (max-width: 768px) 20vw, 16vw"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Lightbox
        images={allImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        campaignId={campaignId}
        onAddToCollection={onAddToCollection}
        onShare={onShare}
        onToggleFavorite={onToggleFavorite}
        isFavorited={isFavorited}
      />
    </>
  );
}
