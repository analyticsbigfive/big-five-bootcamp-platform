# Audit #BigFiveDécrypte — État de l'implémentation

**Date** : 2026-05-18
**Branche** : fix/subscription-audit

## Périmètre audité

- API : `app/api/decrypte/register/route.ts`, `app/api/decrypte/sessions/route.ts`
- API admin : `app/api/admin/decrypte/{route,sync,export,delete,sessions}.ts`
- UI : `app/decrypte/page.tsx`, `app/admin/decrypte/{page,sessions}.tsx`
- Schémas : `scripts/bigfive-decrypte-registrations.sql`, `scripts/decrypte-sessions.sql`
- Lien admin : `app/admin/layout.tsx:41`

## Verdict général

**Implémentation fonctionnelle et correctement gatée (Pro-only).** Quelques angles morts résiduels listés ci-dessous, aucun bloquant.

---

## OK — vérifié

| Vérification | Statut |
|---|---|
| Gate Pro strict côté serveur (`POST /api/decrypte/register`) | OK — `resolveTier !== 'pro'` → 403 |
| Gate Pro strict côté sessions (`GET /api/decrypte/sessions`) | OK |
| Vérif capacité (`max_seats`) avant insert | OK |
| Anti-doublon (user_id, session_id) via unique index | OK |
| Fallback gracieux si tables absentes (`42P01`) | OK — message admin clair |
| Sync Mailchimp non bloquante (best-effort) avec retry admin | OK |
| RLS activée sur `decrypte_registrations` + `decrypte_sessions` | OK |
| Consent contact obligatoire avant insert | OK |
| Auth requise (Supabase server session) | OK |
| Snapshot des titres campagnes dans la session | OK |

---

## ⚠ À corriger (non-bloquant)

### 1. Migration sessions pas garantie appliquée en prod

**Fichier** : `app/api/decrypte/register/route.ts:159`

Le code détecte `relation .*decrypte_sessions.* does not exist` et tombe en fallback "session du mois". Le `MEMORY.md` confirme la migration est encore à appliquer.

**Action** : exécuter `scripts/decrypte-sessions.sql` sur Supabase prod, puis retirer le fallback dans 1-2 releases.

### 2. Pas de gate Pro sur le check d'éligibilité GET

**Fichier** : `app/api/decrypte/register/route.ts:368-447`

Le `GET /api/decrypte/register` renvoie `canAccess: tier === 'pro'` mais ne refuse pas la requête pour les non-Pro. C'est par design (UI affiche un upsell) — vérifier que le GET ne fuite pas d'infos sensibles. Audit OK : retourne seulement `currentTier` + `sessionMonth` + sa propre inscription. **Pas de fuite.**

### 3. Email = email de session, pas profil

**Fichier** : `app/api/decrypte/register/route.ts:113`

`email` est forcé depuis `profile.email || user.email`. Si le user change son email Supabase mais que `users.email` n'est pas sync, doublon possible avec ancienne inscription. **Mineur** — peut générer un 23505 propre. OK.

### 4. Mailchimp audience non vérifiée avant insert

**Fichier** : `app/api/decrypte/register/route.ts:314-345`

Si `mailchimp_decrypte_audience_id` est vide, l'upsert utilise l'audience principale. L'admin doit savoir qu'il faut configurer cette audience séparée dans Admin → Mailchimp. **À documenter dans l'UI admin.**

### 5. `decrypte_registrations.email` non-unique

Aucun index unique sur `email` — un même email peut s'inscrire plusieurs fois avec `user_id NULL`. Pour l'instant `user_id` est toujours présent (auth requise) donc impact nul. **À surveiller si on ouvre un mode invité.**

### 6. Reset compteur de places sur changement de session

Pas de gestion du cas où un user change de session (delete reg + create new). Aujourd'hui : pas de bouton "désinscrire" → user bloqué sur sa première inscription. **Feature manquante mais probablement intentionnelle.**

### 7. Pas de notification Slack/email à l'équipe

Quand un Pro s'inscrit, seul Mailchimp est notifié. Pas d'alerte interne. **À ajouter si volume faible.**

---

## ✓ Sécurité — RAS

- Service role keys uniquement côté serveur
- IP + UA loggés
- Pas d'injection SQL (ORM Supabase paramétré)
- Slicing strict des inputs (`.slice(0, N)`)
- RLS bloque les writes anon

---

## Recommandations prioritaires

1. **Appliquer `scripts/decrypte-sessions.sql` sur prod** (sinon les sessions ne marchent pas).
2. **Configurer `mailchimp_decrypte_audience_id`** dans Admin → Mailchimp + ajouter un check UI.
3. **Tester end-to-end** : register Pro → Mailchimp tag `bigfive-decrypte` posé → admin voit la ligne avec `mailchimp_status: subscribed`.

Aucun changement de code requis pour cet audit — l'implémentation est saine.
