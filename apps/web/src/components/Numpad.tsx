import { useEffect, useRef } from "react";
import { BackspaceIcon } from "@phosphor-icons/react/dist/csr/Backspace";
import { Button } from "./ui.js";

const BACKSPACE = "⌫";
/** Partie entière : 4 chiffres (9 999 €). Au-delà, c'est une faute de frappe. */
const MAX_INT_DIGITS = 4;

/**
 * Applique une touche à la saisie (ex "12,50") et renvoie la nouvelle valeur.
 * Pure, pour être testée sans écran.
 */
export function applyKey(value: string, k: string): string {
  if (k === BACKSPACE) return value.slice(0, -1);
  if (k === ",") {
    if (value.includes(",")) return value;
    return (value || "0") + ",";
  }
  // Limite à 2 décimales.
  if (/,\d{2}$/.test(value)) return value;
  // Pas de « 007 » : un zéro de tête seul est remplacé par le chiffre tapé.
  if (value === "0") return k;
  if (!value.includes(",") && value.length >= MAX_INT_DIGITS) return value;
  return value + k;
}

/**
 * Pavé numérique tactile. `value` est une chaîne de saisie libre (ex "12,50").
 * Accepte aussi le clavier physique (chiffres, virgule ou point, Retour
 * arrière, Entrée) pour les caisses tenues sur un ordinateur.
 */
export function Numpad({
  value,
  onChange,
  onValidate,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  onValidate?: () => void;
  /** Touche Entrée du clavier physique. */
  onEnter?: () => void;
}) {
  const press = (k: string) => onChange(applyKey(value, k));

  // Valeurs courantes lues au moment de la frappe, sans réabonner l'écouteur.
  const latest = useRef({ value, onChange, onEnter: onEnter ?? onValidate });
  latest.current = { value, onChange, onEnter: onEnter ?? onValidate };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Un champ texte ailleurs garde ses frappes.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const { value: v, onChange: change, onEnter: enter } = latest.current;
      let k: string | null = null;
      if (/^\d$/.test(e.key)) k = e.key;
      else if (e.key === "," || e.key === "." || e.key === "Decimal") k = ",";
      else if (e.key === "Backspace") k = BACKSPACE;
      else if (e.key === "Enter" && enter) {
        // Un bouton focalisé au clavier garde son propre Entrée.
        if (e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
        enter();
        return;
      }
      if (k === null) return;
      e.preventDefault();
      change(applyKey(v, k));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ",", "0", BACKSPACE];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <Button
          key={k}
          variant="secondary"
          size="xl"
          aria-label={k === BACKSPACE ? "Effacer le dernier chiffre" : k}
          onClick={() => press(k)}
        >
          {k === BACKSPACE ? <BackspaceIcon size={26} weight="bold" /> : k}
        </Button>
      ))}
      {onValidate && (
        <Button variant="success" size="xl" className="col-span-3" onClick={onValidate}>
          Valider
        </Button>
      )}
    </div>
  );
}
