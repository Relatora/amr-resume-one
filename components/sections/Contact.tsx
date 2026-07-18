"use client";

import { motion } from "framer-motion";
import { useContent } from "@/components/providers/ContentProvider";
import { fadeUp } from "@/lib/motion";

export default function Contact() {
  const { content } = useContent();
  const { personal } = content;

  return (
    <section id="contact" className="relative scroll-mt-20 overflow-hidden py-24">
      <div className="pointer-events-none absolute -bottom-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="relative mx-auto max-w-3xl px-4 text-center sm:px-6"
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent-teal">
          Contact
        </p>
        <h2 className="font-display mt-3 text-3xl font-bold sm:text-5xl">
          Let&apos;s build something{" "}
          <span className="gradient-text">great</span>.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ink-dim sm:text-base">
          Whether it&apos;s cloud architecture, a full-stack product, or an
          AI-accelerated workflow — I&apos;d love to hear about it.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`mailto:${personal.email}`}
            className="press rounded-lg bg-gradient-to-r from-teal-400 via-violet-400 to-amber-400 px-6 py-3 text-sm font-semibold text-on-accent transition hover:opacity-90 hover:shadow-lg hover:shadow-violet-400/20 active:scale-[0.98]"
          >
            {personal.email}
          </a>
          <a
            href={personal.website}
            target="_blank"
            rel="noreferrer"
            className="press rounded-lg border border-line px-6 py-3 text-sm font-semibold transition hover:border-teal-400/50 hover-veil"
          >
            {personal.website.replace(/^https?:\/\//, "")}
          </a>
        </div>
        <p className="mt-16 text-xs text-ink-dim">
          © {new Date().getFullYear()} {personal.name} · Built with Next.js,
          Tailwind & Framer Motion
        </p>
      </motion.div>
    </section>
  );
}
