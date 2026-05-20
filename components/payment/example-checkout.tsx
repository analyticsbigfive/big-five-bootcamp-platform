/**
 * Exemple d'utilisation du PaymentButton
 * 
 * Ce fichier montre comment intégrer le bouton de paiement PayTech
 * dans une page de checkout de bootcamp
 */

'use client';

import { useState, useEffect } from 'react';
import PaymentButton from '@/components/payment/payment-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';

interface ExampleCheckoutProps {
  sessionId: string;
}

export default function ExampleCheckout({ sessionId }: ExampleCheckoutProps) {
  const { user, isAuthenticated } = useSupabaseAuth();
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Charger les données de la session depuis Supabase
    const loadSession = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        const data = await response.json();
        setSessionData(data);
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  if (loading) {
    return <div>Chargement...</div>;
  }

  if (!sessionData) {
    return <div>Session introuvable</div>;
  }

  const { session, bootcamp } = sessionData;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Finaliser votre inscription</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Résumé de la commande */}
        <Card>
          <CardHeader>
            <CardTitle>Résumé de la commande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold">{bootcamp.title}</h3>
              <p className="text-sm text-gray-600">{bootcamp.tagline}</p>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between mb-2">
                <span>Prix du bootcamp</span>
                <span className="font-semibold">
                  {bootcamp.price.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Session</span>
                <span>
                  {new Date(session.start_date).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Format</span>
                <span>{session.format}</span>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total à payer</span>
                <span className="text-[#0F0F0F]">
                  {bootcamp.price.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations utilisateur */}
        <Card>
          <CardHeader>
            <CardTitle>Vos informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>

            <div>
              <label className="text-sm font-medium">Nom</label>
              <p className="text-sm text-gray-600">{user?.user_metadata?.name || 'Non renseigné'}</p>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-gray-500">
                Un email de confirmation vous sera envoyé après le paiement.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bouton de paiement */}
      <div className="mt-8 flex justify-center">
        {isAuthenticated ? (
          <PaymentButton
            sessionId={sessionId}
            userEmail={user?.email || ''}
            amount={bootcamp.price}
            bootcampTitle={bootcamp.title}
            onSuccess={() => {
              console.log('Paiement initié avec succès');
            }}
            className="w-full md:w-auto px-12"
          />
        ) : (
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <p className="mb-4">Vous devez être connecté pour procéder au paiement</p>
              <a href="/login" className="text-[#0F0F0F] hover:underline">
                Se connecter →
              </a>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Informations de sécurité */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          🔒 Paiement 100% sécurisé
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Votre paiement est traité de manière sécurisée par PayTech, leader du paiement mobile en Afrique de l'Ouest.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-500">
          <div>✓ Cryptage SSL</div>
          <div>✓ Données protégées</div>
          <div>✓ Conformité PCI DSS</div>
          <div>✓ Support 24/7</div>
        </div>
      </div>
    </div>
  );
}

/**
 * UTILISATION DANS UNE PAGE :
 * 
 * // app/content/[id]/page.tsx (ou bootcamps/[slug]/checkout/page.tsx)
 * 
 * import ExampleCheckout from '@/components/payment/example-checkout';
 * 
 * export default function CheckoutPage({ params }: { params: { id: string } }) {
 *   return <ExampleCheckout sessionId={params.id} />;
 * }
 */
