import type { SafeUser } from "@/lib/auth/service";
import { Reveal } from "./landing-motion";
import { AccessLink, FOCUS, LABEL, SectionIntro, SectionPhoto, WRAP } from "./landing-ui";

/** Isi dengan alamat email tim yang aktif; selama kosong, tautan email tidak ditampilkan. */
const CONTACT_EMAIL: string = "";

export function LandingContact({ user }: { user: SafeUser | null }) {
  return (
    <section id="kontak" className="relative flex min-h-[85svh] scroll-mt-20 items-center overflow-hidden bg-black py-28">
      <SectionPhoto src="/landing/cakrawala-v2.webp" opacity="opacity-95" />
      <div className={`${WRAP} relative flex flex-col gap-8`}>
        <SectionIntro title="Kontak">Untuk kolaborasi riset atau pengajuan akses, silakan hubungi tim riset. Akun dibuat lewat undangan Admin.</SectionIntro>
        <Reveal delay={250} className="flex flex-wrap items-center gap-6">
          <AccessLink user={user} />
          {CONTACT_EMAIL && (
            <a href={`mailto:${CONTACT_EMAIL}`} className={`text-white underline underline-offset-4 ${FOCUS} ${LABEL}`}>
              {CONTACT_EMAIL}
            </a>
          )}
        </Reveal>
      </div>
    </section>
  );
}
