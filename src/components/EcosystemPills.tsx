"use client";

import { motion } from "framer-motion";
import { Zap, Boxes, LineChart, Coins, Hexagon } from "lucide-react";
import { Container } from "./ui/primitives";

const pills = [
  { label: "Alpha", Icon: Zap, tone: "text-gold-300" },
  { label: "Web3", Icon: Boxes, tone: "text-mint-300" },
  { label: "Perp DEX", Icon: LineChart, tone: "text-sky-300" },
  { label: "DeFi", Icon: Coins, tone: "text-gold-300" },
  { label: "NFT", Icon: Hexagon, tone: "text-violet-300" },
];

export function EcosystemPills() {
  return (
    <div className="relative overflow-hidden border-b border-line py-12">
      <Container>
        <p className="text-center mono text-[11px] uppercase tracking-[0.22em] text-zinc-600">
          One ecosystem · built across the entire stack
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {pills.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 3.2 + i * 0.35,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.2,
                }}
                whileHover={{ scale: 1.06, y: -8 }}
                className="group flex cursor-default items-center gap-2.5 rounded-2xl border border-line bg-ink-900/60 px-4 py-2.5 backdrop-blur transition-colors hover:border-mint-500/40 sm:px-5 sm:py-3"
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 transition-all group-hover:ring-mint-500/30 ${p.tone}`}
                >
                  <p.Icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <span className="text-sm font-semibold tracking-tight text-zinc-200 transition-colors group-hover:text-white">
                  {p.label}
                </span>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </Container>
    </div>
  );
}
