"use client";

import { useState } from "react";
import { Mail, MapPin, Send, MessageSquare, ShieldCheck, CheckCircle2 } from "lucide-react";

export function LandingContact() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", institution: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulasi pengiriman pesan riset
    setSubmitted(true);
  };

  return (
    <section id="kontak" className="py-24 bg-white border-t border-border/70 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold mb-3">
            <Mail className="size-3.5" />
            <span>Hubungi Kami</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight mb-4">
            Kontak & Kolaborasi Riset
          </h2>
          <p className="text-base sm:text-lg text-ink-muted">
            Memiliki pertanyaan seputar metodologi, validasi data, atau pengajuan akses riset ke platform Indonesia Fishing Watch? Hubungi tim kami.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Kolom Kiri: Informasi Kontak */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-7 rounded-2xl bg-surface-subtle/50 border border-border/80 space-y-6">
              <h3 className="text-xl font-bold text-ink">Laboratorium & Afiliasi Riset</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Inisiatif riset ini dipimpin oleh tim akademisi dan mahasiswa riset untuk mewujudkan transparansi data perikanan tangkap berkelanjutan di Indonesia.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-white border border-border text-primary shrink-0 shadow-2xs">
                    <Mail className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-ink-muted block">Email Korespondensi Riset</span>
                    <span className="text-sm font-bold text-ink">kontak@indonesiafishingwatch.id</span>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-white border border-border text-primary shrink-0 shadow-2xs">
                    <MapPin className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-ink-muted block">Fokus Wilayah Riset</span>
                    <span className="text-sm font-bold text-ink">11 WPP-NRI & ZEE Indonesia</span>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-white border border-border text-primary shrink-0 shadow-2xs">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-ink-muted block">Akses Akun Analis</span>
                    <span className="text-sm font-medium text-ink-muted">
                      Akses platform diberikan khusus oleh Administrator melalui undangan terenkripsi.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Formulir Kirim Pesan */}
          <div className="lg:col-span-7">
            <div className="p-7 sm:p-8 rounded-2xl bg-white border border-border shadow-sm">
              <h3 className="text-xl font-bold text-ink mb-1.5">Kirim Pesan atau Pertanyaan</h3>
              <p className="text-sm text-ink-muted mb-6">
                Silakan isi formulir di bawah ini untuk berdiskusi dengan tim pengembang atau pembimbing riset.
              </p>

              {submitted ? (
                <div className="p-6 rounded-xl bg-primary-soft border border-primary/30 text-center space-y-2 animate-in fade-in">
                  <CheckCircle2 className="size-8 text-primary mx-auto mb-1" />
                  <h4 className="text-base font-bold text-ink">Pesan Anda Telah Diterima</h4>
                  <p className="text-xs sm:text-sm text-ink-muted">
                    Terima kasih atas minat Anda pada riset Indonesia Fishing Watch. Tim kami akan segera meninjau pesan Anda.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: "", email: "", institution: "", message: "" });
                    }}
                    className="mt-3 text-xs font-bold text-primary hover:underline"
                  >
                    Kirim pesan lain
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1.5">Nama Lengkap</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nama Anda"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1.5">Email</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@institusi.ac.id"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">Institusi / Universitas / Organisasi</label>
                    <input
                      type="text"
                      value={formData.institution}
                      onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                      placeholder="Nama Institusi / Lab Riset"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">Pesan atau Topik Diskusi</label>
                    <textarea
                      rows={4}
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tuliskan pesan, pertanyaan seputar validasi data, atau tujuan kolaborasi riset..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    <Send className="size-4" />
                    <span>Kirim Pesan ke Tim Riset</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
