import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import {
    PrivacyContent,
    LEGAL_LAST_UPDATED,
    LEGAL_VERSION,
} from "@/components/legal-content"

export const metadata = {
    title: "Politique de Confidentialité — Laveiye",
}

export default function PrivacyPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1 py-16 lg:py-24">
                <div className="container mx-auto px-4 max-w-3xl">
                    <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold mb-4 text-[#0F0F0F]">
                        Politique de Confidentialité
                    </h1>
                    <p className="text-sm text-muted-foreground mb-10">
                        Laveiye — Bibliothèque de Campagnes Publicitaires et d&apos;Intelligence Créative
                        <br />
                        Version {LEGAL_VERSION} — Dernière mise à jour : {LEGAL_LAST_UPDATED}
                    </p>
                    <PrivacyContent />
                </div>
            </main>
            <Footer />
        </div>
    )
}
