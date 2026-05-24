# Migrations log — Laveiye

Journal des scripts SQL à appliquer dans Supabase SQL Editor.

**Convention** :
- Chaque ligne = un script à exécuter dans cet ordre, une seule fois.
- Cocher quand appliqué en prod. Garder daté.
- Les scripts en *italique* sont des outils ponctuels (one-shot data fix, audit), pas des migrations de schéma.

## Migrations de schéma

| Ordre | Script | Description | Appliqué prod ? |
|---|---|---|---|
| 1 | `add-search-logs-and-avatars.sql` | Tables search_logs + colonne avatars | ☐ |
| 2 | `add-avatar-url-to-users.sql` | Colonne `users.avatar_url` | ☐ |
| 3 | `add-brand-request-campaigns.sql` | Table de liaison brand_requests ↔ campaigns | ☐ |
| 4 | `bigfive-decrypte-registrations.sql` | Table `decrypte_registrations` | ☐ |
| 5 | `decrypte-sessions.sql` | Table `decrypte_sessions` + lien `decrypte_registrations.session_id` | ☐ |
| 6 | `deprecate-free-plan.sql` | Bascule des users `Free` vers `Discovery` | ☐ |
| 7 | `rename-plan-free-to-discovery.sql` | Renommage du plan en BDD | ☐ |
| 8 | `security-rls-fixes.sql` | Patchs RLS divers | ☐ |
| 9 | `fix-subscription-audit.sql` | Audit + correctifs subscription | ☐ |
| 10 | `pending-plan-downgrade.sql` | Colonnes `pending_plan*` pour downgrade différé | ☐ |
| 11 | `add-is-beta-tester-to-users.sql` | Colonne `users.is_beta_tester` (cohortes / bêta-testeurs ajoutés en masse) | ☐ |
| 12 | `migrations/20260524_campaigns_rls.sql` | RLS sur `campaigns` : lecture publiée uniquement, colonnes premium (analyse/how_to_use) masquées à `anon`. Ferme l'accès direct à l'API Supabase sans compte. | ☐ |
| 13 | `migrations/20260524_campaigns_rls_authenticated.sql` | Backstop : retire `analyse`/`how_to_use` au rôle `authenticated`. **À appliquer APRÈS déploiement du code** (dashboard + détail passés en server actions). Ferme la lecture des champs premium par un compte connecté non-payant via son JWT. | ☐ |

## Scripts ponctuels (one-shot)

| Script | Quand l'utiliser |
|---|---|
| *`reset-all-users-to-discovery.sql`* | Reset complet (DEV/staging uniquement) |
| *`reset-all-users-usage-counters.sql`* | Réinitialiser les compteurs mensuels |
| *`delete-users-by-email.sql`* | Suppression ciblée (RGPD / nettoyage) |
| *`audit-test-user-decouverte.sql`* | Audit ponctuel d'un user Discovery |
| *`rollback-jhouedanou-downgrade.sql`* | Rollback spécifique downgrade involontaire |

## Variantes / dev

- `decrypte-sessions-simple.sql` — version sans seed data
- `decrypte-sessions-with-samples.sql` — version avec seed data de test

## Procédure d'application

1. **Backup BDD** avant toute migration (Supabase Dashboard → Database → Backups).
2. Ouvrir Supabase SQL Editor.
3. Coller le contenu du script (1 à la fois).
4. Run. Vérifier message succès.
5. Cocher la case ici (commit du MD).
6. Tester côté app que la feature concernée marche.

## Note

Pas de système de versioning de schéma (style Prisma migrate / Supabase migrations CLI) — ce fichier est la seule source de vérité de l'état du schéma. Si quelqu'un applique un script hors séquence ou ne met pas à jour cette table, la prod et la dev divergent.

**À faire un jour** : migrer vers Supabase CLI migrations (`supabase migration new`) pour avoir un système robuste.
