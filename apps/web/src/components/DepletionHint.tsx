import { ClockCountdownIcon } from "@phosphor-icons/react/dist/csr/ClockCountdown";
import { forecastDepletion } from "@cdf/shared";
import { projection } from "../lib/store.js";
import { cn } from "../lib/cn.js";

/**
 * « Épuisé vers 21h40 » — pour sortir une deuxième plaque AVANT la rupture.
 *
 * Silencieux au-delà d'une heure : une prévision à trois heures n'appelle
 * aucune décision et transformerait chaque ligne de la liste en bruit. Le
 * seuil de couleur est à 20 minutes, moment où il devient trop tard pour
 * lancer une cuisson.
 */
const VISIBLE_BELOW_MINUTES = 60;
const URGENT_BELOW_MINUTES = 20;

export function DepletionHint({
  soireeId,
  productId,
  className,
}: {
  soireeId: string;
  productId: string;
  className?: string;
}) {
  const forecast = forecastDepletion(projection, soireeId, productId);
  if (!forecast || forecast.minutesLeft > VISIBLE_BELOW_MINUTES) return null;

  const urgent = forecast.minutesLeft <= URGENT_BELOW_MINUTES;
  const heure = new Date(forecast.depletesAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-micro font-bold",
        urgent ? "text-signal" : "text-lantern",
        className,
      )}
      title={`Rythme observé : ${forecast.ratePerHour}/h`}
    >
      <ClockCountdownIcon size={14} weight="bold" className="shrink-0" />
      <span className="whitespace-nowrap">
        épuisé vers {heure}
        {urgent && ` · ${forecast.minutesLeft} min`}
      </span>
    </span>
  );
}
