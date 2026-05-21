import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import {
    CGUContent,
    LEGAL_LAST_UPDATED,
    LEGAL_VERSION,
} from "@/components/legal-content"

export const metadata = {
    title: "Conditions Générales d'Utilisation — Laveiye",
}

export default function TermsPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1 py-16 lg:py-24">
                <div className="container mx-auto px-4 max-w-3xl">
                    <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold mb-4 text-[#0F0F0F]">
                        Conditions Générales d&apos;Utilisation
                    </h1>
                    <p className="text-sm text-muted-foreground mb-10">
                        Laveiye — Bibliothèque de Campagnes Publicitaires et d&apos;Intelligence Créative
                        <br />
                        Version {LEGAL_VERSION} — Dernière mise à jour : {LEGAL_LAST_UPDATED}
                    </p>
                    <CGUContent />
                </div>
            </main>
            <Footer />
        </div>
    )
}
