"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Shield, Scale } from "lucide-react";
import {
  CGUContent,
  CGVContent,
  PrivacyContent,
  LEGAL_LAST_UPDATED,
  LEGAL_VERSION,
} from "@/components/legal-content";

interface LegalModalProps {
  trigger?: React.ReactNode;
  defaultTab?: "cgu" | "cgv" | "privacy";
}

export function LegalModal({ trigger, defaultTab = "cgu" }: LegalModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="text-primary hover:underline text-sm">
            Voir les conditions
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold">
            Informations légales
          </DialogTitle>
          <DialogDescription>
            Conditions d&apos;utilisation, conditions de vente et politique de confidentialité
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-3 px-6">
            <TabsTrigger value="cgu" className="gap-2">
              <FileText className="h-4 w-4" />
              CGU
            </TabsTrigger>
            <TabsTrigger value="cgv" className="gap-2">
              <Scale className="h-4 w-4" />
              CGV
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-2">
              <Shield className="h-4 w-4" />
              Confidentialité
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(85vh-180px)] px-6 pb-6">
            <TabsContent value="cgu" className="mt-4">
              <p className="text-sm text-muted-foreground mb-6">
                Version {LEGAL_VERSION} — Dernière mise à jour : {LEGAL_LAST_UPDATED}
              </p>
              <CGUContent />
            </TabsContent>

            <TabsContent value="cgv" className="mt-4">
              <p className="text-sm text-muted-foreground mb-6">
                Version {LEGAL_VERSION} — Dernière mise à jour : {LEGAL_LAST_UPDATED}
              </p>
              <CGVContent />
            </TabsContent>

            <TabsContent value="privacy" className="mt-4">
              <p className="text-sm text-muted-foreground mb-6">
                Version {LEGAL_VERSION} — Dernière mise à jour : {LEGAL_LAST_UPDATED}
              </p>
              <PrivacyContent />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
