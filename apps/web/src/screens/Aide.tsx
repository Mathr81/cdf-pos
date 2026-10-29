import { useState, type ReactNode } from "react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { ChefHatIcon } from "@phosphor-icons/react/dist/csr/ChefHat";
import { ConfettiIcon } from "@phosphor-icons/react/dist/csr/Confetti";
import { DeviceTabletIcon } from "@phosphor-icons/react/dist/csr/DeviceTablet";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { GraduationCapIcon } from "@phosphor-icons/react/dist/csr/GraduationCap";
import { NotebookIcon } from "@phosphor-icons/react/dist/csr/Notebook";
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { PrinterIcon } from "@phosphor-icons/react/dist/csr/Printer";
import { QuestionIcon } from "@phosphor-icons/react/dist/csr/Question";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";
import { WrenchIcon } from "@phosphor-icons/react/dist/csr/Wrench";
import type { Icon } from "@phosphor-icons/react";
import { isReservationsOnly } from "@cdf/shared";

import { useSession } from "../lib/session.js";
import { useActiveSoiree } from "../lib/hooks.js";
import { projection } from "../lib/store.js";
import { Card } from "../components/ui.js";
import { cn } from "../lib/cn.js";

/**
 * Aide en ligne.
 * ─────────────────────────────────────────────────────────────
 * Écrite pour un bénévole qui découvre l'app le soir même, debout, avec
 * du monde qui attend. D'où trois partis pris :
 *
 *  - la section de SON poste est ouverte, les autres repliées. Personne ne
 *    lit la doc de la cuisine quand il est en caisse ;
 *  - des gestes, pas des fonctionnalités : « le client change d'avis » plutôt
 *    que « modification de commande » ;
 *  - ce qui rassure en priorité — la coupure réseau et l'erreur de saisie —
 *    parce que c'est ce qui fait paniquer, pas la vente nominale.
 *
 * Version longue : docs/guide-utilisateur.md. Les deux doivent rester d'accord.
 */

interface Section {
  id: string;
  title: string;
  icon: Icon;
  /** Poste pour lequel cette section s'ouvre d'office. */
  role?: string;
  /** Réservé aux responsables (PIN) : rangé dans le second groupe. */
  admin?: boolean;
  body: ReactNode;
}

function Etape({ n, titre, children }: { n: number; titre: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lantern text-body font-bold text-night">
        {n}
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="block text-body font-bold text-cream">{titre}</span>
        <span className="block text-body text-sand">{children}</span>
      </span>
    </li>
  );
}

function Note({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" }) {
  return (
    <p
      className={cn(
        "mt-3 rounded-control border p-3 text-body",
        tone === "warn"
          ? "border-signal/60 bg-signal/10 text-cream"
          : "border-line bg-well text-sand",
      )}
    >
      {children}
    </p>
  );
}

/** Ligne « terme : explication », pour les états et les boutons à reconnaître. */
function Def({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <li className="text-body text-sand">
      <b className="text-cream">{term}</b> : {children}
    </li>
  );
}

const SECTIONS: Section[] = [
  {
    id: "demarrer",
    title: "Démarrer une tablette",
    icon: DeviceTabletIcon,
    body: (
      <>
        <ol className="space-y-3">
          <Etape n={1} titre="Installer l'app">
            Sur iPad ou téléphone : Partager → <b className="text-cream">Sur l'écran d'accueil</b>. Une
            app installée garde mieux les ventes hors ligne.
          </Etape>
          <Etape n={2} titre="Saisir le code d'accès">
            Celui remis par le responsable. Le PIN administrateur est facultatif : il ouvre Journal,
            Stats, Soirées et Admin.
          </Etape>
          <Etape n={3} titre="Choisir son poste">
            <b className="text-cream">Caisse</b> (avec un numéro de caisse) ou{" "}
            <b className="text-cream">Cuisine</b> (avec sa station). Le prénom est facultatif, il sert aux
            statistiques.
          </Etape>
        </ol>
        <Note tone="warn">
          <b className="text-cream">Un numéro de caisse par tablette.</b> Deux tablettes « Caisse 1 »
          seraient comptées comme une seule boîte à la clôture. Un bandeau rouge le signale : change de
          poste et prends un autre numéro.
        </Note>
        <Note>
          Pour changer de poste : le bouton tout en haut à droite. Les ventes pas encore envoyées sont
          gardées. L'écran ne se met pas en veille pendant le service : branche la tablette.
        </Note>
      </>
    ),
  },
  {
    id: "caisse",
    title: "Tenir une caisse",
    icon: ReceiptIcon,
    role: "caisse",
    body: (
      <>
        <ol className="space-y-3">
          <Etape n={1} titre="Composer la commande">
            Touche les produits, une fois par article. La tuile passe en orange avec la quantité. Les
            onglets du haut filtrent par catégorie. Pour corriger, utilise les{" "}
            <b className="text-cream">− et +</b> dans le panier.
          </Etape>
          <Etape n={2} titre="Encaisser">
            Touche <b className="text-cream">Encaisser</b>, puis <b className="text-cream">Espèces</b>{" "}
            ou <b className="text-cream">Carte</b>. En carte, attends que le terminal accepte le
            paiement, puis confirme. Le chèque n'est proposé qu'aux soirées sur réservation.
          </Etape>
          <Etape n={3} titre="Rendre la monnaie">
            En espèces, saisis le montant donné par le client ou touche un billet proposé : l'app
            affiche le rendu. Tu peux aussi valider sans rien saisir si le compte est juste. Sur un
            ordinateur, le clavier marche aussi (chiffres, virgule, Entrée).
          </Etape>
        </ol>
        <Note>
          <b className="text-cream">Le client change d'avis après paiement ?</b> Va dans{" "}
          <b className="text-cream">Journal</b> (responsable avec le PIN), touche la commande, puis
          « Modifier » pour changer les quantités, ou « Annuler la vente ». Rien n'est jamais effacé
          en douce : une commande modifiée ou annulée reste visible, marquée comme telle.
        </Note>
        <Note>
          <b className="text-cream">Un repas offert</b> (bénévole, invité) : encaisse normalement,
          mais choisis <b className="text-cream">Offert</b>. Le stock et la cuisine en tiennent
          compte, le chiffre d'affaires non.
        </Note>
        <Note>
          <b className="text-cream">« Vider » par erreur ?</b> Touche « Rétablir » dans le message
          qui s'affiche : le panier revient tel quel.
        </Note>
        <Note>
          <b className="text-cream">« Stock insuffisant » ?</b> Si le produit est bien là, touche
          « Vendre quand même » : le stock de départ était sans doute mal saisi. Préviens un
          responsable pour qu'il le corrige.
        </Note>
      </>
    ),
  },
  {
    id: "reservations",
    title: "Soirée sur réservation",
    icon: ClipboardTextIcon,
    body: (
      <>
        <ol className="space-y-3">
          <Etape n={1} titre="Retrouver la réservation">
            Onglet <b className="text-cream">Réservations → Accueil</b> : tape quelques lettres du nom
            (les fautes et les accents sont tolérés), le numéro de table, ou au moins 3 chiffres du téléphone.
          </Etape>
          <Etape n={2} titre="Ajuster et encaisser">
            Touche le nom. Corrige le nombre de personnes par tarif s'il a changé, le montant suit, puis
            encaisse comme en caisse, chèque compris. La ligne passe « Arrivé » sur toutes les tablettes.
            La table s'affiche à côté du nom ; une remarque (allergie, anniversaire…) s'affiche en jaune :
            lis-la avant de valider. Sur iPad en paysage, la colonne de droite liste les remarques des groupes
            pas encore arrivés.
          </Etape>
          <Etape n={3} titre="Payé d'avance">
            Badge <b className="text-cream">Payé d'avance</b> : rien à encaisser, touche « Marquer arrivé ».
            S'ils sont plus nombreux que prévu, ajoute-les : seules les personnes en plus sont encaissées.
          </Etape>
          <Etape n={4} titre="Sans réservation">
            Bouton <b className="text-cream">Encaisser en sur place</b> : nom facultatif, nombre de
            personnes, encaisser.
          </Etape>
        </ol>
        <Note>
          <b className="text-cream">Erreur de clic ?</b> Touche la ligne puis « Annuler l'arrivée » :
          possible depuis la même tablette pendant 10 minutes, ensuite il faut un responsable avec le PIN.
        </Note>
        <Note>
          L'onglet <b className="text-cream">Suivi</b> montre les arrivés, les couverts restants et
          l'argent encaissé, par tarif, par moyen de paiement et par caisse.
        </Note>
        <Note tone="warn">
          <b className="text-cream">Deux caisses sur la même réservation</b> (souvent hors ligne) : la
          première arrivée au serveur compte. L'autre tablette affiche un message et demande si de
          l'argent a été reçu : si oui (c'étaient d'autres personnes), il est gardé en sur-place.
        </Note>
      </>
    ),
  },
  {
    id: "cuisine",
    title: "Tenir un poste cuisine",
    icon: ChefHatIcon,
    role: "cuisine",
    body: (
      <>
        <ol className="space-y-3">
          <Etape n={1} titre="Choisir ta station">
            En haut de l'écran : Grill, Friteuse… Ton choix est retenu sur cette tablette.
          </Etape>
          <Etape n={2} titre="Regarder « À faire »">
            Le grand chiffre, c'est ce qu'il reste à produire. Il monte tout seul dès qu'une caisse
            encaisse, sans rien toucher.
          </Etape>
          <Etape n={3} titre="Marquer ce qui est sorti">
            Les boutons <b className="text-cream">+1 / +5 / +10</b> à chaque plat préparé. Le
            compteur redescend. Mauvais bouton ? Touche « Annuler » dans le message qui apparaît.
          </Etape>
        </ol>
        <Note>
          <b className="text-cream">Les accompagnements inclus comptent aussi.</b> Un « Burger
          Frites » vendu ajoute une barquette de frites à ton poste, même si personne n'a commandé de
          frites seules. La mention « dont N en menu » te le rappelle.
        </Note>
        <Note>
          <b className="text-cream">« Épuisé vers 21h40 »</b> apparaît quand un produit va manquer au
          rythme actuel. C'est le moment de lancer une fournée, pas quand le compteur tombe à zéro.
        </Note>
        <Note>
          <b className="text-cream">Préparer en avance ?</b> Les produits pas encore vendus sont sous
          le bouton « Voir tous les produits du poste ».
        </Note>
      </>
    ),
  },
  {
    id: "stock",
    title: "Suivre le stock",
    icon: PackageIcon,
    body: (
      <>
        <ol className="space-y-3">
          <Etape n={1} titre="Réapprovisionner">
            <b className="text-cream">Réappro</b> quand tu sors un carton de la réserve. Saisis le
            nombre ajouté, pas le nouveau total.
          </Etape>
          <Etape n={2} titre="Déclarer une perte">
            <b className="text-cream">Perte</b> pour ce qui tombe, brûle ou finit à la poubelle. Ça
            explique les écarts en fin de soirée.
          </Etape>
          <Etape n={3} titre="Recompter">
            Le bouton à droite de Perte : compte ce qui reste vraiment et saisis le nombre. L'app
            corrige l'écart toute seule.
          </Etape>
        </ol>
        <Note>
          Le symbole <b className="text-cream">∞</b> signifie « stock illimité » : on ne compte pas
          ce produit (les frites au sac, le sirop). Il ne sera jamais marqué épuisé.
        </Note>
        <Note>
          Un stock <b className="text-cream">négatif</b> veut dire qu'on a vendu plus que prévu : le
          stock de départ était faux. Recompte pour remettre le bon chiffre.
        </Note>
      </>
    ),
  },
  {
    id: "reseau",
    title: "Si le réseau tombe",
    icon: WifiSlashIcon,
    body: (
      <>
        <p className="text-body text-sand">
          <b className="text-cream">Continue d'encaisser normalement.</b> C'est prévu. L'app garde
          les ventes sur la tablette et les envoie dès que le réseau revient, sans doublon.
        </p>
        <p className="mt-3 text-body font-bold text-cream">L'indicateur en haut à gauche :</p>
        <ul className="mt-1 space-y-1">
          <Def term="En ligne">tout est envoyé.</Def>
          <Def term="Envoi de N…">les ventes partent, rien à faire.</Def>
          <Def term="Hors ligne · N en attente">
            N ventes n'existent que sur cette tablette. L'envoi repartira tout seul.
          </Def>
          <Def term="N bloqués">
            le réseau est là mais l'envoi n'avance plus. Recharge l'app ; si ça reste bloqué,
            préviens un responsable.
          </Def>
        </ul>
        <Note tone="warn">
          <b className="text-cream">Tant que ce n'est pas revenu à « En ligne » :</b> n'éteins pas
          la tablette, ne vide pas le cache local, ne lance pas de remise à zéro depuis un autre poste.
          Si l'app propose de télécharger une sauvegarde, accepte-la.
        </Note>
        <Note>
          Hors ligne, le stock affiché ne voit pas les ventes des autres caisses : deux caisses
          peuvent vendre la dernière part.
        </Note>
      </>
    ),
  },
  {
    id: "depannage",
    title: "Problèmes fréquents",
    icon: WrenchIcon,
    body: (
      <ul className="space-y-2">
        <Def term="Retour à l'écran du code d'accès">
          le code ou le PIN a changé. Ressaisis-le : les ventes en attente sont gardées.
        </Def>
        <Def term="« Code d'accès invalide » en boucle">
          attends une minute, le nombre d'essais est limité.
        </Def>
        <Def term="« Aucune soirée active »">un responsable doit activer la soirée (Soirées).</Def>
        <Def term="« Carte vide »">
          un responsable doit choisir les produits dans Soirées → Carte.
        </Def>
        <Def term="Aucune station en Cuisine">
          un responsable doit les créer dans Admin → Stations cuisine.
        </Def>
        <Def term="Bandeau orange « MODE ENTRAÎNEMENT »">
          les ventes ne comptent pas. Si c'est le vrai service, préviens un responsable tout de suite.
        </Def>
        <Def term="Bandeau bleu « Nouvelle version »">
          touche « Recharger » entre deux clients. Les ventes ne sont pas perdues.
        </Def>
      </ul>
    ),
  },
  {
    id: "preparer",
    title: "Préparer une soirée",
    icon: ConfettiIcon,
    role: "admin",
    admin: true,
    body: (
      <>
        <ol className="space-y-3">
          <Etape n={1} titre="Créer la soirée">
            <b className="text-cream">Soirées → Nouvelle soirée</b> : nom, date, et « Partir de » un
            modèle ou d'une soirée passée (sa carte est copiée, pas ses ventes). Coche{" "}
            <b className="text-cream">Sur réservation</b> pour un repas à tarifs adulte / enfant.
          </Etape>
          <Etape n={2} titre="Régler la carte">
            Bouton <b className="text-cream">Carte</b> : coche les produits en vente, leur stock de
            départ, ∞ pour ceux qu'on ne compte pas, et un prix propre à la soirée si besoin (vide =
            prix habituel). « Enregistrer comme modèle » la garde pour la prochaine fois.
          </Etape>
          <Etape n={3} titre="Activer">
            <b className="text-cream">Activer</b> bascule toutes les caisses, la cuisine et le stock sur
            cette soirée.
          </Etape>
          <Etape n={4} titre="Déposer les fonds de caisse">
            <b className="text-cream">Stats → Fond de caisse</b> : la monnaie mise dans chaque boîte
            avant d'ouvrir. Sans lui, l'écart de fin de soirée ne veut rien dire.
          </Etape>
        </ol>
        <Note>
          <b className="text-cream">Sur réservation :</b> Réservations → Gestion. Ajoute d'autres
          tarifs si besoin, puis « Importer un CSV » (un aperçu s'affiche, les doublons sont détectés)
          ou « Ajouter » une à une. Juste avant l'ouverture, « Imprimer la liste » donne une liste
          papier de secours.
        </Note>
      </>
    ),
  },
  {
    id: "entrainement",
    title: "S'entraîner sans fausser les chiffres",
    icon: GraduationCapIcon,
    admin: true,
    body: (
      <>
        <p className="text-body text-sand">
          Dans <b className="text-cream">Soirées → Nouvelle soirée</b>, coche{" "}
          <b className="text-cream">Soirée d'entraînement</b>. Tout fonctionne exactement comme une
          vraie soirée — c'est le but, on n'apprend rien sur une version au rabais.
        </p>
        <Note>
          Un bandeau orange s'affiche sur tous les postes tant que la soirée d'entraînement est active.
          On peut le masquer : une pastille « Entraînement » reste alors en haut. Les ventes fictives
          n'entrent ni dans les totaux « toutes soirées », ni dans la comparaison avec le service
          précédent.
        </Note>
        <Note tone="warn">
          Pense à <b className="text-cream">activer la vraie soirée</b> avant le service. Une vente
          réelle encaissée sur une soirée d'entraînement ne se retrouvera pas dans les comptes.
        </Note>
      </>
    ),
  },
  {
    id: "journal",
    title: "Corriger une vente",
    icon: NotebookIcon,
    admin: true,
    body: (
      <>
        <ol className="space-y-3">
          <Etape n={1} titre="Retrouver la vente">
            <b className="text-cream">Journal</b> : les plus récentes en haut. Filtre par soirée, moyen
            de paiement ou statut, ou cherche.
          </Etape>
          <Etape n={2} titre="Modifier">
            Touche la vente puis <b className="text-cream">Modifier</b> : quantités, produits ajoutés,
            moyen de paiement. C'est aussi là qu'on passe une vente en « Offert », ou l'inverse.
          </Etape>
          <Etape n={3} titre="Ou annuler">
            <b className="text-cream">Annuler la vente</b> : elle reste visible, marquée annulée, et
            sort des chiffres.
          </Etape>
        </ol>
        <Note>
          Juste après un encaissement, un poste avec le PIN voit « Annuler » dans le message de
          confirmation pendant quelques secondes : plus rapide que le Journal.
        </Note>
      </>
    ),
  },
  {
    id: "cloture",
    title: "Fin de soirée : la clôture",
    icon: PrinterIcon,
    role: "stats",
    admin: true,
    body: (
      <>
        <ol className="space-y-3">
          <Etape n={1} titre="Vérifier que tout est envoyé">
            <b className="text-cream">Admin → Remise à zéro → Postes connectés</b> : aucune tablette ne
            doit avoir de ventes en attente.
          </Etape>
          <Etape n={2} titre="Compter les caisses">
            Dans <b className="text-cream">Stats</b>, section clôture : <b className="text-cream">Compter</b>{" "}
            chaque boîte. L'écart avec l'attendu (fond + espèces) s'affiche tout seul ; négatif = il
            manque. Carte et chèques n'y entrent pas.
          </Etape>
          <Etape n={3} titre="Ouvrir le récapitulatif">
            <b className="text-cream">Stats → Récapitulatif</b>, ou{" "}
            <b className="text-cream">Soirées → Récap</b> sur la soirée voulue. Une page résume
            l'argent par moyen et par caisse, les produits vendus, les offerts, les pertes et les
            annulations.
          </Etape>
          <Etape n={4} titre="Imprimer ou garder en PDF">
            <b className="text-cream">Imprimer / PDF</b>, puis choisis l'imprimante, ou « Enregistrer
            au format PDF » pour l'envoyer au trésorier.
          </Etape>
          <Etape n={5} titre="Clôturer la soirée">
            <b className="text-cream">Soirées → Clôturer</b>. Les ventes sont conservées.
          </Etape>
        </ol>
        <Note>
          Besoin du détail dans un tableur ? <b className="text-cream">Stats → Export CSV</b>, et pour
          une soirée sur réservation, <b className="text-cream">Réservations → Gestion → Exporter le
          bilan</b>.
        </Note>
      </>
    ),
  },
  {
    id: "admin",
    title: "Produits et stations",
    icon: GearIcon,
    admin: true,
    body: (
      <>
        <ul className="space-y-2">
          <Def term="Stations cuisine">
            crée-les d'abord (Grill, Friteuse…) : chaque produit y est rattaché.
          </Def>
          <Def term="Nouveau produit">
            nom, prix, catégorie (l'onglet en caisse), station, visuel (icône, emoji ou image) et
            couleur du ticket.
          </Def>
          <Def term="Contient">
            pour un plat composé : « Saucisse Frites » contient 1 « Frites », et la Friteuse le voit.
          </Def>
          <Def term="Stock initial">
            seulement la valeur proposée en ajoutant le produit à une carte. Le stock du soir se règle
            dans Soirées → Carte ou dans Stock.
          </Def>
          <Def term="Visible en caisse">décoche pour masquer un produit sans le supprimer.</Def>
          <Def term="Ordre des catégories">l'ordre des onglets en haut de la caisse.</Def>
        </ul>
      </>
    ),
  },
  {
    id: "reset",
    title: "Remise à zéro",
    icon: ArrowCounterClockwiseIcon,
    admin: true,
    body: (
      <>
        <p className="text-body text-sand">
          <b className="text-cream">Admin → Remise à zéro</b>, après une soirée de test par exemple.
          Récupère les stats <b className="text-cream">avant</b> : c'est définitif.
        </p>
        <ul className="mt-3 space-y-2">
          <Def term="Effacer les ventes">commandes, stock, préparations. La carte est gardée.</Def>
          <Def term="Tout effacer">aussi les produits, stations et images.</Def>
          <Def term="Vider le cache local">
            seulement cette tablette, le serveur n'est pas touché.
          </Def>
        </ul>
        <Note tone="warn">
          Regarde d'abord la liste des <b className="text-cream">postes connectés</b> : une tablette
          avec des ventes en attente les perdrait. L'app refuse de les détruire et propose de les
          télécharger, mais une tablette éteinte n'apparaît pas dans la liste.
        </Note>
        <Note>
          <b className="text-cream">Stockage de cette tablette « Non garanti »</b> : installe l'app sur
          l'écran d'accueil puis reviens voir.
        </Note>
      </>
    ),
  },
];

export function AideScreen() {
  const role = useSession((s) => s.role);
  const soiree = useActiveSoiree();
  const [open, setOpen] = useState<string | null>(() =>
    // La section de son poste d'abord : personne ne lit la doc de la cuisine
    // quand il est en caisse. Un soir sans carte, la caisse est l'accueil.
    soiree && isReservationsOnly(projection, soiree.id)
      ? "reservations"
      : (SECTIONS.find((s) => s.role === role)?.id ?? SECTIONS[0].id),
  );

  const groups = [
    { title: "Pendant le service", sections: SECTIONS.filter((s) => !s.admin) },
    { title: "Pour les responsables (PIN)", sections: SECTIONS.filter((s) => s.admin) },
  ];

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <QuestionIcon size={26} weight="fill" className="text-lantern" />
        <h1 className="font-display text-title font-bold text-cream">Comment ça marche</h1>
      </div>

      {groups.map((group) => (
        <section key={group.title} className="pb-6">
          <h2 className="mb-2 px-1 text-micro font-bold tracking-wide text-ash uppercase">{group.title}</h2>
          <div className="space-y-2">
            {group.sections.map((section) => {
              const isOpen = open === section.id;
              return (
                <Card key={section.id} className="overflow-hidden p-0">
                  <button
                    onClick={() => setOpen(isOpen ? null : section.id)}
                    aria-expanded={isOpen}
                    className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
                  >
                    <section.icon size={22} weight="fill" className="shrink-0 text-sand" />
                    <span className="font-display min-w-0 flex-1 text-lead font-bold text-cream">
                      {section.title}
                    </span>
                    <CaretDownIcon
                      size={18}
                      weight="bold"
                      className={cn("shrink-0 text-ash transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                  {isOpen && <div className="px-4 pt-1 pb-4">{section.body}</div>}
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
