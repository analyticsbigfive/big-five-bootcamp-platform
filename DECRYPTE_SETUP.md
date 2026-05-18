# BigFiveDecrypte - Setup des sessions

## Problem
L'utilisateur voit "Vous êtes déjà inscrit" mais ne peut rien choisir car la table `decrypte_sessions` n'existe pas encore.

## Solution rapide (5 min)

### 1. Aller dans Supabase
- Ouvre **Supabase Dashboard** → ton projet
- Onglet **SQL Editor**
- Crée une nouvelle requête

### 2. Copie-colle le script complet
Fichier: `scripts/decrypte-sessions-with-samples.sql`

Copie tout le contenu et exécute-le dans Supabase SQL Editor.

### 3. Résultat
✅ Table `decrypte_sessions` créée
✅ 3 sessions de test ajoutées (2 ouvertes, 1 brouillon)
✅ Indexes et RLS configurés

---

## Vérification

Après l'exécution :
- Retour à `/decrypte` → tu devrais voir les sessions avec des radio buttons
- Admin : `/admin/decrypte/sessions` → tableau des sessions + bouton « Nouvelle seance »

---

## Données des sessions de test
- **Décrypte #1 (Mai)** : ouverture + 5 jours, 25 places
- **Décrypte #2 (Juin)** : ouverture + 35 jours, 30 places  
- **Décrypte #3 (Juillet)** : brouillon (draft), 20 places

Pour modifier les dates/places/titres : utilise l'admin UI `/admin/decrypte/sessions`.
