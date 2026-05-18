# Audit sécurité & incohérences — Laveiye

**Date** : 2026-05-18
**Périmètre** : `app/api/**`, `app/admin/**`, `lib/**`, `utils/supabase/**`, content rendering
**Tag** : 🔴 critique · 🟠 important · 🟡 mineur · ⚪ incohérence

---

## 🔴 Critiques (à corriger avant prod)

### 1. Fallback `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY` — 19 fichiers

Si `SUPABASE_SERVICE_ROLE_KEY` absente en prod, ces routes tombent sur la clé ANON. Conséquences :
- Les `from('users').update(...)` admin échouent silencieusement (RLS bloque) → bugs invisibles.
- Pire : sur les tables sans RLS, l'écriture passe avec privilèges anonymes → potentielle écriture arbitraire si JWT compromis.

Fichiers : `app/actions/user.ts`, `app/actions/creative.ts`, `lib/supabase.ts:83`, `app/api/payment/check/[ref_command]/route.ts:20`, `app/api/payment/receipt/[id]/route.ts:44`, `app/api/admin/cancellation-requests/route.ts:32`, `app/api/upload/route.ts:95`.

**Fix** : supprimer le fallback. Si `SERVICE_ROLE_KEY` absente, throw au boot. Le code n'a pas de raison d'opérer "à demi-privilège" — soit admin, soit auth user via `getSupabaseServer()`.

```ts
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required')
```

### 2. XSS via `dangerouslySetInnerHTML` + `formatDescription` bypass

[app/content/[id]/content-detail-client.tsx:87-108](app/content/%5Bid%5D/content-detail-client.tsx#L87)

```ts
if (/<[a-z][\s\S]*>/i.test(text)) return text  // PASS-THROUGH, AUCUN SANITIZE
```

Si une description campagne contient déjà du HTML (ex : `<script>...</script>`), elle est rendue brute. Vector :
- Admin compromis injecte `<script>` dans `campaigns.description` → XSS sur tous les visiteurs de la page campagne.
- Pas de défense en profondeur.

**Fix** : utiliser `DOMPurify` (`isomorphic-dompurify`) sur tous les rendus `dangerouslySetInnerHTML`. Concerne aussi `app/admin/brand-requests/page.tsx:567`, `app/admin/campaigns/page.tsx:820-847`.

### 3. `/api/users/[id]/favorites` — IDOR public

[app/api/users/[id]/favorites/route.ts](app/api/users/%5Bid%5D/favorites/route.ts)

Endpoint accepte n'importe quel `id`, retourne tous les favoris du user **sans auth**. Si les favoris sont supposés privés → leak. Si publics → OK mais à documenter.

**Fix** : soit ajouter `auth.getUser()` + check ownership (utilisateur ne voit que ses propres favoris OU profils publics opt-in), soit confirmer que c'est intentionnel et ajouter un flag `profile.is_public`.

### 4. Pas de rate-limiting sur endpoints sensibles

Seul `/api/payment/subscribe` rate-limite (sur le code promo). Endpoints exposés :
- `/api/promo/validate` (POST) — brute force code promo (LAVEIYE-XXXX = 32^4 ≈ 1M combinations, plus l'email).
- `/api/keynote/register` (POST) — spam d'inscriptions.
- `/api/auth/register` (POST) — création de comptes en masse.
- `/api/admin/change-password` (POST) — brute force mot de passe admin.
- `/api/payment/check/[ref_command]` (POST) — polling abusif.

**Fix** : appliquer `rateLimit()` (déjà dispo dans `lib/rate-limit.ts`) à ces routes. Critique pour change-password admin.

---

## 🟠 Importants

### 5. Stack traces / error.message renvoyés côté client

13 occurrences. Ex `app/api/payment/subscribe/route.ts:433` :
```ts
message: error instanceof Error ? error.message : 'Unknown error'
```

Renvoie messages d'erreur DB Supabase au client en prod → fuite de schéma / contraintes / col names.

**Fix** : envelopper dans `if (process.env.NODE_ENV !== 'production')`. Renvoyer message générique en prod.

### 6. Injection PostgREST `.or()` via wildcards et virgules

Endpoints concernés : `app/api/users/route.ts:45`, `app/api/admin/keynote/route.ts:28`, `app/api/contents/route.ts:48`, `app/api/payment/check/route.ts:107-111`, `app/api/admin/decrypte/route.ts:46`.

```ts
query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%`)
```

Pas de SQL injection (parameterized), mais :
- `search = "a,b"` → casse la syntaxe `.or()`, produit deux conditions au lieu d'une → résultats inattendus.
- `search = "%"` ou `"_"` → wildcard SQL non échappé (match tout).

**Fix** : escape `[,_%\\]` avant interpolation, ou utiliser builder chainé `.or([{}, {}])`.

### 7. `getSubscriptionDaysLeft` calcule en jours absolus

[app/admin/users/user-row.tsx:60-66](app/admin/users/user-row.tsx#L60) utilise `Math.ceil` → 0.5j restant = 1j affiché. Pas dramatique mais peut induire user en erreur ("il me reste 1 jour" alors qu'il expire dans 2h).

**Fix** : passer en heures sous 24h, jours au-delà.

### 8. `getOrigin` / `NEXT_PUBLIC_APP_URL` en localhost

`.env.local` a `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Utilisé par PawaPay callbacks, getReturnUrl, emails. En prod Vercel doit être surchargé. Si pas surchargé → emails et callbacks pointent vers localhost.

**Fix** : ajouter check au boot : si `NODE_ENV=production` et `NEXT_PUBLIC_APP_URL` contient `localhost` → throw.

### 9. Migrations non documentées comme appliquées

Pas de table `schema_migrations` ni de README listant les scripts appliqués. Risque : appliquer 2× la même migration ou en oublier (cf. `decrypte-sessions.sql`, `pending-plan-downgrade.sql`).

**Fix** : ajouter `MIGRATIONS_LOG.md` listant date + ordre d'exécution, ou utiliser Supabase migrations CLI.

---

## 🟡 Mineurs

### 10. `console.log` verbeux sur endpoints prod

`app/api/admin/keynote/sync/route.ts` log settings, audienceId, etc. à chaque appel. Côté Vercel ça remplit les logs et expose la config en cas d'accès aux logs.

**Fix** : passer en `console.debug` ou wrap derrière `process.env.NODE_ENV !== 'production'`.

### 11. Codes promo single-use mais pas verrouillés transactionnellement

`/api/payment/subscribe` check `promo_redeemed_at IS NULL` PUIS plus tard marque `redeemed_at`. Entre les deux, race possible (2 paiements parallèles avec même code → 2 subscriptions activées avant que le callback marque le code).

Le check `pending_payments` ligne 165 atténue le risque, mais n'est pas un lock fort.

**Fix** : table `promo_locks` + UPDATE conditionnel atomique `UPDATE ... SET redeemed_at = now() WHERE promo_code = $1 AND redeemed_at IS NULL RETURNING *`. Si retour vide → 409.

### 12. `PAWAPAY_VERIFY_IP` désactivé par défaut en dev

[lib/pawapay.ts:81](lib/pawapay.ts#L81) — bien que safeguard en prod, on peut accidentellement la désactiver via `PAWAPAY_DISABLE_IP_CHECK=true`. À supprimer ou ajouter une alerte.

### 13. `app/api/users/profiles` expose `plan` publiquement

Pas sensible en soi (déjà visible côté UI public), mais permet de lister tous les abonnés Pro/Basic sans auth.

---

## ⚪ Incohérences (non-sécurité)

### 14. Two routes pour /api/payment/check
- `/api/payment/check/route.ts` (search/admin)
- `/api/payment/check/[ref_command]/route.ts` (polling)

Convention OK mais les deux exportent POST avec sémantiques différentes. Doc à clarifier.

### 15. Plans : `Discovery|Basic|Pro` vs `discovery|basic|pro|free`

Le code mélange `planKey === 'free'` (deprecated), `Discovery` (DB casing), `discovery` (URL param). Géré au cas par cas via lowercase, mais source de bugs subtils (cf. bug downgrade qu'on vient de fixer).

**Fix** : un seul helper `normalizePlan(plan): 'discovery' | 'basic' | 'pro'` utilisé partout. Supprimer toute mention de `free`.

### 16. `subscription_status` vs `pending_plan` vs `subscription_end_date`

3 sources de vérité pour "quel plan a le user maintenant". Le cron `check-subscriptions` gère, mais entre deux runs cron, la cohérence dépend du code applicatif. Lazy-check au login serait plus robuste.

**Fix** : helper `getEffectiveSubscription(user)` qui applique la logique au runtime (pending → current si expiré) sans attendre le cron.

### 17. `keynote_registrations.email` sans index unique

Possible doublons si concurrence (l'API check + insert, pas un seul UPSERT). Très peu probable mais documenté dans audit décrypte.

### 18. PawaPay token sandbox commité dans `.env.local`

`.env.local` est gitignored, OK, mais le token est visible dans la conversation et dans le fichier local. Risque uniquement si dump du repo.

### 19. Route `/api/auth/[...nextauth]` morte

Documenté dans `CLAUDE.md` : exists mais login utilise Supabase direct. Erreurs TS dans le fichier. Soit supprimer, soit garder propre.

### 20. Rename incomplet "Suivi de marques" → "Veille concurrentielle"

- Routes BDD/API gardent `brand_requests` / `brand-monitoring` : OK pour stabilité.
- Restent textes user-facing avec ancien nom :
  - `app/pricing/page.tsx:230` ("suivi des campagnes, alertes ciblées")
  - `app/api/brand-requests/route.ts:30` (commentaire)
  - `app/api/brands/route.ts:5` (commentaire)
  - Plusieurs `console.log` et commentaires

**Action** : laisser routes/commentaires, vérifier qu'aucun string user-facing ne dit encore "suivi de marques".

---

## Recommandations priorisées

1. **Cette semaine** : items 1, 2, 3, 4 (critiques sécurité).
2. **Avant prod PawaPay** : items 5, 8 (NEXT_PUBLIC_APP_URL).
3. **Sprint suivant** : items 6, 11, 15, 16.
4. **Backlog** : reste.

Aucun bug bloquant ne nécessite hotfix immédiat, mais 1+2+3 doivent partir avec le prochain déploiement.
