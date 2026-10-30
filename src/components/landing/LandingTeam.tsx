"use client";

import { useState } from "react";
import { GraduationCap, Code2, DatabaseCheck, Users } from "lucide-react";

interface TeamMember {
  name: string;
  role: string;
  category: "pembimbing" | "webdev" | "data";
  categoryLabel: string;
  description: string;
  imageSrc: string;
  initials: string;
  badgeTone: string;
  icon: typeof GraduationCap;
}

const TEAM_MEMBERS: TeamMember[] = [
  // 1. Pembimbing
  {
    name: "Prof. Lala Septem Riza",
    role: "Pembimbing Utama",
    category: "pembimbing",
    categoryLabel: "Pembimbing Riset",
    description: "Pengarah visi riset, metodologi komputasi cerdas, dan integritas saintifik maritim.",
    imageSrc: "/team/prof-lala.jpg",
    initials: "LR",
    badgeTone: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: GraduationCap,
  },
  {
    name: "Pak Raffi",
    role: "Pembimbing Teknis",
    category: "pembimbing",
    categoryLabel: "Pembimbing Riset",
    description: "Pembimbing domain teknologi satelit perikanan, validasi arsitektur, dan arahan teknis sistem.",
    imageSrc: "/team/pak-raffi.jpg",
    initials: "RF",
    badgeTone: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: GraduationCap,
  },
  // 2. Web Dev
  {
    name: "Naufal Rizki Rabbani",
    role: "Web Developer",
    category: "webdev",
    categoryLabel: "Pengembang Web & Sistem",
    description: "Perancangan arsitektur aplikasi web terintegrasi, manajemen data backend, dan pipeline worker.",
    imageSrc: "/team/naufal.jpg",
    initials: "NR",
    badgeTone: "bg-teal-100 text-teal-800 border-teal-200",
    icon: Code2,
  },
  {
    name: "Harry Supriadi",
    role: "Web Developer",
    category: "webdev",
    categoryLabel: "Pengembang Web & Sistem",
    description: "Pengembangan antarmuka pengguna (UI/UX), visualisasi spasial peta interaktif, dan performa web.",
    imageSrc: "/team/harry.jpg",
    initials: "HS",
    badgeTone: "bg-teal-100 text-teal-800 border-teal-200",
    icon: Code2,
  },
  // 3. Validasi Data
  {
    name: "Shakila Aulia",
    role: "Validasi Data",
    category: "data",
    categoryLabel: "Validasi & Analisis Data",
    description: "Verifikasi dataset biofisik oseanografi, keselarasan parameter lingkungan laut, dan batas 11 WPP.",
    imageSrc: "/team/shakila.jpg",
    initials: "SA",
    badgeTone: "bg-amber-100 text-amber-800 border-amber-200",
    icon: DatabaseCheck,
  },
  {
    name: "Nurul",
    role: "Validasi Data",
    category: "data",
    categoryLabel: "Validasi & Analisis Data",
    description: "Kurasi data deteksi kapal malam VIIRS, audit anomali sinyal transponder AIS, dan kualitas data.",
    imageSrc: "/team/nurul.jpg",
    initials: "NU",
    badgeTone: "bg-amber-100 text-amber-800 border-amber-200",
    icon: DatabaseCheck,
  },
];

function TeamCard({ member }: { member: TeamMember }) {
  const [imageError, setImageError] = useState(false);
  const Icon = member.icon;

  return (
    <div className="group relative rounded-2xl bg-white border border-border/80 hover:border-primary/40 p-6 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Foto / Avatar with graceful fallback */}
        <div className="relative mb-5 flex justify-center">
          <div className="relative size-28 sm:size-32 rounded-2xl overflow-hidden border-2 border-border/80 group-hover:border-primary/50 shadow-xs transition-colors bg-gradient-to-br from-surface-subtle via-white to-primary-soft/30 flex items-center justify-center">
            {!imageError ? (
              <img
                src={member.imageSrc}
                alt={member.name}
                onError={() => setImageError(true)}
                className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
              />
            ) : null}

            {/* Fallback Graphic Avatar */}
            {imageError && (
              <div className="flex items-center justify-center text-center p-2 select-none">
                <span className="text-3xl font-black tracking-wider text-primary">
                  {member.initials}
                </span>
              </div>
            )}
          </div>

          {/* Mini role icon badge */}
          <div className="absolute -bottom-2 right-1/2 translate-x-12 p-1.5 rounded-lg bg-white border border-border shadow-xs text-primary">
            <Icon className="size-4" />
          </div>
        </div>

        {/* Member Details */}
        <div className="text-center">
          <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border mb-2.5 ${member.badgeTone}`}>
            {member.categoryLabel}
          </span>
          <h3 className="text-lg font-bold text-ink group-hover:text-primary transition-colors">
            {member.name}
          </h3>
          <p className="text-xs font-semibold text-primary mb-3">
            {member.role}
          </p>
          <p className="text-xs text-ink-muted leading-relaxed">
            {member.description}
          </p>
        </div>
      </div>

      {/* Decorative footer tag */}
      <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-center text-[11px] text-ink-muted/80">
        <span>Riset Pemantauan Maritim</span>
      </div>
    </div>
  );
}

export function LandingTeam() {
  return (
    <section id="about" className="py-24 bg-surface-subtle/40 border-t border-border/70 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold mb-3">
            <Users className="size-3.5" />
            <span>Tentang Tim Riset & Pengembang</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight mb-4">
            Kolaborator & Tim Pengembang
          </h2>
          <p className="text-base sm:text-lg text-ink-muted leading-relaxed">
            Platform Indonesia Fishing Watch dikembangkan melalui kolaborasi terstruktur antara pembimbing akademik, tim pengembang perangkat lunak, serta spesialis validasi data kelautan.
          </p>
        </div>

        {/* 6 Team Members Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {TEAM_MEMBERS.map((member) => (
            <TeamCard key={member.name} member={member} />
          ))}
        </div>
      </div>
    </section>
  );
}
