import Image from "next/image";

export function Seal({ size = 88, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <div
      className={`brass relative flex items-center justify-center rounded-full ${glow ? "ring-4 ring-brass-light/60" : ""}`}
      style={{ width: size, height: size }}
      aria-label="TypeSafe Jev seal"
    >
      <div className="absolute inset-[7%] rounded-full border-2 border-oak-900/40" />
      <Image
        src="/typesafe-mark.png"
        alt="TypeSafe"
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.55)}
        className="relative opacity-90"
        priority
      />
    </div>
  );
}

/**
 * The judge's bench: wooden dais with the TypeSafe seal where the judge sits.
 * `status` is shown on the nameplate; `children` sits in front of the bench (the "well").
 */
export function Bench({
  status,
  caption,
  children,
  busy = false,
}: {
  status: string;
  caption?: string;
  children?: React.ReactNode;
  busy?: boolean;
}) {
  return (
    <section className="relative">
      {/* back wall panelling + flags */}
      <div className="wood-dark relative mx-auto flex h-40 max-w-3xl items-end justify-center rounded-t-lg px-6">
        <div className="absolute left-4 top-6 h-24 w-3 rounded-sm bg-gradient-to-b from-red-800 via-white to-blue-900 opacity-80" />
        <div className="absolute right-4 top-6 h-24 w-3 rounded-sm bg-gradient-to-b from-yellow-500 via-blue-900 to-yellow-500 opacity-80" />
        <div className="absolute inset-x-12 top-4 flex flex-col items-center gap-2">
          <Seal size={96} glow={busy} />
          <p className="font-serif text-[11px] uppercase tracking-[0.35em] text-oak-300/80">
            Presiding: Jev · System One
          </p>
        </div>
      </div>
      {/* the bench itself */}
      <div className="wood relative mx-auto -mt-2 max-w-4xl rounded-md px-8 pb-4 pt-3">
        <div className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-sm bg-oak-900/60 px-4 py-2 shadow-inner">
          <span className={`h-2 w-2 rounded-full ${busy ? "bg-brass-light blink" : "bg-verdict-green"}`} />
          <span className="font-serif text-sm uppercase tracking-[0.25em] text-brass-light">{status}</span>
        </div>
        {caption && <p className="mt-2 text-center text-xs text-oak-300/80">{caption}</p>}
      </div>
      <div className="wood-rail mx-auto max-w-5xl rounded-b-sm" />
      {children && <div className="mx-auto mt-8 max-w-6xl">{children}</div>}
    </section>
  );
}
