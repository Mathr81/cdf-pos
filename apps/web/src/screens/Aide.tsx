import { useState, type ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { ChefHatIcon } from "@phosphor-icons/react/dist/csr/ChefHat";
import { GraduationCapIcon } from "@phosphor-icons/react/dist/csr/GraduationCap";
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { PrinterIcon } from "@phosphor-icons/react/dist/csr/Printer";
import { QuestionIcon } from "@phosphor-icons/react/dist/csr/Question";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";
import type { Icon } from "@phosphor-icons/react";

import { useSession } from "../lib/session.js";
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
 */

interface Section {
  id: string;
  title: string;
  icon: Icon;
  /** Poste pour lequel cette section s'ouvre d'office. */
  role?: string;
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

const SECTIONS: Section[] = [
  {
    id: "caisse",
    title: "Tenir une caisse",
    icon: ReceiptIcon,
    role: "caisse",
    body: (
      <>
        <ol className="space-y-3">
          <Etape n={1} titre="Composer la commande">
            Touche les produits, une fois par article. La tuile passe en orange avec la quantité.
            Pour corriger, utilise les <b className="text-cream">− et +</b> dans le panier.
          </Etape>
          <Etape n={2} titre="Encaisser">
            Touche <b className="text-cream">Encaisser</b>, puis <b className="text-cream">Espèces</b>{" "}
            ou <b className="text-cream">Carte</b>. En carte, attends que le terminal accepte le
            paiement, puis confirme.
          </Etape>
          <Etape n={3} titre="Rendre la monnaie">
            En espèces, saisis le montant donné par le client : l'app affiche le rendu. Tu peux aussi
            valider sans rien saisir si le compte est juste. Sur un ordinateur, le clavier marche
            aussi (chiffres, virgule, Entrée).
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
            Onglet <b className="text-cream">Réservations</b> : tape quelques lettres du nom (les fautes
            et les accents sont tolérés) ou la fin du numéro de téléphone.
          </Etape>
          <Etape n={2} titre="Ajuster et encaisser">
            Touche le nom. Corrige le nombre de personnes par tarif s'il a changé, le montant suit, puis
            encaisse comme en caisse. La ligne passe « Arrivé » sur toutes les tablettes. Une remarque
            (table, allergie…) s'affiche en jaune : lis-la avant de valider.
          </Etape>
          <Etape n={3} titre="Payé d'avance">
            Badge <b className="text-cream">Payé d'avance</b> : rien à encaisser, touche « Marquer arrivé ».
            S'ils sont plus nombreux que prévu, ajoute-les : seules les personnes en plus sont encaissées.
          </Etape>
          <Etape n={4} titre="Sans réservation">
            Bouton <b className="text-cream">Sur place</b> : nom facultatif, nombre de personnes, encaisser.
          </Etape>
        </ol>
        <Note>
          <b className="text-cream">Erreur de clic ?</b> Touche la ligne puis « Annuler l'arrivée » :
          possible depuis la même tablette pendant 10 minutes, ensuite il faut un responsable avec le PIN.
        </Note>
        <Note>
          <b className="text-cream">Liste papier de secours</b> : Réservations → Gestion → « Imprimer la
          liste », juste avant l'ouverture. Elle sort à jour, avec une case à cocher par réservation.
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
      </>
    ),
  },
  {
    id: "stock",
    title: "Suivre le stock",
    icon: PackageIcon,
    role: "caisse",
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
        <ol className="mt-3 space-y-3">
          <Etape n={1} titre="Repérer l'indicateur">
            En haut à gauche : « Hors ligne · N en attente ». Le N, c'est le nombre de ventes qui
            n'ont pas encore été transmises.
          </Etape>
          <Etape n={2} titre="Ne pas éteindre cette tablette">
            Tant que le compteur n'est pas revenu à « En ligne », ces ventes n'existent que là.
          </Etape>
          <Etape n={3} titre="Attendre le retour du réseau">
            Rien à faire : l'envoi repart tout seul. L'indicateur repasse au vert.
          </Etape>
        </ol>
        <Note tone="warn">
          <b className="text-cream">Ce qu'il ne faut jamais faire hors ligne :</b> vider le cache
          local, ou lancer une remise à zéro depuis un autre poste. L'app refusera et te proposera
          d'abord de télécharger une sauvegarde — accepte-la.
        </Note>
      </>
    ),
  },
  {
    id: "entrainement",
    title: "S'entraîner sans fausser les chiffres",
    icon: GraduationCapIcon,
    role: "admin",
    body: (
      <>
        <p className="text-body text-sand">
          Dans <b className="text-cream">Soirées → Nouvelle soirée</b>, coche{" "}
          <b className="text-cream">Soirée d'entraînement</b>. Tout fonctionne exactement comme une
          vraie soirée — c'est le but, on n'apprend rien sur une version au rabais.
        </p>
        <Note>
          Un bandeau orange reste affiché en permanence sur tous les postes tant que la soirée
          d'entraînement est active. Les ventes fictives n'entrent ni dans les totaux « toutes
          soirées », ni dans la comparaison avec le service précédent.
        </Note>
        <Note tone="warn">
          Pense à <b className="text-cream">activer la vraie soirée</b> avant le service. Une vente
          réelle encaissée sur une soirée d'entraînement ne se retrouvera pas dans les comptes.
        </Note>
      </>
    ),
  },
  {
    id: "cloture",
    title: "Fin de soirée : le récapitulatif",
    icon: PrinterIcon,
    role: "admin",
    body: (
      <>
        <ol className="space-y-3">
          <Etape n={1} titre="Compter les caisses">
            Dans <b className="text-cream">Stats</b>, section clôture : saisis le comptage de chaque
            boîte. L'écart avec l'attendu s'affiche tout seul.
          </Etape>
          <Etape n={2} titre="Ouvrir le récapitulatif">
            <b className="text-cream">Stats → Récapitulatif</b>, ou{" "}
            <b className="text-cream">Soirées → Récap</b> sur la soirée voulue. Une page résume
            l'argent par moyen et par caisse, les produits vendus, les offerts, les pertes et les
            annulations.
          </Etape>
          <Etape n={3} titre="Imprimer ou garder en PDF">
            <b className="text-cream">Imprimer / PDF</b>, puis choisis l'imprimante, ou « Enregistrer
            au format PDF » pour l'envoyer au trésorier.
          </Etape>
        </ol>
        <Note>
          L'ordre des onglets de la caisse (Plats, Desserts…) se règle dans{" "}
          <b className="text-cream">Admin → Produits → Ordre des catégories</b>.
        </Note>
      </>
    ),
  },
];

export function AideScreen() {
  const role = useSession((s) => s.role);
  const [open, setOpen] = useState<string | null>(
    // La section de son poste d'abord : personne ne lit la doc de la cuisine
    // quand il est en caisse.
    () => SECTIONS.find((s) => s.role === role)?.id ?? SECTIONS[0].id,
  );

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <QuestionIcon size={26} weight="fill" className="text-lantern" />
        <h1 className="font-display text-title font-bold text-cream">Comment ça marche</h1>
      </div>

      <div className="space-y-2 pb-6">
        {SECTIONS.map((section) => {
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
    </div>
  );
}
