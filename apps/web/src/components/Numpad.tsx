import { Button } from "./ui.js";

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
    if (k === "⌫") return onChange(value.slice(0, -1));
    if (k === "," && value.includes(",")) return;
    // Limite à 2 décimales.
    if (/,\d{2}$/.test(value) && k !== "⌫") return;
    onChange(value + k);
  };

  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ",", "0", "⌫"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <Button
          key={k}
          variant="secondary"
          size="lg"
          className="h-16 text-2xl"
          onClick={() => press(k)}
        >
          {k}
        </Button>
      ))}
      {onValidate && (
        <Button
          variant="success"
          size="lg"
          className="col-span-3 h-16 text-xl"
          onClick={onValidate}
        >
          Valider
        </Button>
      )}
    </div>
  );
}
