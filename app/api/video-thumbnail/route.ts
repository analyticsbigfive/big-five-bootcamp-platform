import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { detectVideoPlatform, getYouTubeThumbnail } from "@/lib/video-utils";
import { checkAdmin } from "@/lib/admin-auth";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Anti-SSRF : refuse les URLs qui ne sont pas http(s) ou qui pointent vers
 * une adresse interne (loopback, réseaux privés RFC1918, link-local /
 * métadonnées cloud 169.254.169.254, etc.). Comme cet endpoint déclenche un
 * `fetch` côté serveur sur une URL fournie par l'admin, il pourrait sinon
 * servir à scanner le réseau interne ou lire les métadonnées de l'instance.
 */
function ipv4IsBlocked(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // format inattendu → on bloque par prudence
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + métadonnées cloud
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (bench)
  if (a >= 224) return true; // multicast + réservé
  return false;
}

function addressIsBlocked(addr: string): boolean {
  const v = isIP(addr);
  if (v === 4) return ipv4IsBlocked(addr);
  if (v === 6) {
    const lower = addr.toLowerCase();
    // IPv4-mappé (::ffff:a.b.c.d) → on revalide la partie v4.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipv4IsBlocked(mapped[1]);
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
    return false;
  }
  return true; // pas une IP reconnue → bloquer
}

async function assertPublicHttpUrl(raw: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('URL invalide');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Schéma non autorisé');
  }
  const host = parsed.hostname;
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(addressIsBlocked)) {
    throw new Error('Cible interne interdite');
  }
}

/**
 * `fetch` durci contre la SSRF : valide chaque saut (y compris les
 * redirections, gérées manuellement) avant de l'exécuter.
 */
async function ssrfSafeFetch(
  rawUrl: string,
  init: RequestInit,
  maxRedirects = 3
): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicHttpUrl(current);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('Trop de redirections');
}

/**
 * GET /api/video-thumbnail?url=VIDEO_URL
 * 
 * Récupère la thumbnail d'une vidéo depuis les réseaux sociaux.
 * Stratégies utilisées:
 * - YouTube: URL directe de l'API img.youtube.com
 * - Facebook: oEmbed API
 * - Twitter/X: oEmbed API (publish.twitter.com)
 * - LinkedIn: OpenGraph meta tags scraping
 * - Fallback: OpenGraph parsing pour tout URL
 */
export async function GET(request: NextRequest) {
  // Outil admin uniquement (utilisé par l'éditeur de campagnes). Sans cette
  // garde, l'endpoint déclenche des requêtes serveur arbitraires (SSRF) pour
  // tout visiteur anonyme.
  const admin = await checkAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }

  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  try {
    const platform = detectVideoPlatform(url);
    let thumbnailUrl: string | null = null;

    switch (platform) {
      case "youtube":
        thumbnailUrl = getYouTubeThumbnail(url);
        break;

      case "facebook":
        thumbnailUrl = await getFacebookThumbnail(url);
        break;

      case "twitter":
        thumbnailUrl = await getTwitterThumbnail(url);
        break;

      case "linkedin":
        thumbnailUrl = await getOpenGraphThumbnail(url);
        break;

      default:
        // Fallback: essayer OpenGraph pour tout URL inconnu
        thumbnailUrl = await getOpenGraphThumbnail(url);
        break;
    }

    return NextResponse.json({
      thumbnailUrl,
      platform,
      success: !!thumbnailUrl,
    });
  } catch (error: any) {
    console.error("Erreur extraction thumbnail:", error);
    return NextResponse.json(
      { error: "Impossible de récupérer la miniature", thumbnailUrl: null, success: false },
      { status: 200 } // Retourner 200 même en cas d'erreur pour ne pas bloquer l'admin
    );
  }
}

/**
 * Récupère la thumbnail Facebook via oEmbed
 */
async function getFacebookThumbnail(url: string): Promise<string | null> {
  try {
    // Essayer d'abord l'API oEmbed publique de Facebook
    const oembedUrl = `https://www.facebook.com/plugins/video/oembed.json/?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BigFiveBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.thumbnail_url) return data.thumbnail_url;
    }

    // Fallback: scraper les meta OpenGraph
    return await getOpenGraphThumbnail(url);
  } catch {
    return await getOpenGraphThumbnail(url);
  }
}

/**
 * Récupère la thumbnail Twitter/X via oEmbed
 */
async function getTwitterThumbnail(url: string): Promise<string | null> {
  try {
    // Normaliser l'URL twitter.com / x.com
    const normalizedUrl = url.replace("x.com", "twitter.com");
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(normalizedUrl)}`;

    const response = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BigFiveBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const data = await response.json();
      // L'API oEmbed Twitter retourne du HTML, on cherche l'image dedans
      if (data.html) {
        const imgMatch = data.html.match(/src="(https:\/\/pbs\.twimg\.com\/[^"]+)"/);
        if (imgMatch) return imgMatch[1];
      }
    }

    // Fallback: OpenGraph
    return await getOpenGraphThumbnail(url);
  } catch {
    return await getOpenGraphThumbnail(url);
  }
}

/**
 * Récupère la thumbnail via les meta tags OpenGraph (og:image)
 * Fonctionne pour la plupart des sites web
 */
async function getOpenGraphThumbnail(url: string): Promise<string | null> {
  try {
    const response = await ssrfSafeFetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Chercher og:image
    const ogImageMatch = html.match(
      /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i
    );
    if (ogImageMatch) return ogImageMatch[1];

    // Chercher l'attribut dans l'autre sens (content avant property)
    const ogImageMatch2 = html.match(
      /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i
    );
    if (ogImageMatch2) return ogImageMatch2[1];

    // Chercher twitter:image
    const twitterImageMatch = html.match(
      /<meta\s+(?:property|name)=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']/i
    );
    if (twitterImageMatch) return twitterImageMatch[1];

    // Chercher twitter:image dans l'autre sens
    const twitterImageMatch2 = html.match(
      /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']twitter:image(?::src)?["']/i
    );
    if (twitterImageMatch2) return twitterImageMatch2[1];

    return null;
  } catch {
    return null;
  }
}
