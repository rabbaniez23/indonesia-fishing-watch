"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Bernilai true sekali saat elemen masuk layar, lalu tetap true. */
export function useInView<T extends Element>(threshold = 0.15): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setSeen(true);
        observer.disconnect();
      },
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, seen];
}

type RevealProps = { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" };

/** Isi naik pelan saat masuk layar. Pengunjung yang mematikan animasi langsung melihat isinya. */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: RevealProps) {
  const [ref, seen] = useInView<HTMLDivElement & HTMLLIElement>();
  const style: CSSProperties = { transitionDelay: `${delay}ms` };
  return (
    <Tag
      ref={ref}
      style={style}
      className={`transition-[opacity,translate] duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${
        seen ? "translate-y-0 opacity-100" : "translate-y-7 opacity-0"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Judul besar yang naik dari balik garis bawahnya. */
export function RevealTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [ref, seen] = useInView<HTMLHeadingElement>(0.2);
  return (
    <h2 ref={ref} className={`overflow-hidden pb-[0.04em] ${className}`}>
      <span
        className={`block transition-transform duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:translate-y-0 motion-reduce:transition-none ${
          seen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {children}
      </span>
    </h2>
  );
}

/** Garis pendek yang memanjang dari kiri. */
export function RevealRule() {
  const [ref, seen] = useInView<HTMLSpanElement>(0.5);
  return (
    <span
      ref={ref}
      aria-hidden
      className={`block h-1.5 w-14 origin-left bg-white/75 transition-transform delay-200 duration-700 ease-out motion-reduce:scale-x-100 motion-reduce:transition-none ${
        seen ? "scale-x-100" : "scale-x-0"
      }`}
    />
  );
}

const format = (value: number) => new Intl.NumberFormat("id-ID").format(Math.round(value));

/** Angka yang menghitung saat pertama terlihat, dan bergulir ke nilai baru saat berubah. */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.4);
  const shown = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || !seen) return;
    const from = shown.current;
    if (prefersReducedMotion() || from === value) {
      shown.current = value;
      element.textContent = format(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      const current = from + (value - from) * (1 - (1 - t) ** 3);
      shown.current = current;
      element.textContent = format(current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ref, seen, value]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(value)}
    </span>
  );
}
