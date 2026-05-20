"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReactionButtonsProps {
  campaignId: string;
  className?: string;
}

interface ReactionState {
  likes: number;
  dislikes: number;
  userReaction: "like" | "dislike" | null;
}

export function ReactionButtons({ campaignId, className }: ReactionButtonsProps) {
  const [state, setState] = useState<ReactionState>({
    likes: 0,
    dislikes: 0,
    userReaction: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  // Lit le token directement depuis le contexte — pas de getSession() par carte.
  const { session } = useAuthContext();
  const token = session?.access_token || null;
  const isAuthenticated = !!token;

  // Charger les compteurs et la réaction de l'utilisateur
  useEffect(() => {
    async function fetchReactions() {
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(`/api/reactions/${campaignId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setState({
            likes: data.likes,
            dislikes: data.dislikes,
            userReaction: data.userReaction,
          });
        }
      } catch (error) {
        console.error("Erreur chargement réactions:", error);
      }
    }

    fetchReactions();
  }, [campaignId, token]);

  // Toggle une réaction
  const handleReaction = async (type: "like" | "dislike") => {
    if (!isAuthenticated) {
      toast.error("Connectez-vous pour réagir");
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    // Optimistic update
    const previousState = { ...state };
    setState((prev) => {
      const newState = { ...prev };

      if (prev.userReaction === type) {
        // Toggle off
        newState.userReaction = null;
        if (type === "like") newState.likes--;
        else newState.dislikes--;
      } else {
        // Si on avait une autre réaction, la retirer
        if (prev.userReaction === "like") newState.likes--;
        if (prev.userReaction === "dislike") newState.dislikes--;

        // Ajouter la nouvelle
        newState.userReaction = type;
        if (type === "like") newState.likes++;
        else newState.dislikes++;
      }

      return newState;
    });

    try {
      const res = await fetch(`/api/reactions/${campaignId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        const data = await res.json();
        // Synchroniser avec le serveur
        setState({
          likes: data.likes,
          dislikes: data.dislikes,
          userReaction: data.userReaction,
        });
      } else {
        // Rollback en cas d'erreur
        setState(previousState);
        toast.error("Erreur lors de la réaction");
      }
    } catch (error) {
      // Rollback en cas d'erreur réseau
      setState(previousState);
      toast.error("Erreur réseau");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Bouton Like */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleReaction("like")}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-1.5 transition-all duration-200",
          state.userReaction === "like"
            ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100 hover:text-green-800"
            : "hover:bg-green-50 hover:border-green-200 hover:text-green-600"
        )}
      >
        <ThumbsUp
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            state.userReaction === "like" && "fill-current scale-110"
          )}
        />
        <span className="text-sm font-medium min-w-[1ch]">{state.likes}</span>
      </Button>

      {/* Bouton Dislike */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleReaction("dislike")}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-1.5 transition-all duration-200",
          state.userReaction === "dislike"
            ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800"
            : "hover:bg-red-50 hover:border-red-200 hover:text-red-600"
        )}
      >
        <ThumbsDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            state.userReaction === "dislike" && "fill-current scale-110"
          )}
        />
        <span className="text-sm font-medium min-w-[1ch]">{state.dislikes}</span>
      </Button>
    </div>
  );
}
