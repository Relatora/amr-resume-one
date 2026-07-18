"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";

export default function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="mb-10"
    >
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent-teal">
        {eyebrow}
      </p>
      <h2 className="font-display mt-2 text-3xl font-bold sm:text-4xl">
        {title}
      </h2>
      <div className="mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-teal-400 via-violet-400 to-amber-400" />
    </motion.div>
  );
}
