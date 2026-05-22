/**
 * Liste centralisée des opérateurs Mobile Money supportés via PawaPay.
 *
 * ⚠️ Wave est volontairement traité hors de cette liste dans le parcours
 * produit actuel. Si vous activez WAVE_CIV/WAVE_SEN côté PawaPay, ajoutez-les
 * ici et vérifiez le flow REDIRECT_AUTH.
 *
 * Source : configuration officielle PawaPay (https://docs.pawapay.io)
 * + matrice opérateurs / pays / devises fournie par la direction produit.
 *
 * Pour chaque pays nous listons les opérateurs effectivement activés sur
 * notre compte marchand PawaPay. Si vous activez un nouveau MMO dans le
 * Dashboard PawaPay (Configuration → Active correspondents), ajoutez-le ici.
 */

export type PawaPayCountryCode =
  | 'CIV' // Côte d'Ivoire
  | 'SEN' // Sénégal
  | 'BFA' // Burkina Faso
  | 'BEN' // Bénin
  | 'MLI' // Mali
  | 'TGO' // Togo
  | 'CMR' // Cameroun
  | 'NER' // Niger

export interface PawaPayCountryConfig {
  name: string
  flag: string
  dialCode: string      // sans le +
  localLength: number   // nombre de chiffres après l'indicatif
  mask: number[]        // groupes pour le masque d'affichage
  placeholder: string
  currency: 'XOF' | 'XAF'
}

export const PAWAPAY_COUNTRIES: Record<PawaPayCountryCode, PawaPayCountryConfig> = {
  CIV: { name: "Côte d’Ivoire", flag: "🇨🇮", dialCode: "225", localLength: 10, mask: [2, 2, 2, 2, 2], placeholder: "07 07 12 34 56", currency: 'XOF' },
  SEN: { name: "Sénégal",       flag: "🇸🇳", dialCode: "221", localLength: 9,  mask: [2, 3, 2, 2],    placeholder: "77 123 45 67",    currency: 'XOF' },
  BFA: { name: "Burkina Faso",  flag: "🇧🇫", dialCode: "226", localLength: 8,  mask: [2, 2, 2, 2],    placeholder: "70 12 34 56",     currency: 'XOF' },
  BEN: { name: "Bénin",         flag: "🇧🇯", dialCode: "229", localLength: 10, mask: [2, 2, 2, 2, 2], placeholder: "01 90 12 34 56",  currency: 'XOF' },
  MLI: { name: "Mali",          flag: "🇲🇱", dialCode: "223", localLength: 8,  mask: [2, 2, 2, 2],    placeholder: "70 12 34 56",     currency: 'XOF' },
  TGO: { name: "Togo",          flag: "🇹🇬", dialCode: "228", localLength: 8,  mask: [2, 2, 2, 2],    placeholder: "90 12 34 56",     currency: 'XOF' },
  CMR: { name: "Cameroun",      flag: "🇨🇲", dialCode: "237", localLength: 9,  mask: [3, 3, 3],       placeholder: "6 70 12 34 56",   currency: 'XAF' },
  NER: { name: "Niger",         flag: "🇳🇪", dialCode: "227", localLength: 8,  mask: [2, 2, 2, 2],    placeholder: "90 12 34 56",     currency: 'XOF' },
}

export interface PawaPayProvider {
  /** Code provider PawaPay (ex. "ORANGE_CIV"). */
  value: string
  /** Libellé affiché dans l'UI. */
  label: string
  /** Code pays ISO interne. */
  country: PawaPayCountryCode
  /** Devise utilisée par ce provider. */
  currency: 'XOF' | 'XAF'
}

/**
 * Liste effective des providers PawaPay activés.
 *
 * Wave est **volontairement exclu** du parcours produit courant. PawaPay
 * expose désormais des providers Wave en REDIRECT_AUTH : ne les ajoutez ici
 * que si ce flow est activé et testé.
 */
export const PAWAPAY_PROVIDERS: PawaPayProvider[] = [
  // Côte d'Ivoire (XOF)
  { value: 'MTN_MOMO_CIV', label: 'MTN Mobile Money — Côte d’Ivoire', country: 'CIV', currency: 'XOF' },
  { value: 'ORANGE_CIV',   label: 'Orange Money — Côte d’Ivoire',     country: 'CIV', currency: 'XOF' },
  { value: 'MOOV_CIV',     label: 'Moov Money — Côte d’Ivoire',       country: 'CIV', currency: 'XOF' },

  // Sénégal (XOF) — Wave reste traité hors de cette liste.
  { value: 'ORANGE_SEN',   label: 'Orange Money — Sénégal',           country: 'SEN', currency: 'XOF' },
  { value: 'FREE_SEN',     label: 'Free Money — Sénégal',             country: 'SEN', currency: 'XOF' },

  // Burkina Faso (XOF)
  { value: 'ORANGE_BFA',   label: 'Orange Money — Burkina Faso',      country: 'BFA', currency: 'XOF' },
  { value: 'MOOV_BFA',     label: 'Moov Money — Burkina Faso',        country: 'BFA', currency: 'XOF' },

  // Bénin (XOF)
  { value: 'MTN_MOMO_BEN', label: 'MTN Mobile Money — Bénin',         country: 'BEN', currency: 'XOF' },
  { value: 'MOOV_BEN',     label: 'Moov Money — Bénin',               country: 'BEN', currency: 'XOF' },

  // Mali (XOF)
  { value: 'ORANGE_MLI',   label: 'Orange Money — Mali',              country: 'MLI', currency: 'XOF' },
  { value: 'MOOV_MLI',     label: 'Moov Money — Mali',                country: 'MLI', currency: 'XOF' },

  // Togo (XOF)
  { value: 'MOOV_TGO',     label: 'Moov Money — Togo',                country: 'TGO', currency: 'XOF' },

  // Cameroun (XAF)
  { value: 'MTN_MOMO_CMR', label: 'MTN Mobile Money — Cameroun',      country: 'CMR', currency: 'XAF' },
  { value: 'ORANGE_CMR',   label: 'Orange Money — Cameroun',          country: 'CMR', currency: 'XAF' },

  // Niger (XOF)
  { value: 'MOOV_NER',     label: 'Moov Money — Niger',               country: 'NER', currency: 'XOF' },
]

/** Retourne les providers disponibles pour un pays donné. */
export function getProvidersForCountry(country: PawaPayCountryCode): PawaPayProvider[] {
  return PAWAPAY_PROVIDERS.filter((p) => p.country === country)
}

/**
 * Map préfixes locaux → code provider PawaPay.
 *
 * Ces préfixes reflètent l'attribution d'origine des plans nationaux
 * (ARCEP/ARTP/ARTCI/ART/UIT). Avec la portabilité des numéros, ils restent
 * une aide de pré-sélection et ne remplacent pas une vérification opérateur.
 */
const PHONE_PREFIX_MAP: Record<PawaPayCountryCode, Array<[string, string]>> = {
  CIV: [
    ['01', 'MOOV_CIV'],
    ['05', 'MTN_MOMO_CIV'],
    ['07', 'ORANGE_CIV'],
  ],
  SEN: [
    ['77', 'ORANGE_SEN'], ['78', 'ORANGE_SEN'],
    ['76', 'FREE_SEN'],
  ],
  BFA: [
    ['01', 'MOOV_BFA'], ['02', 'MOOV_BFA'], ['03', 'MOOV_BFA'],
    ['50', 'MOOV_BFA'], ['51', 'MOOV_BFA'], ['52', 'MOOV_BFA'],
    ['60', 'MOOV_BFA'], ['61', 'MOOV_BFA'], ['62', 'MOOV_BFA'], ['63', 'MOOV_BFA'],
    ['70', 'MOOV_BFA'], ['71', 'MOOV_BFA'], ['72', 'MOOV_BFA'], ['73', 'MOOV_BFA'],
    ['05', 'ORANGE_BFA'], ['06', 'ORANGE_BFA'], ['07', 'ORANGE_BFA'],
    ['54', 'ORANGE_BFA'], ['55', 'ORANGE_BFA'], ['56', 'ORANGE_BFA'], ['57', 'ORANGE_BFA'],
    ['64', 'ORANGE_BFA'], ['65', 'ORANGE_BFA'], ['66', 'ORANGE_BFA'], ['67', 'ORANGE_BFA'],
    ['74', 'ORANGE_BFA'], ['75', 'ORANGE_BFA'], ['76', 'ORANGE_BFA'], ['77', 'ORANGE_BFA'],
  ],
  BEN: [
    ['42', 'MTN_MOMO_BEN'], ['46', 'MTN_MOMO_BEN'],
    ['50', 'MTN_MOMO_BEN'], ['51', 'MTN_MOMO_BEN'], ['52', 'MTN_MOMO_BEN'], ['53', 'MTN_MOMO_BEN'], ['54', 'MTN_MOMO_BEN'],
    ['56', 'MTN_MOMO_BEN'], ['57', 'MTN_MOMO_BEN'], ['59', 'MTN_MOMO_BEN'],
    ['61', 'MTN_MOMO_BEN'], ['62', 'MTN_MOMO_BEN'],
    ['66', 'MTN_MOMO_BEN'], ['67', 'MTN_MOMO_BEN'], ['69', 'MTN_MOMO_BEN'],
    ['90', 'MTN_MOMO_BEN'], ['91', 'MTN_MOMO_BEN'], ['96', 'MTN_MOMO_BEN'], ['97', 'MTN_MOMO_BEN'],
    ['45', 'MOOV_BEN'], ['55', 'MOOV_BEN'], ['58', 'MOOV_BEN'],
    ['60', 'MOOV_BEN'], ['63', 'MOOV_BEN'], ['64', 'MOOV_BEN'], ['65', 'MOOV_BEN'], ['68', 'MOOV_BEN'],
    ['94', 'MOOV_BEN'], ['95', 'MOOV_BEN'], ['98', 'MOOV_BEN'], ['99', 'MOOV_BEN'],
  ],
  MLI: [
    ['70', 'ORANGE_MLI'], ['71', 'ORANGE_MLI'], ['72', 'ORANGE_MLI'], ['73', 'ORANGE_MLI'], ['74', 'ORANGE_MLI'],
    ['75', 'ORANGE_MLI'], ['76', 'ORANGE_MLI'], ['77', 'ORANGE_MLI'], ['78', 'ORANGE_MLI'], ['79', 'ORANGE_MLI'],
    ['60', 'MOOV_MLI'], ['61', 'MOOV_MLI'], ['62', 'MOOV_MLI'], ['63', 'MOOV_MLI'], ['64', 'MOOV_MLI'],
    ['65', 'MOOV_MLI'], ['66', 'MOOV_MLI'], ['67', 'MOOV_MLI'], ['68', 'MOOV_MLI'], ['69', 'MOOV_MLI'],
  ],
  TGO: [
    ['797', 'MOOV_TGO'], ['798', 'MOOV_TGO'], ['799', 'MOOV_TGO'],
    ['96', 'MOOV_TGO'], ['97', 'MOOV_TGO'], ['98', 'MOOV_TGO'], ['99', 'MOOV_TGO'],
  ],
  CMR: [
    ['650', 'MTN_MOMO_CMR'], ['651', 'MTN_MOMO_CMR'], ['652', 'MTN_MOMO_CMR'],
    ['653', 'MTN_MOMO_CMR'], ['654', 'MTN_MOMO_CMR'],
    ['670', 'MTN_MOMO_CMR'], ['671', 'MTN_MOMO_CMR'], ['672', 'MTN_MOMO_CMR'],
    ['673', 'MTN_MOMO_CMR'], ['674', 'MTN_MOMO_CMR'], ['675', 'MTN_MOMO_CMR'],
    ['676', 'MTN_MOMO_CMR'], ['677', 'MTN_MOMO_CMR'], ['678', 'MTN_MOMO_CMR'], ['679', 'MTN_MOMO_CMR'],
    ['680', 'MTN_MOMO_CMR'], ['681', 'MTN_MOMO_CMR'], ['682', 'MTN_MOMO_CMR'], ['683', 'MTN_MOMO_CMR'],
    ['655', 'ORANGE_CMR'], ['656', 'ORANGE_CMR'], ['657', 'ORANGE_CMR'],
    ['658', 'ORANGE_CMR'], ['659', 'ORANGE_CMR'],
    ['686', 'ORANGE_CMR'], ['687', 'ORANGE_CMR'], ['688', 'ORANGE_CMR'],
    ['690', 'ORANGE_CMR'], ['691', 'ORANGE_CMR'], ['692', 'ORANGE_CMR'],
    ['693', 'ORANGE_CMR'], ['694', 'ORANGE_CMR'], ['695', 'ORANGE_CMR'],
    ['696', 'ORANGE_CMR'], ['697', 'ORANGE_CMR'], ['698', 'ORANGE_CMR'], ['699', 'ORANGE_CMR'],
  ],
  NER: [
    ['74', 'MOOV_NER'], ['84', 'MOOV_NER'], ['85', 'MOOV_NER'],
    ['94', 'MOOV_NER'], ['95', 'MOOV_NER'],
  ],
}

function normalizeDigitsForPrefixLookup(
  digits: string,
  country: PawaPayCountryCode
): string {
  // Depuis le 30/11/2024, le Bénin ajoute "01" devant les anciens numéros.
  return country === 'BEN' && digits.startsWith('01') ? digits.slice(2) : digits
}

/**
 * Détecte le provider PawaPay depuis les premiers chiffres du numéro local.
 *
 * @param localDigits  Numéro local (sans indicatif pays), chiffres uniquement.
 * @param country      Code pays PawaPay.
 * @returns            Code provider (ex. "MTN_MOMO_CIV") ou null si inconnu.
 */
export function detectProviderFromPhone(
  localDigits: string,
  country: PawaPayCountryCode
): string | null {
  const digits = localDigits.replace(/\D/g, '')
  if (digits.length < 2) return null

  const lookupDigits = normalizeDigitsForPrefixLookup(digits, country)
  const entries = PHONE_PREFIX_MAP[country] ?? []

  const match = entries
    .slice()
    .sort(([a], [b]) => b.length - a.length)
    .find(([prefix]) => lookupDigits.startsWith(prefix))

  return match?.[1] ?? null
}
