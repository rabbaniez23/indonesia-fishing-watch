import Image from "next/image";
import { Reveal } from "./landing-motion";
import { LABEL, SectionIntro, UpiMark, WRAP } from "./landing-ui";

type Member = { name: string; role: string; initials: string; photo?: string };

/** Foto ada di public/team/; anggota tanpa `photo` tampil dengan inisial. */
const MEMBERS: Member[] = [
  { name: "Prof. Lala Septem Riza", role: "Pembimbing utama", initials: "LR", photo: "/team/prof-lala.jpg" },
  { name: "Pak Raffi", role: "Pembimbing teknis", initials: "RF" },
  { name: "Naufal Rizki Rabbani", role: "Web developer", initials: "NR" },
  { name: "Harry Supriadi", role: "Web developer", initials: "HS" },
  { name: "Shakila Aulia", role: "Validasi data", initials: "SA" },
  { name: "Nurul", role: "Validasi data", initials: "NU" },
];

export function LandingTeam() {
  return (
    <section id="tim" className="scroll-mt-20 bg-[#0A1218] py-24 md:py-32">
      <div className={`${WRAP} flex flex-col gap-14`}>
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionIntro title="Tim riset">Dikembangkan bersama pembimbing akademik, pengembang web, dan tim validasi data.</SectionIntro>
          <Reveal delay={200}>
            <UpiMark size={72} />
          </Reveal>
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
          {MEMBERS.map((member, index) => (
            <Reveal as="li" key={member.name} delay={index * 90}>
              <div className="group flex flex-col gap-3">
                <div className="flex aspect-square items-center justify-center overflow-hidden border border-white/40 bg-white/5 transition-colors duration-300 group-hover:border-white">
                  {member.photo ? (
                    <Image
                      src={member.photo}
                      alt={`Foto ${member.name}`}
                      width={300}
                      height={300}
                      unoptimized
                      className="size-full object-cover object-top grayscale transition-[filter,scale] duration-500 group-hover:scale-105 group-hover:grayscale-0"
                    />
                  ) : (
                    <span aria-hidden className="text-3xl font-bold tracking-wider text-white/60 transition-[color,scale] duration-300 group-hover:scale-110 group-hover:text-white">
                      {member.initials}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg leading-tight font-bold tracking-wide uppercase">{member.name}</h3>
                  <p className={`${LABEL} !font-normal text-white/75`}>{member.role}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
