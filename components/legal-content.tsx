/**
 * Contenu légal partagé pour Laveiye.
 *
 * Trois composants prêts à être insérés dans une page longue ou un onglet de
 * modal :
 *   - `CGUContent`     : Conditions Générales d'Utilisation
 *   - `CGVContent`     : Conditions Générales de Vente
 *   - `PrivacyContent` : Politique de Confidentialité
 *
 * Ils n'embarquent ni titre principal (`h1`), ni mention "Dernière mise à
 * jour", afin que la page parente (ou la modal) gère la présentation. Pour
 * conserver la date d'édition centralisée, importer `LEGAL_LAST_UPDATED`.
 */

export const LEGAL_LAST_UPDATED = "21 mai 2026";
export const LEGAL_VERSION = "2.1";

const sectionClass = "space-y-3 text-sm leading-relaxed";
const h2Class = "text-lg font-semibold mt-8 mb-3 text-foreground";
const h3Class = "text-base font-semibold mt-5 mb-2 text-foreground";
const ulClass = "list-disc pl-6 space-y-1 text-sm";

export function CGUContent() {
    return (
        <div className="prose prose-slate max-w-none">
            <section className={sectionClass}>
                <h2 className={h2Class}>Préambule</h2>
                <p>
                    Laveiye est une plateforme numérique de référencement, d&apos;analyse et d&apos;inspiration publicitaire, accessible à l&apos;adresse www.laveiye.com (ci-après «&nbsp;la Plateforme&nbsp;»). Elle est éditée et exploitée par BigFiveAbidjan SARL, agence de communication et de marketing digital immatriculée sous le numéro RCCM CI-ABJ-2017-B-27600, dont le siège est situé à Abidjan, Côte d&apos;Ivoire (ci-après «&nbsp;BigFiveAbidjan&nbsp;» ou «&nbsp;l&apos;Éditeur&nbsp;»).
                </p>
                <p>
                    La Plateforme propose une bibliothèque de campagnes publicitaires africaines et internationales, des outils de filtrage et de recherche avancée, ainsi que des analyses stratégiques destinées à inspirer et outiller les professionnels du marketing, de la communication et de la création, opérant principalement en Afrique de l&apos;Ouest.
                </p>
                <p>
                    Les présentes Conditions Générales d&apos;Utilisation (ci-après «&nbsp;CGU&nbsp;») définissent les règles d&apos;accès et d&apos;utilisation de la Plateforme. Tout accès, consultation ou utilisation de la Plateforme implique l&apos;acceptation pleine, entière et sans réserve des présentes CGU. En cas de désaccord avec tout ou partie de ces conditions, l&apos;Utilisateur est invité à ne pas accéder à la Plateforme.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 1 — Définitions</h2>
                <p>Aux fins des présentes CGU, les termes suivants ont la signification ci-dessous :</p>
                <ul className={ulClass}>
                    <li><strong>Laveiye</strong> : la Plateforme de bibliothèque publicitaire www.laveiye.com, service édité et exploité par BigFiveAbidjan SARL.</li>
                    <li><strong>BigFiveAbidjan ou l&apos;Éditeur</strong> : BigFiveAbidjan SARL, RCCM CI-ABJ-2017-B-27600, éditrice et opératrice de Laveiye, sise à Abidjan, Côte d&apos;Ivoire.</li>
                    <li><strong>Plateforme</strong> : le site web www.laveiye.com, ses sous-domaines et ses interfaces, mis à disposition par BigFiveAbidjan SARL.</li>
                    <li><strong>Utilisateur</strong> : toute personne physique ou morale accédant à la Plateforme, qu&apos;elle soit abonnée ou non.</li>
                    <li><strong>Abonné</strong> : tout Utilisateur disposant d&apos;un compte actif avec un abonnement payant (Plan Basic ou Plan Pro).</li>
                    <li><strong>Bibliothèque</strong> : la base de données de campagnes publicitaires référencées, classées et analysées par l&apos;Éditeur.</li>
                    <li><strong>Campagne</strong> : tout contenu publicitaire (visuel, vidéo, copy, concept créatif) référencé dans la Bibliothèque.</li>
                    <li><strong>Collection</strong> : un ensemble de campagnes sélectionnées et organisées par un Abonné dans son espace personnel.</li>
                    <li><strong>Asset</strong> : tout fichier téléchargeable associé à une campagne (visuel haute définition, brief créatif, analyse).</li>
                    <li><strong>Données Personnelles</strong> : toute information permettant d&apos;identifier directement ou indirectement une personne physique.</li>
                </ul>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 2 — Objet et champ d&apos;application</h2>
                <p>
                    Les présentes CGU ont pour objet de définir les conditions dans lesquelles BigFiveAbidjan, via la Plateforme Laveiye, fournit à ses Utilisateurs un accès à ses services de bibliothèque publicitaire et d&apos;intelligence créative.
                </p>
                <p>
                    Ces CGU s&apos;appliquent à tout accès à la Plateforme, depuis n&apos;importe quel terminal et depuis n&apos;importe quel pays. Elles prévalent sur tout autre document, sauf accord écrit express entre BigFiveAbidjan et l&apos;Utilisateur.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 3 — Accès à la Plateforme</h2>
                <h3 className={h3Class}>3.1 Conditions d&apos;accès</h3>
                <p>
                    L&apos;accès à la Plateforme est ouvert à toute personne physique majeure ou toute personne morale régulièrement constituée. BigFiveAbidjan se réserve le droit de restreindre ou d&apos;interdire l&apos;accès à toute personne, à sa seule discrétion.
                </p>
                <h3 className={h3Class}>3.2 Création de compte</h3>
                <p>
                    L&apos;utilisation des fonctionnalités principales requiert la création d&apos;un compte personnel. L&apos;Utilisateur s&apos;engage à fournir des informations exactes, complètes et à jour. Chaque Utilisateur ne peut détenir qu&apos;un seul compte personnel.
                </p>
                <h3 className={h3Class}>3.3 Sécurité du compte</h3>
                <p>
                    L&apos;Utilisateur est seul responsable de la confidentialité de ses identifiants. Il s&apos;engage à ne pas partager ses accès avec des tiers et à informer sans délai BigFiveAbidjan de tout accès non autorisé via support@laveiye.com.
                </p>
                <h3 className={h3Class}>3.4 Disponibilité du service</h3>
                <p>
                    BigFiveAbidjan s&apos;efforce de maintenir la Plateforme accessible 24h/24, 7j/7, sans garantie de continuité absolue. Des interruptions pour maintenance peuvent survenir sans préavis ni indemnisation.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 4 — Description des services</h2>
                <h3 className={h3Class}>4.1 Fonctionnalités de la Plateforme</h3>
                <p>La Plateforme offre les fonctionnalités suivantes, variables selon le plan souscrit :</p>
                <ul className={ulClass}>
                    <li>Accès à la Bibliothèque de campagnes publicitaires (500+ campagnes régulièrement mises à jour) ;</li>
                    <li>Recherche par filtre : pays, industrie, format publicitaire et objectif de campagne ;</li>
                    <li>Lecture stratégique : analyse des meilleures campagnes et décryptage des leviers créatifs ;</li>
                    <li>Création de Favoris et de Collections personnalisées ;</li>
                    <li>Partage de Collections avec des clients ou collaborateurs (selon le plan) ;</li>
                    <li>Téléchargement d&apos;Assets en haute qualité ;</li>
                    <li>Alertes email hebdomadaires sur les nouvelles campagnes référencées ;</li>
                    <li>Sessions expert #BigFiveDécrypte : décryptage approfondi de campagnes sélectionnées (Plan Pro uniquement).</li>
                </ul>
                <h3 className={h3Class}>4.2 Limites selon le plan souscrit</h3>
                <ul className={ulClass}>
                    <li><strong>Plan Découverte</strong> : accès limité à la Bibliothèque, filtres basiques, 10 campagnes consultables par mois, alertes email hebdo, 5 recherches ou filtres par mois. Favoris, Collections, téléchargement et sessions expert non inclus.</li>
                    <li><strong>Plan Basic</strong> : accès illimité à la Bibliothèque, filtres avancés (secteur, pays…), campagnes consultables en illimité, Favoris, Collections personnalisées, téléchargement de visuels, alertes email hebdo, 30 recherches ou filtres par mois. Sessions expert non incluses.</li>
                    <li><strong>Plan Pro</strong> : toutes les fonctionnalités Basic, avec en plus des recherches et filtres illimités et l&apos;accès aux sessions expert #BigFiveDécrypte.</li>
                </ul>
                <h3 className={h3Class}>4.3 Évolution des services</h3>
                <p>
                    BigFiveAbidjan se réserve le droit de modifier, améliorer, supprimer ou ajouter des fonctionnalités à tout moment. Les modifications substantielles seront notifiées aux Abonnés par email avec un préavis minimum de 30 jours.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 5 — Utilisation acceptable</h2>
                <h3 className={h3Class}>5.1 Comportements autorisés</h3>
                <p>
                    L&apos;Utilisateur est autorisé à utiliser la Plateforme à des fins d&apos;inspiration créative, de veille publicitaire, de présentation à des clients, de benchmark sectoriel et de formation professionnelle, dans le respect des présentes CGU.
                </p>
                <h3 className={h3Class}>5.2 Comportements interdits</h3>
                <p>Il est strictement interdit à tout Utilisateur de :</p>
                <ul className={ulClass}>
                    <li>Reproduire, redistribuer ou revendre tout ou partie du contenu de la Bibliothèque à des fins commerciales sans autorisation écrite de BigFiveAbidjan ;</li>
                    <li>Utiliser les Assets téléchargés pour des campagnes publicitaires propres sans avoir acquis les droits auprès des ayants droit originaux ;</li>
                    <li>Extraire massivement les données de la Bibliothèque via des robots, scrapers ou procédés automatisés ;</li>
                    <li>Partager ses identifiants de connexion avec des tiers non autorisés ;</li>
                    <li>Tenter de contourner les limitations de son plan d&apos;abonnement ;</li>
                    <li>Utiliser la Plateforme à des fins illégales, frauduleuses ou contraires à l&apos;ordre public ;</li>
                    <li>Transmettre des virus, malwares ou tout code malveillant ;</li>
                    <li>Tenter d&apos;accéder de manière non autorisée aux systèmes ou données de BigFiveAbidjan ;</li>
                    <li>Usurper l&apos;identité d&apos;un autre Utilisateur ou d&apos;un tiers.</li>
                </ul>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 6 — Propriété intellectuelle</h2>
                <h3 className={h3Class}>6.1 Droits de BigFiveAbidjan</h3>
                <p>
                    L&apos;architecture, le design, l&apos;interface, les algorithmes de recommandation, les analyses stratégiques, les annotations, les textes éditoriaux, les bases de données et tout contenu produit par BigFiveAbidjan sur la Plateforme sont la propriété exclusive de BigFiveAbidjan SARL et sont protégés par les lois sur la propriété intellectuelle. Toute reproduction sans autorisation préalable et écrite de BigFiveAbidjan est strictement interdite.
                </p>
                <h3 className={h3Class}>6.2 Droits sur les campagnes référencées</h3>
                <p>
                    Les campagnes publicitaires référencées dans la Bibliothèque restent la propriété de leurs créateurs et annonceurs respectifs. Laveiye les référence dans le cadre du droit de citation et à des fins pédagogiques et d&apos;analyse. BigFiveAbidjan ne cède aucun droit d&apos;exploitation commerciale sur ces contenus à l&apos;Utilisateur. Toute utilisation d&apos;une campagne référencée au-delà de l&apos;inspiration et du benchmarking requiert l&apos;accord des ayants droit originaux.
                </p>
                <h3 className={h3Class}>6.3 Licence accordée à l&apos;Utilisateur</h3>
                <p>
                    BigFiveAbidjan concède à l&apos;Utilisateur une licence personnelle, non exclusive, non transférable et révocable pour accéder et utiliser la Plateforme conformément aux présentes CGU, pendant la durée de son abonnement.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 7 — Responsabilité</h2>
                <h3 className={h3Class}>7.1 Limitation de responsabilité de BigFiveAbidjan</h3>
                <p>
                    La Plateforme est fournie «&nbsp;en l&apos;état&nbsp;». BigFiveAbidjan ne saurait être tenue responsable des erreurs ou omissions dans les informations de la Bibliothèque, des décisions créatives ou commerciales prises par l&apos;Utilisateur sur la base des contenus consultés, ni des droits de propriété intellectuelle sur les campagnes tierces référencées. La responsabilité de BigFiveAbidjan est en tout état de cause limitée au montant des sommes payées par l&apos;Utilisateur au cours des 12 derniers mois.
                </p>
                <h3 className={h3Class}>7.2 Responsabilité de l&apos;Utilisateur</h3>
                <p>
                    L&apos;Utilisateur est seul responsable de l&apos;usage qu&apos;il fait des contenus consultés ou téléchargés sur la Plateforme, notamment en ce qui concerne le respect des droits de propriété intellectuelle des annonceurs et agences créatives dont les campagnes sont référencées.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 8 — Données personnelles</h2>
                <p>
                    La collecte et le traitement des données personnelles de l&apos;Utilisateur sont régis par la Politique de Confidentialité de Laveiye, document contractuel annexe aux présentes CGU, disponible sur la Plateforme.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 9 — Résiliation</h2>
                <h3 className={h3Class}>9.1 Résiliation par l&apos;Utilisateur</h3>
                <p>
                    L&apos;Utilisateur peut fermer son compte à tout moment depuis son espace personnel. La résiliation prend effet à l&apos;issue de la période d&apos;abonnement en cours.
                </p>
                <h3 className={h3Class}>9.2 Résiliation par BigFiveAbidjan</h3>
                <p>
                    BigFiveAbidjan se réserve le droit de suspendre ou de résilier sans préavis le compte de tout Utilisateur qui violerait les présentes CGU. BigFiveAbidjan pourra également résilier un compte inactif depuis plus de 24 mois, après notification par email.
                </p>
                <h3 className={h3Class}>9.3 Effets de la résiliation</h3>
                <p>
                    À compter de la résiliation, l&apos;Utilisateur perd l&apos;accès à la Plateforme et à ses Collections. L&apos;export des données personnelles reste possible sur demande à support@laveiye.com dans un délai de 30 jours suivant la résiliation.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 10 — Modifications des CGU</h2>
                <p>
                    BigFiveAbidjan se réserve le droit de modifier les présentes CGU à tout moment. Toute modification sera notifiée par email et/ou notification sur la Plateforme avec un préavis minimum de 15 jours. La poursuite de l&apos;utilisation vaut acceptation des nouvelles CGU.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 11 — Droit applicable et juridiction</h2>
                <p>
                    Les présentes CGU sont régies par le droit ivoirien. Tout litige sera soumis à la compétence exclusive des tribunaux compétents d&apos;Abidjan, après tentative de résolution amiable à l&apos;adresse support@laveiye.com.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 12 — Dispositions diverses</h2>
                <p>
                    Si une disposition est déclarée nulle, les autres restent pleinement en vigueur. Les présentes CGU constituent l&apos;intégralité de l&apos;accord entre BigFiveAbidjan et l&apos;Utilisateur et remplacent tout accord antérieur. Pour toute question : support@laveiye.com.
                </p>
            </section>
        </div>
    );
}

export function CGVContent() {
    return (
        <div className="prose prose-slate max-w-none">
            <section className={sectionClass}>
                <h2 className={h2Class}>Préambule</h2>
                <p>
                    Les présentes Conditions Générales de Vente (ci-après «&nbsp;CGV&nbsp;») régissent l&apos;ensemble des relations commerciales entre BigFiveAbidjan SARL, éditrice de la Plateforme Laveiye (ci-après «&nbsp;BigFiveAbidjan&nbsp;» ou «&nbsp;le Prestataire&nbsp;»), et ses clients (ci-après «&nbsp;le Client&nbsp;» ou «&nbsp;l&apos;Abonné&nbsp;») relatives à l&apos;achat d&apos;abonnements sur la Plateforme www.laveiye.com.
                </p>
                <p>
                    Le fait de procéder à un achat sur la Plateforme emporte acceptation pleine et entière des présentes CGV.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 1 — Identification du prestataire</h2>
                <ul className={ulClass}>
                    <li><strong>Raison sociale</strong> : BigFiveAbidjan SARL</li>
                    <li><strong>RCCM</strong> : CI-ABJ-2017-B-27600</li>
                    <li><strong>Service</strong> : Laveiye — www.laveiye.com</li>
                    <li><strong>Adresse</strong> : Abidjan, Côte d&apos;Ivoire</li>
                    <li><strong>Email</strong> : support@laveiye.com</li>
                    <li><strong>Téléphone</strong> : +225 21 59 42 28</li>
                </ul>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 2 — Offres et plans d&apos;abonnement</h2>
                <h3 className={h3Class}>2.1 Description des plans</h3>
                <ul className={ulClass}>
                    <li><strong>Plan Découverte</strong> (1&nbsp;000 FCFA/mois — 10&nbsp;000 FCFA/an) : accès limité à la Bibliothèque, filtres basiques, 10 campagnes consultables par mois, alertes email hebdomadaires, 5 recherches ou filtres par mois. Favoris, Collections personnalisées, téléchargement de visuels et sessions expert non inclus.</li>
                    <li><strong>Plan Basic</strong> (4&nbsp;900 FCFA/mois — 49&nbsp;000 FCFA/an) : accès illimité à la Bibliothèque, filtres avancés (secteur, pays…), campagnes consultables en illimité, Favoris, Collections personnalisées, partage de Collections, téléchargement de visuels, alertes email hebdomadaires, 30 recherches ou filtres par mois. Sessions expert non incluses.</li>
                    <li><strong>Plan Pro</strong> (9&nbsp;900 FCFA/mois — 99&nbsp;000 FCFA/an) : toutes les fonctionnalités du Plan Basic, avec en plus des recherches et filtres illimités et l&apos;accès aux sessions expert #BigFiveDécrypte.</li>
                </ul>
                <h3 className={h3Class}>2.2 Tarifs annuels</h3>
                <p>
                    Les plans annuels sont proposés avec 2 mois offerts par rapport au tarif mensuel. Le paiement annuel est effectué en une seule fois à la souscription.
                </p>
                <h3 className={h3Class}>2.3 Offres personnalisées</h3>
                <p>
                    Des offres sur mesure peuvent être proposées aux entreprises et agences sur devis. Ces offres font l&apos;objet d&apos;un contrat spécifique.
                </p>
                <h3 className={h3Class}>2.4 Périodes promotionnelles</h3>
                <p>
                    BigFiveAbidjan peut proposer des offres promotionnelles à durée limitée, soumises à des conditions spécifiques communiquées au moment de leur publication.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 3 — Prix et facturation</h2>
                <h3 className={h3Class}>3.1 Tarification</h3>
                <p>
                    Les prix sont exprimés en Francs CFA (FCFA) TTC et affichés de manière transparente sur la page de tarification avant toute souscription. BigFiveAbidjan se réserve le droit de modifier ses tarifs avec un préavis minimum de 30 jours. Les abonnements en cours conservent leur tarif jusqu&apos;au prochain renouvellement.
                </p>
                <h3 className={h3Class}>3.2 Facturation</h3>
                <p>
                    Les abonnements mensuels sont facturés au début de chaque période. Les abonnements annuels sont facturés en totalité à la souscription. Une facture électronique est automatiquement générée et transmise par email après chaque paiement, et reste consultable dans l&apos;espace personnel.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 4 — Modalités de paiement</h2>
                <h3 className={h3Class}>4.1 Moyens de paiement acceptés</h3>
                <ul className={ulClass}>
                    <li>Mobile Money : Orange Money, MTN Mobile Money, Moov Money, Wave</li>
                    <li>Virement bancaire</li>
                </ul>
                <h3 className={h3Class}>4.2 Sécurité des paiements</h3>
                <p>
                    Tous les paiements sont traités par le partenaire Pawapay certifié PayTech via connexion sécurisée SSL/TLS. BigFiveAbidjan ne stocke à aucun moment les données bancaires ou de paiement du Client.
                </p>
                <h3 className={h3Class}>4.3 Défaut de paiement</h3>
                <p>
                    En cas d&apos;échec de paiement lors d&apos;un renouvellement, BigFiveAbidjan notifiera le Client par email. Sans régularisation dans les 7 jours, l&apos;abonnement sera suspendu. Passé 30 jours sans régularisation, l&apos;abonnement sera résilié de plein droit.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 5 — Abonnements et renouvellement</h2>
                <h3 className={h3Class}>5.1 Durée et renouvellement</h3>
                <p>
                    Les abonnements mensuels sont renouvelés tacitement chaque mois, sauf résiliation avant la date de renouvellement. BigFiveAbidjan adressera un rappel par email au moins 7 jours avant chaque renouvellement automatique.
                </p>
                <h3 className={h3Class}>5.2 Modification du plan</h3>
                <p>
                    Le passage à un plan supérieur (upgrade) est effectif immédiatement, avec facturation proratisée pour la période en cours. Le passage à un plan inférieur (downgrade) prend effet au prochain renouvellement.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 6 — Droit de rétractation</h2>
                <h3 className={h3Class}>6.1 Délai</h3>
                <p>
                    Conformément aux dispositions légales applicables, le Client dispose d&apos;un délai de 7 jours calendaires à compter de la souscription pour exercer son droit de rétractation, sans justification.
                </p>
                <h3 className={h3Class}>6.2 Exercice et exclusion</h3>
                <p>
                    La demande doit être adressée par écrit à support@laveiye.com dans le délai imparti. Ce droit ne s&apos;applique pas si le Client a utilisé le service de manière significative (consultation de campagnes, création de Collections, téléchargement d&apos;Assets) avant la fin du délai de rétractation.
                </p>
                <h3 className={h3Class}>6.3 Remboursement</h3>
                <p>
                    En cas de rétractation valable, BigFiveAbidjan remboursera l&apos;intégralité des sommes versées dans un délai de 14 jours calendaires, via le moyen de paiement initial.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 7 — Remboursements</h2>
                <h3 className={h3Class}>7.1 Cas de remboursement</h3>
                <p>
                    En dehors du droit de rétractation, des remboursements peuvent être accordés en cas de : dysfonctionnement technique majeur rendant le service inaccessible plus de 72h consécutives imputable à BigFiveAbidjan ; double facturation ; service non conforme à sa description.
                </p>
                <h3 className={h3Class}>7.2 Procédure</h3>
                <p>
                    Toute demande doit être envoyée à support@laveiye.com dans les 7 jours suivant l&apos;événement, avec justificatifs. BigFiveAbidjan s&apos;engage à traiter les demandes dans un délai de 10 jours ouvrés.
                </p>
                <h3 className={h3Class}>7.3 Exclusions</h3>
                <p>
                    Aucun remboursement ne sera accordé pour insatisfaction liée à la quantité de campagnes disponibles dans la Bibliothèque, interruptions brèves de service liées à la maintenance planifiée, ou périodes d&apos;abonnement entamées hors délai de rétractation.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 8 — Accès au service</h2>
                <p>
                    L&apos;accès est activé instantanément dès confirmation du paiement. Un email de confirmation est envoyé avec les détails de l&apos;abonnement. En cas de non-activation dans les 2 heures suivant le paiement, contacter support@laveiye.com.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 9 — Annulation d&apos;abonnement</h2>
                <p>
                    Le Client peut annuler son abonnement à tout moment depuis la rubrique «&nbsp;Gérer mon abonnement&nbsp;» de son espace personnel. L&apos;annulation prend effet à la fin de la période de facturation en cours. Aucun remboursement prorata temporis n&apos;est accordé hors cas prévus à l&apos;Article 7.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 10 — Obligations des parties</h2>
                <h3 className={h3Class}>10.1 Obligations de BigFiveAbidjan</h3>
                <ul className={ulClass}>
                    <li>Fournir les services décrits dans le plan souscrit avec diligence ;</li>
                    <li>Mettre à jour régulièrement la Bibliothèque de campagnes ;</li>
                    <li>Informer le Client de toute modification substantielle avec le préavis prévu ;</li>
                    <li>Traiter les réclamations dans des délais raisonnables ;</li>
                    <li>Respecter la confidentialité des données du Client.</li>
                </ul>
                <h3 className={h3Class}>10.2 Obligations du Client</h3>
                <ul className={ulClass}>
                    <li>Utiliser les services conformément aux CGU et aux présentes CGV ;</li>
                    <li>Ne pas exploiter commercialement les Assets téléchargés sans droits appropriés ;</li>
                    <li>Maintenir ses coordonnées et informations de paiement à jour ;</li>
                    <li>S&apos;acquitter des montants dus dans les délais impartis.</li>
                </ul>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 11 — Service client</h2>
                <p>Pour toute question relative à un abonnement ou à une facturation :</p>
                <ul className={ulClass}>
                    <li>Email : support@laveiye.com</li>
                    <li>Téléphone : +225 21 59 42 28</li>
                    <li>Formulaire de contact : www.laveiye.com</li>
                </ul>
                <p>Service disponible du lundi au vendredi, 8h–18h (heure d&apos;Abidjan, GMT+0).</p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 12 — Droit applicable et litiges</h2>
                <p>
                    Les présentes CGV sont soumises au droit ivoirien. En cas de litige, les Parties s&apos;engagent à une résolution amiable sous 30 jours avant tout recours judiciaire devant les tribunaux compétents d&apos;Abidjan.
                </p>
            </section>
        </div>
    );
}

export function PrivacyContent() {
    return (
        <div className="prose prose-slate max-w-none">
            <section className={sectionClass}>
                <h2 className={h2Class}>Préambule</h2>
                <p>
                    La présente Politique de Confidentialité décrit la manière dont BigFiveAbidjan SARL, éditrice de la Plateforme Laveiye (ci-après «&nbsp;BigFiveAbidjan&nbsp;», «&nbsp;nous&nbsp;»), collecte, utilise, conserve, partage et protège les données à caractère personnel des utilisateurs de www.laveiye.com.
                </p>
                <p>
                    BigFiveAbidjan se conforme à la Loi ivoirienne n°2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel, aux directives de l&apos;ARTCI/PDCI, ainsi qu&apos;aux bonnes pratiques issues du RGPD pour les traitements transfrontaliers.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 1 — Responsable du traitement</h2>
                <ul className={ulClass}>
                    <li><strong>Raison sociale</strong> : BigFiveAbidjan SARL (éditrice de la Plateforme Laveiye)</li>
                    <li><strong>RCCM</strong> : CI-ABJ-2017-B-27600</li>
                    <li><strong>Service</strong> : Laveiye — www.laveiye.com</li>
                    <li><strong>Adresse</strong> : Abidjan, Côte d&apos;Ivoire</li>
                    <li><strong>Email DPO / Contact Confidentialité</strong> : support@laveiye.com</li>
                    <li><strong>Téléphone</strong> : +225 21 59 42 28</li>
                </ul>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 2 — Données collectées</h2>
                <h3 className={h3Class}>2.1 Données fournies par l&apos;Utilisateur</h3>
                <ul className={ulClass}>
                    <li><strong>Données d&apos;identification</strong> : nom, prénom, adresse email, nom de la société (le cas échéant) ;</li>
                    <li><strong>Données de compte</strong> : identifiants de connexion (mot de passe chiffré), préférences ;</li>
                    <li><strong>Données de paiement</strong> : traitées exclusivement par PayTech — BigFiveAbidjan ne stocke aucune donnée de paiement brute ;</li>
                    <li><strong>Communications</strong> : messages échangés avec le service client.</li>
                </ul>
                <h3 className={h3Class}>2.2 Données collectées automatiquement</h3>
                <ul className={ulClass}>
                    <li><strong>Données d&apos;utilisation</strong> : campagnes consultées, Collections créées, Assets téléchargés, recherches effectuées, durée et fréquence des sessions ;</li>
                    <li><strong>Données techniques</strong> : adresse IP, navigateur, système d&apos;exploitation, résolution d&apos;écran ;</li>
                    <li><strong>Données de navigation</strong> : cookies, identifiants de session.</li>
                </ul>
                <h3 className={h3Class}>2.3 Données de paramétrage</h3>
                <p>
                    Les filtres, secteurs, pays et types de campagnes configurés par l&apos;Utilisateur constituent des données de paramétrage pouvant révéler des informations sur son activité professionnelle. Elles sont traitées avec un niveau de confidentialité renforcé.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 3 — Bases légales du traitement</h2>
                <ul className={ulClass}>
                    <li><strong>Exécution du contrat</strong> : gestion du compte, facturation, accès aux services ;</li>
                    <li><strong>Intérêt légitime</strong> : amélioration de la Bibliothèque et des algorithmes de recommandation, sécurité, prévention de la fraude, statistiques agrégées ;</li>
                    <li><strong>Consentement</strong> : envoi de communications marketing et newsletters ;</li>
                    <li><strong>Obligation légale</strong> : conservation comptable, réponse aux réquisitions légales.</li>
                </ul>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 4 — Finalités du traitement</h2>
                <ul className={ulClass}>
                    <li>Création, gestion et sécurisation des comptes Utilisateurs ;</li>
                    <li>Traitement des paiements et émission des factures ;</li>
                    <li>Fourniture et personnalisation des services (recommandations de campagnes, Collections) ;</li>
                    <li>Envoi d&apos;alertes hebdomadaires et notifications opérationnelles ;</li>
                    <li>Communication sur les nouvelles fonctionnalités et abonnements ;</li>
                    <li>Communications commerciales (avec consentement) ;</li>
                    <li>Amélioration de la Bibliothèque et des outils de filtrage (données agrégées) ;</li>
                    <li>Détection et prévention des fraudes et abus ;</li>
                    <li>Respect des obligations légales.</li>
                </ul>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 5 — Partage des données</h2>
                <h3 className={h3Class}>5.1 Principe général</h3>
                <p>
                    BigFiveAbidjan ne vend, ne loue et ne cède jamais les données personnelles de ses Utilisateurs à des tiers à des fins commerciales.
                </p>
                <h3 className={h3Class}>5.2 Sous-traitants techniques</h3>
                <ul className={ulClass}>
                    <li>PayTech : traitement sécurisé des paiements ;</li>
                    <li>Supabase : hébergement des bases de données ;</li>
                    <li>Prestataires d&apos;hébergement et CDN ;</li>
                    <li>Outils d&apos;analyse d&apos;utilisation anonymisée.</li>
                </ul>
                <p>Ces sous-traitants sont soumis à des obligations contractuelles strictes et ne peuvent utiliser les données qu&apos;aux fins définies.</p>
                <h3 className={h3Class}>5.3 Transferts légaux</h3>
                <p>
                    BigFiveAbidjan peut divulguer des données aux autorités compétentes sur réquisition légale valable, en informant l&apos;Utilisateur concerné dans les limites autorisées par la loi.
                </p>
                <h3 className={h3Class}>5.4 Transferts transfrontaliers</h3>
                <p>
                    Certains sous-traitants sont situés hors de Côte d&apos;Ivoire. BigFiveAbidjan veille à ce que ces transferts s&apos;effectuent avec des garanties contractuelles appropriées.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 6 — Durée de conservation</h2>
                <ul className={ulClass}>
                    <li>Données de compte actif : pendant toute la durée de l&apos;abonnement + 3 ans après résiliation ;</li>
                    <li>Données de facturation : 10 ans (obligations légales comptables) ;</li>
                    <li>Données de navigation et d&apos;utilisation : 13 mois maximum sous forme identifiable ;</li>
                    <li>Cookies : durée de session pour les cookies de session ; 13 mois maximum pour les cookies persistants ;</li>
                    <li>Comptes inactifs : notification après 24 mois d&apos;inactivité ; suppression possible sous 30 jours en l&apos;absence de réponse.</li>
                </ul>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 7 — Sécurité des données</h2>
                <p>BigFiveAbidjan met en œuvre les mesures de sécurité suivantes :</p>
                <ul className={ulClass}>
                    <li>Chiffrement des transmissions via protocole TLS/SSL (HTTPS) ;</li>
                    <li>Hachage sécurisé des mots de passe (bcrypt ou équivalent) ;</li>
                    <li>Authentification à deux facteurs disponible ;</li>
                    <li>Contrôle d&apos;accès strict aux systèmes internes ;</li>
                    <li>Surveillance et journalisation des accès aux données sensibles ;</li>
                    <li>Audits de sécurité réguliers.</li>
                </ul>
                <p>En cas de violation de données, BigFiveAbidjan notifiera les autorités compétentes et les Utilisateurs concernés dans les délais légaux.</p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 8 — Vos droits</h2>
                <p>Conformément à la législation applicable, tout Utilisateur dispose des droits suivants :</p>
                <ul className={ulClass}>
                    <li><strong>Droit d&apos;accès</strong> : obtenir une copie de ses données traitées ;</li>
                    <li><strong>Droit de rectification</strong> : faire corriger des données inexactes ;</li>
                    <li><strong>Droit à l&apos;effacement</strong> : demander la suppression de ses données (« droit à l&apos;oubli ») ;</li>
                    <li><strong>Droit à la limitation</strong> : obtenir la suspension du traitement dans certains cas ;</li>
                    <li><strong>Droit d&apos;opposition</strong> : s&apos;opposer au traitement fondé sur l&apos;intérêt légitime ;</li>
                    <li><strong>Droit à la portabilité</strong> : recevoir ses données dans un format structuré et lisible ;</li>
                    <li><strong>Droit de retrait du consentement</strong> : retirer à tout moment un consentement donné.</li>
                </ul>
                <p>Pour exercer ces droits : support@laveiye.com (réponse sous 30 jours maximum). En cas de réponse insatisfaisante, l&apos;Utilisateur peut saisir l&apos;ARTCI ou l&apos;autorité compétente de son pays de résidence.</p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 9 — Cookies</h2>
                <h3 className={h3Class}>9.1 Types de cookies</h3>
                <ul className={ulClass}>
                    <li><strong>Cookies essentiels</strong> : authentification, sécurité. Non soumis au consentement.</li>
                    <li><strong>Cookies analytiques</strong> : mesure d&apos;audience avec anonymisation IP. Soumis au consentement.</li>
                    <li><strong>Cookies de préférence</strong> : mémorisation des paramètres. Soumis au consentement.</li>
                </ul>
                <h3 className={h3Class}>9.2 Gestion</h3>
                <p>
                    Les préférences peuvent être paramétrées via le bandeau de consentement à la première visite, ou modifiées depuis les paramètres du navigateur. La désactivation des cookies essentiels peut affecter le fonctionnement de la Plateforme.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 10 — Mineurs</h2>
                <p>
                    La Plateforme est destinée à un public professionnel adulte. BigFiveAbidjan ne collecte pas sciemment de données relatives à des personnes de moins de 18 ans. Toute collecte portée à sa connaissance donnera lieu à suppression immédiate.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 11 — Modifications de la politique</h2>
                <p>
                    BigFiveAbidjan se réserve le droit de modifier la présente Politique à tout moment. Toute modification substantielle sera notifiée par email avec un préavis minimum de 15 jours.
                </p>
            </section>

            <section className={sectionClass}>
                <h2 className={h2Class}>Article 12 — Contact</h2>
                <ul className={ulClass}>
                    <li>Email : support@laveiye.com</li>
                    <li>Téléphone : +225 21 59 42 28</li>
                    <li>Adresse : BigFiveAbidjan SARL, Abidjan, Côte d&apos;Ivoire</li>
                </ul>
                <p>Nous nous engageons à traiter votre demande dans un délai maximum de 30 jours calendaires.</p>
            </section>
        </div>
    );
}
