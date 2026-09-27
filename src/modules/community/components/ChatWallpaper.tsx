"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { chatBackgroundById } from "@modules/community/lib/chat-backgrounds";
import { photoReadability } from "@modules/community/lib/chat-wallpaper";
import type { ChatChoice, ChatPhoto, PhotoSettings } from "./useChatAppearance";

/**
 * The room's background, drawn.
 *
 * ⚠️ ONE renderer, used by both the room and the live preview in the
 * appearance sheet. If the preview had its own drawing code, "what you see is
 * what you get" would be a promise two pieces of code had to keep in step.
 *
 * ## It takes no theme
 *
 * Both theme variants are emitted as CSS custom properties and `.chat-wp` /
 * `.chat-wp-scrim` in globals.css pick one off `html.dark`. So the wallpaper
 * flips in the same frame as the rest of the page. The first version took the
 * theme as a prop fed from a MutationObserver, and a browser probe caught it
 * showing the dark scrim 400ms after the page had gone light.
 *
 * ## It is static
 *
 * Nothing here runs per frame. It sits behind a scrolling list; the only
 * transitions are opacity and the scrim colour, so changes cross-fade.
 */
export function ChatWallpaper({
  choice,
  photo,
  settings,
  className,
}: {
  choice: ChatChoice;
  photo: ChatPhoto | null;
  settings: PhotoSettings;
  className?: string;
}) {
  if (choice === "photo" && photo) {
    // Each theme gets the dim computed for IT: a bright photo needs dimming in
    // dark mode, a dark photo in light mode, and one number cannot serve both.
    const dimDark = photoReadability(photo, settings.dim, "dark").dim;
    const dimLight = photoReadability(photo, settings.dim, "light").dim;
    return (
      <div aria-hidden className={cn("pointer-events-none overflow-hidden", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob:
            URL; the image optimiser cannot and should not see it. */}
        <img
          src={photo.url}
          alt=""
          draggable={false}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-[filter,transform] duration-300"
          style={
            settings.blur
              ? {
                  filter: "blur(14px)",
                  // Blur fades the edges toward transparent; scaling past the
                  // frame keeps the fade outside the visible area.
                  transform: "scale(1.1)",
                }
              : undefined
          }
        />
        {/* The scrim: `max(member's dim, readability floor)` for whichever
            theme is showing. A member can dim further, never lighter than the
            point where messages stop being readable. */}
        <div
          data-chat-scrim
          className="chat-wp-scrim absolute inset-0"
          style={{ "--dim-dark": dimDark, "--dim-light": dimLight } as CSSProperties}
        />
      </div>
    );
  }

  const preset = chatBackgroundById(choice === "photo" ? "default" : choice);
  return (
    <div
      aria-hidden
      className={cn("chat-wp pointer-events-none transition-opacity duration-500", className)}
      style={
        {
          "--wp-dark": preset.dark || "none",
          "--wp-light": preset.light || "none",
          backgroundSize: preset.size,
        } as CSSProperties
      }
    />
  );
}

/**
 * A preset swatch's paint, through the same custom properties the room uses,
 * so a swatch cannot show one theme while the room shows the other.
 */
export function swatchStyle(dark: string, light: string, size?: string): CSSProperties {
  return { "--wp-dark": dark || "none", "--wp-light": light || "none", backgroundSize: size } as CSSProperties;
}
