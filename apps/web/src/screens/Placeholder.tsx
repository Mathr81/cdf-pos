export function Placeholder({ title, emoji }: { title: string; emoji: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
      <div className="text-5xl">{emoji}</div>
      <div className="text-lg font-semibold text-slate-300">{title}</div>
      <div className="text-sm">Écran en cours de construction…</div>
    </div>
  );
}
