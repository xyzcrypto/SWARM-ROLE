"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useHydrated } from "@/lib/useClientFlag";

/**
 * Wraps a trigger (avatar/banner) so clicking it opens the full, uncropped
 * image full-screen - matching X's "tap a profile photo to see it full size"
 * pattern. Rendered via a portal to document.body (not inline) because the
 * profile hero card uses `.glass` (backdrop-filter), which creates a new
 * containing block for `position: fixed` descendants in most browsers - an
 * un-portaled overlay would be clipped to the card instead of the viewport.
 */
export function ImageLightbox({
  src,
  alt,
  className,
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Portals need a DOM target, so this only renders after hydration.
  const mounted = useHydrated();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${alt} full size`}
        className={className}
      >
        {children}
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                role="dialog"
                aria-modal="true"
                aria-label={alt}
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
                <motion.img
                  initial={{ scale: 0.96 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  src={src}
                  alt={alt}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
