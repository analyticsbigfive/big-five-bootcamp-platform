/**
 * fix-encoding-db.mjs
 * Script Node.js pour corriger les textes corrompus (U+FFFD) directement dans Supabase.
 * Le script SQL ne fonctionne pas car les bytes U+FFFD ne sont pas matchés par chr(195).
 * Ce script lit les campagnes, applique fixBrokenEncoding en JS, et les réécrit.
 *
 * Usage: node --env-file=.env.local scripts/fix-encoding-db.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

const envLocalPath = resolve(process.cwd(), '.env.local')
const envPath = resolve(process.cwd(), '.env')

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath })
} else if (existsSync(envPath)) {
  config({ path: envPath })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Variables manquantes : NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ---- fixBrokenEncoding (copie de lib/utils.ts) ----
const BROKEN_WORD_MAP = [
  // PHASE 1 : Mots complets multi-FFFD
  [/t\uFFFDl\uFFFDphone/gi, 'téléphone'],
  [/t\uFFFDl\uFFFDchargement/gi, 'téléchargement'],
  [/b\uFFFDn\uFFFDfice/gi, 'bénéfice'],
  [/c\uFFFDt\uFFFD/g, 'côté'],
  [/soci\uFFFDt\uFFFD/gi, 'société'],
  [/s\uFFFDcurit\uFFFD/gi, 'sécurité'],
  [/r\uFFFDf\uFFFDrence/gi, 'référence'],
  [/g\uFFFDn\uFFFDr/gi, 'génér'],
  [/\uFFFDv\uFFFDnement/gi, 'événement'],
  [/connect\uFFFD\uFFFD/g, 'connecté»'],
  // PHASE 2 : Mots complets mono-FFFD
  [/ann\uFFFDe/gi, 'année'],
  [/cr\uFFFDa/gi, 'créa'],
  [/cr\uFFFDdit/gi, 'crédit'],
  [/cr\uFFFDer/gi, 'créer'],
  [/centr\uFFFD/g, 'centré'],
  [/connect\uFFFD/g, 'connecté'],
  [/associ\uFFFDes/gi, 'associées'],
  [/pr\uFFFDsence/gi, 'présence'],
  [/sugg\uFFFDre/gi, 'suggère'],
  [/utilis\uFFFD/g, 'utilisé'],
  [/utilit\uFFFD/g, 'utilité'],
  [/march\uFFFD/g, 'marché'],
  [/qualit\uFFFD/g, 'qualité'],
  [/activit\uFFFD/g, 'activité'],
  [/libert\uFFFD/g, 'liberté'],
  [/communaut\uFFFD/g, 'communauté'],
  [/r\uFFFDseau/gi, 'réseau'],
  [/num\uFFFDrique/gi, 'numérique'],
  [/strat\uFFFDg/gi, 'stratég'],
  [/m\uFFFDdia/gi, 'média'],
  [/exp\uFFFDrience/gi, 'expérience'],
  [/diff\uFFFDrent/gi, 'différent'],
  [/int\uFFFDgr/gi, 'intégr'],
  [/r\uFFFDpond/gi, 'répond'],
  [/plut\uFFFDt/gi, 'plutôt'],
  [/\uFFFDmotionnelle/gi, 'émotionnelle'],
  [/\uFFFDmotion/gi, 'émotion'],
  [/\uFFFDnergie/gi, 'énergie'],
  [/\uFFFDconomie/gi, 'économie'],
  [/\uFFFDquipe/gi, 'équipe'],
  [/\uFFFDcran/gi, 'écran'],
  [/\uFFFDl\uFFFDment/gi, 'élément'],
  // PHASE 3 : Noms propres
  [/C\uFFFDte d['\u2019]Ivoire/gi, "Côte d'Ivoire"],
  [/C\uFFFDte d\uFFFDIvoire/gi, "Côte d'Ivoire"],
  [/Cody\uFFFDs/g, "Cody's"],
  // PHASE 4 : Apostrophe contextuelle
  [/\bl\uFFFD(?=[aeiouyàâäéèêëîïôùûüh])/g, "l'"],
  [/\bd\uFFFD(?=[aeiouyàâäéèêëîïôùûüh])/g, "d'"],
  [/\bs\uFFFD(?=[aeiouyàâäéèêëîïôùûüh])/g, "s'"],
  [/\bn\uFFFD(?=[aeiouyàâäéèêëîïôùûüh])/g, "n'"],
  [/\bqu\uFFFD(?=[aeiouyàâäéèêëîïôùûüh])/g, "qu'"],
  [/\bj\uFFFD(?=[aeiouyàâäéèêëîïôùûüh])/g, "j'"],
  [/\bL\uFFFD(?=[aeiouyàâäéèêëîïôùûüh])/g, "L'"],
  [/\bD\uFFFD(?=[aeiouyàâäéèêëîïôùûüh])/g, "D'"],
  [/\bS\uFFFD(?=[aeiouyàâäéèêëîïôùûüh])/g, "S'"],
  [/\bN\uFFFD(?=[aeiouyàâäéèêëîïôùûüh])/g, "N'"],
  [/\bJ\uFFFD(?=[aeiouyàâäéèêëîïôùûüh])/g, "J'"],
  [/(?<=\s)l\uFFFD/g, "l'"],
  [/(?<=\s)d\uFFFD/g, "d'"],
  [/(?<=\s)L\uFFFD/g, "L'"],
  [/(?<=\s)D\uFFFD/g, "D'"],
  // PHASE 5 : à isolé
  [/(?<=\s)\uFFFD(?=\s)/g, 'à'],
  [/\bqu\uFFFD(?=\s)/g, "qu'à"],
  // PHASE 6 : Guillemets
  [/(?<![a-zA-ZàâäéèêëîïôùûüçÀÂÉÈÊËÎÏÔÙÛÜÇ'])\uFFFD(?=[a-zA-ZàâäéèêëîïôùûüçÀÂÉÈÊËÎÏÔÙÛÜÇ])/g, '«\u00A0'],
  [/(?<=[a-zA-ZàâäéèêëîïôùûüçÀÂÉÈÊËÎÏÔÙÛÜÇ])\uFFFD(?=[\s.,;:!?\n)]|$)/g, '\u00A0»'],
  // PHASE 7 : Fallback
  [/\uFFFD/g, "'"],
]

function fixBrokenEncoding(text) {
  if (!text || !text.includes('\uFFFD')) return text
  let result = text
  for (const [pattern, replacement] of BROKEN_WORD_MAP) {
    result = result.replace(pattern, replacement)
  }
  return result
}

// Country normalization
const COUNTRY_ALIASES = {
  "cote d'ivoire": "Côte d'Ivoire",
  "côte d'ivoire": "Côte d'Ivoire",
  "senegal": "Sénégal",
  "sénégal": "Sénégal",
  "benin": "Bénin",
  "bénin": "Bénin",
  "guinee": "Guinée",
  "guinée": "Guinée",
  "cameroon": "Cameroun",
  "cameroun": "Cameroun",
}

function normalizeCountry(c) {
  if (!c) return c
  const trimmed = c.trim()
  const fixed = fixBrokenEncoding(trimmed)
  return COUNTRY_ALIASES[fixed.toLowerCase()] ?? fixed
}

// ---- Main ----
async function main() {
  console.log('🔍 Lecture de toutes les campagnes...')
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, title, description, summary, brand, agency, country, category, format')

  if (error) {
    console.error('❌ Erreur lecture:', error)
    process.exit(1)
  }

  console.log(`📦 ${campaigns.length} campagnes trouvées`)

  const TEXT_FIELDS = ['title', 'description', 'summary', 'brand', 'agency', 'category', 'format']
  let updated = 0

  for (const campaign of campaigns) {
    const changes = {}
    let hasChanges = false

    for (const field of TEXT_FIELDS) {
      const original = campaign[field]
      if (original && original.includes('\uFFFD')) {
        changes[field] = fixBrokenEncoding(original)
        hasChanges = true
      }
    }

    // Normaliser country
    if (campaign.country) {
      const normalized = normalizeCountry(campaign.country)
      if (normalized !== campaign.country) {
        changes.country = normalized
        hasChanges = true
      }
    }

    if (hasChanges) {
      const { error: updateError } = await supabase
        .from('campaigns')
        .update(changes)
        .eq('id', campaign.id)

      if (updateError) {
        console.error(`❌ Erreur update ${campaign.id}:`, updateError.message)
      } else {
        updated++
        const fields = Object.keys(changes).join(', ')
        console.log(`✅ ${campaign.id} → corrigé: ${fields}`)
        // Afficher un aperçu du titre si corrigé
        if (changes.title) {
          console.log(`   "${campaign.title}" → "${changes.title}"`)
        }
      }
    }
  }

  console.log(`\n🎉 Terminé! ${updated} campagne(s) corrigée(s) sur ${campaigns.length}`)

  // Vérification finale
  const { data: check } = await supabase
    .from('campaigns')
    .select('country')
    .not('country', 'is', null)

  if (check) {
    const countries = [...new Set(check.map(c => c.country).filter(Boolean))].sort()
    console.log('\n📊 Pays distincts après correction:')
    countries.forEach(c => {
      const count = check.filter(r => r.country === c).length
      console.log(`   ${c}: ${count}`)
    })

    // Vérifier s'il reste des U+FFFD
    const { data: remaining } = await supabase
      .from('campaigns')
      .select('id, title')
      .like('title', '%\uFFFD%')
      .limit(5)

    if (remaining && remaining.length > 0) {
      console.log('\n⚠️  Il reste des U+FFFD dans les titres:')
      remaining.forEach(r => console.log(`   ${r.id}: ${r.title}`))
    } else {
      console.log('\n✅ Aucun U+FFFD restant dans les titres!')
    }
  }
}

main().catch(console.error)
