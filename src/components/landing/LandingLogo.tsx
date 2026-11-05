export function LandingLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col border border-white/80 text-center leading-none text-white uppercase ${className}`}>
      <span className="px-3 pt-1.5 pb-1 text-xl font-bold tracking-[0.2em]">IFW</span>
      <span className="border-t border-white/80 px-3 py-1 text-[9px] font-normal tracking-[0.12em]">Indonesia Fishing Watch</span>
    </span>
  );
}
