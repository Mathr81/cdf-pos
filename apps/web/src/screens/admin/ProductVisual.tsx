import { useState } from "react";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";

import { useStore } from "../../lib/store.js";
import { api } from "../../lib/api.js";
import { FieldLabel, TextInput } from "../../components/ui.js";
import {
  DEFAULT_IMAGE_ZOOM,
  ProductIcon,
  TicketBlock,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../../components/ProductIcon.js";
import { ICON_GROUPS, isIconSlug } from "../../lib/productIcons.js";
import { inkOn, ticketColor } from "../../lib/ticket.js";
import { cn } from "../../lib/cn.js";
import { TabBtn } from "./TabBtn.js";

export function VisualPicker({
  emoji,
  onEmojiChange,
  imageKey,
  onImageChange,
  imageZoom,
  onZoomChange,
  color,
}: {
  emoji: string;
  onEmojiChange: (v: string) => void;
  imageKey: string | null;
  onImageChange: (v: string | null) => void;
  imageZoom: number | null;
  onZoomChange: (v: number | null) => void;
  color: string;
}) {
  const connected = useStore((s) => s.connected);
  const [tab, setTab] = useState<"icone" | "image">(imageKey ? "image" : "icone");

  return (
    <div>
      <FieldLabel>Visuel du produit</FieldLabel>
      <div className="mb-2 flex gap-2">
        <TabBtn active={tab === "icone"} onClick={() => setTab("icone")}>
          Icône
        </TabBtn>
        <TabBtn active={tab === "image"} onClick={() => setTab("image")}>
          Image
        </TabBtn>
      </div>

      {tab === "image" ? (
        <ImageUploader
          imageKey={imageKey}
          onChange={onImageChange}
          imageZoom={imageZoom}
          onZoomChange={onZoomChange}
          color={color}
          emoji={emoji}
          connected={connected}
        />
      ) : (
        <IconPicker
          value={emoji}
          onChange={(v) => {
            onEmojiChange(v);
            // Choisir une icône retire l'image : les deux ne s'affichent
            // jamais ensemble.
            if (imageKey) onImageChange(null);
          }}
          color={color}
        />
      )}
    </div>
  );
}

/**
 * Upload d'image.
 *
 * Seule action de l'application qui exige le réseau : le binaire ne transite
 * pas par le journal d'événements, il est déposé sur le serveur qui renvoie
 * une référence. On le dit AVANT que l'utilisateur essaie, pas après l'échec.
 *
 * L'aperçu affiche le fichier réellement produit par le serveur (320x320 WebP),
 * pas un aperçu local du fichier source : le redimensionnement, le recadrage et
 * la compression sont donc visibles avant d'enregistrer.
 */
function ImageUploader({
  imageKey,
  onChange,
  imageZoom,
  onZoomChange,
  color,
  emoji,
  connected,
}: {
  imageKey: string | null;
  onChange: (v: string | null) => void;
  imageZoom: number | null;
  onZoomChange: (v: number | null) => void;
  color: string;
  emoji: string;
  connected: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"photo" | "icone" | null>(null);
  const [info, setInfo] = useState<{ bytes: number } | null>(null);
  // Conservé le temps de l'édition : changer de mode retraite CE fichier,
  // sans redemander à l'utilisateur d'aller le rechercher.
  const [source, setSource] = useState<File | null>(null);

  const send = async (file: File, wanted?: "photo" | "icone") => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.uploadImage(file, wanted);
      onChange(res.imageKey);
      setMode(res.mode);
      setInfo({ bytes: res.bytes });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex items-start gap-2.5 rounded-control border border-line bg-well p-3">
        <WifiSlashIcon size={18} weight="bold" className="mt-0.5 shrink-0 text-signal" />
        <p className="text-body text-sand">
          <b className="text-cream">Ajouter une image demande d'être connecté.</b>
          <span className="mt-0.5 block text-micro text-ash">
            Le reste de la fiche produit se modifie normalement hors ligne. Reconnecte-toi pour
            changer l'image.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-control border border-line bg-well p-3">
      <div className="flex flex-wrap items-center gap-3">
        <TicketBlock
          emoji={emoji}
          color={color}
          imageKey={imageKey}
          imageZoom={imageZoom}
          iconSize={26}
          className="h-20 w-20"
        />
        <div className="min-w-0 flex-1">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-3 text-body font-bold text-cream">
            <UploadSimpleIcon size={18} weight="bold" />
            {imageKey ? "Remplacer" : "Choisir une image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif,image/svg+xml"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setSource(f);
                void send(f);
              }}
            />
          </label>
          <p className="mt-1 text-micro text-ash">
            {busy
              ? "Traitement en cours…"
              : imageKey && info
                ? `Aperçu du rendu réel · 320×320 · ${Math.round(info.bytes / 1024)} ko`
                : "PNG, JPEG, WebP, GIF, AVIF ou SVG. Max 8 Mo."}
          </p>
        </div>
      </div>

      {imageKey && (
        <>
          <div>
            <p className="mb-1.5 text-micro font-semibold text-ash">Traitement</p>
            <div className="flex flex-wrap gap-2">
              <ModeBtn
                active={mode === "photo"}
                disabled={busy || !source}
                onClick={() => source && send(source, "photo")}
                label="Photo"
                hint="recadré, compressé"
              />
              <ModeBtn
                active={mode === "icone"}
                disabled={busy || !source}
                onClick={() => source && send(source, "icone")}
                label="Icône ou logo"
                hint="centré, fond transparent, sans perte"
              />
            </div>
            {!source && (
              <p className="mt-1.5 text-micro text-ash">
                Choisis une nouvelle image pour changer de traitement.
              </p>
            )}
          </div>

          {/* Le zoom est enregistré avec le produit et appliqué à l'affichage :
              il reste donc réglable après coup, sans redemander le fichier
              source, contrairement au mode ci-dessus qui est cuit dans le WebP. */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-micro font-semibold text-ash">Taille dans la tuile</p>
              <p className="tnum text-micro font-bold text-cream">
                {imageZoom ?? DEFAULT_IMAGE_ZOOM} %
              </p>
            </div>
            {/* Curseur plutôt que quatre paliers : le bon cadrage dépend du
                logo, et un pas de 2 % laisse ajuster finement. Piste haute de
                44px pour rester utilisable au doigt. */}
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={2}
              value={imageZoom ?? DEFAULT_IMAGE_ZOOM}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              aria-label="Taille de l'image dans la tuile"
              className="h-11 w-full cursor-pointer accent-lantern"
            />
            <div className="flex items-center justify-between text-micro text-ash">
              <span>Petit</span>
              <button
                type="button"
                onClick={() => onZoomChange(null)}
                className="min-h-11 px-2 font-semibold transition-colors hover:text-cream"
              >
                Réinitialiser
              </button>
              <span>Plein</span>
            </div>
            <p className="text-micro text-ash">Réglable à tout moment, sans renvoyer l'image.</p>
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(null);
              onZoomChange(null);
              setSource(null);
              setMode(null);
              setInfo(null);
            }}
            className="inline-flex min-h-11 items-center gap-2 text-body font-semibold text-ash transition-colors hover:text-signal"
          >
            <TrashIcon size={16} weight="bold" />
            Retirer l'image et revenir à l'icône
          </button>
        </>
      )}

      {error && <p className="text-body font-semibold text-signal">{error}</p>}
    </div>
  );
}

function ModeBtn({
  active,
  disabled,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-control border px-3 text-left transition-colors disabled:opacity-40",
        active ? "border-lantern bg-lantern/15" : "border-line bg-surface",
      )}
    >
      <span className={cn("block text-body font-bold", active ? "text-lantern" : "text-cream")}>
        {label}
      </span>
      <span className="block text-micro text-ash">{hint}</span>
    </button>
  );
}

/**
 * Sélecteur d'icône.
 * Écrit un slug Phosphor (ex "hamburger") dans `product.emoji`, qui est un
 * `z.string()` libre : aucun champ nouveau, aucune migration. Le champ de
 * secours en bas permet de conserver ou de saisir un caractère quelconque,
 * si bien qu'une valeur existante n'est jamais détruite.
 */
function IconPicker({
  value,
  onChange,
  color,
}: {
  value: string;
  onChange: (v: string) => void;
  color: string;
}) {
  const custom = !isIconSlug(value);
  return (
    <div>
      <div className="space-y-3 rounded-control border border-line bg-well p-3">
        {ICON_GROUPS.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 text-micro font-semibold text-ash">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.slugs.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  aria-label={slug}
                  onClick={() => onChange(slug)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-control border transition-colors",
                    value === slug
                      ? "border-lantern bg-lantern/20 text-lantern"
                      : "border-line bg-surface text-sand hover:text-cream",
                  )}
                >
                  <ProductIcon value={slug} size={22} />
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="border-t border-line pt-3">
          <label className="flex flex-wrap items-center gap-2 text-micro text-ash">
            <span>Ou un caractère libre</span>
            <TextInput
              value={custom ? value : ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="ex : 🍔"
              aria-label="Icône personnalisée"
              className="w-24 min-h-11 text-center"
            />
            {custom && value && (
              <span className="flex items-center gap-1.5 text-sand">
                <ProductIcon value={value} size={20} color={ticketColor(color)} />
                affiché tel quel
              </span>
            )}
          </label>
        </div>
      </div>
    </div>
  );
}

/**
 * Couleur du ticket papier. Le sélecteur natif est conservé : c'est le bon
 * mécanisme. L'aperçu montre le rendu réel du bloc affiché en caisse et en
 * cuisine, icône comprise, pour que la saisie soit vérifiable sur place.
 */
export function TicketColorField({
  value,
  onChange,
  emoji,
  imageKey,
  imageZoom,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  emoji: string;
  imageKey: string | null;
  imageZoom: number | null;
  name: string;
}) {
  const hex = ticketColor(value);
  return (
    <div>
      <FieldLabel>Couleur du ticket</FieldLabel>
      <div className="flex items-center gap-3 rounded-control border border-line bg-well p-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Couleur du ticket"
          className="h-12 w-16 shrink-0 cursor-pointer rounded-control border border-line bg-surface"
        />
        <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-line bg-surface p-2">
          <TicketBlock
            emoji={emoji}
            color={hex}
            imageKey={imageKey}
            imageZoom={imageZoom}
            iconSize={22}
            className="h-12 w-12"
          />
          <div className="min-w-0">
            <div className="truncate text-body font-bold text-cream">{name || "Aperçu"}</div>
            <div className="text-micro text-ash">
              {imageKey
                ? "L'image se pose sur cette couleur, qui reste visible autour."
                : `Encre ${inkOn(hex) === "#14100f" ? "sombre" : "claire"}, choisie automatiquement`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Choix des produits contenus dans un plat. « Burger Frites » contient
 * 1 « Frites » → la friteuse compte cette barquette, et le stock des frites
 * est décrémenté, même si personne n'achète de frites seules.
 */
