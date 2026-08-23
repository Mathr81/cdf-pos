import { BackspaceIcon } from "@phosphor-icons/react/dist/csr/Backspace";
import { Button } from "./ui.js";

const BACKSPACE = "⌫";

/**
 * Pavé numérique tactile. `value` est une chaîne de saisie libre (ex "12,50").
 * Renvoie la nouvelle valeur à chaque appui.
 */
export function Numpad({
  value,
  onChange,
  onValidate,
}: {
  value: string;
  onChange: (v: string) => void;
  onValidate?: () => void;
}) {
  const press = (k: string) => {
    if (k === BACKSPACE) return onChange(value.slice(0, -1));
    if (k === "," && value.includes(",")) return;
    // Limite à 2 décimales.
    if (/,\d{2}$/.test(value)) return;
    onChange(value + k);
  };

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
