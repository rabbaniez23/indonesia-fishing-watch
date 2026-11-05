import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Reveal } from "./landing-motion";
import { SectionIntro, SectionPhoto, WRAP } from "./landing-ui";

// Diambil dari menu aplikasi yang sebenarnya, supaya landing selalu sama dengan isi platform.
const FEATURES = NAV_ITEMS.filter((item) => ["pantau", "analisis", "kerja"].includes(item.group));

export function LandingFeatures() {
  return (
    <section id="fitur" className="relative scroll-mt-20 overflow-hidden bg-black py-24 md:py-32">
      <SectionPhoto src="/landing/riak-v1.webp" opacity="opacity-70" />
      <div className={`${WRAP} relative flex flex-col gap-14`}>
        <SectionIntro title="Di dalam platform">Sembilan menu untuk memantau, menganalisis, dan menyimpan hasil kerja.</SectionIntro>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal as="li" key={item.href} delay={(index % 3) * 100}>
                <div className="group flex h-full flex-col gap-3 border border-white/25 bg-black/75 p-6 transition-colors duration-300 hover:bg-white hover:text-black">
                  <Icon className="size-7 text-white/85 transition-[color,scale] duration-300 group-hover:scale-110 group-hover:text-black" strokeWidth={1.1} aria-hidden />
                  <h3 className="text-xl font-bold tracking-wide uppercase">{item.label}</h3>
                  <p className="leading-relaxed font-light text-white/80 transition-colors duration-300 group-hover:text-black/80">{item.description}</p>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
