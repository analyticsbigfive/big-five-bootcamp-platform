/**
 * API Route: GET /api/payment/status/[ref_command]
 * 
 * Vérifier le statut d'un paiement via sa référence de commande
 * Utilisé sur les pages de confirmation pour vérifier le paiement
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref_command: string }> }
) {
  try {
    // Dans Next.js 15+, params est une Promise
    const { ref_command } = await params;

    if (!ref_command) {
      return NextResponse.json(
        { error: 'Reference command is required' },
        { status: 400 }
      );
    }

    // Récupérer le paiement - requête simple d'abord
    const { data: payment, error } = await (supabaseAdmin as any)
      .from('payments')
      .select('*')
      .eq('ref_command', ref_command)
      .single();

    if (error) {
      console.error('Payment lookup error:', error);
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Cet endpoint n'est pas authentifié (la page de confirmation est ouverte
    // après le retour depuis PawaPay). Le ref_command (UUIDv4) sert de jeton
    // d'accès, mais on n'expose QUE les champs nécessaires à l'affichage —
    // jamais client_phone ni la metadata complète (userId, customer_name,
    // promo_code, subscription_end_date…), qui sont des données personnelles.
    const meta = (payment.metadata || {}) as any;
    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        ref_command: payment.ref_command,
        status: payment.status,
        amount: payment.final_amount || payment.amount,
        currency: payment.currency || 'XOF',
        payment_method: payment.payment_method,
        item_name: payment.item_name || meta.item_name,
        created_at: payment.created_at,
        completed_at: payment.completed_at,
        metadata: {
          item_name: meta.item_name ?? null,
          plan_label: meta.plan_label ?? null,
          promo_bonus: meta.promo_bonus ?? null,
        },
        session: null, // Sessions non implémentées pour l'instant
      },
    });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
