import { Container } from "./ui/primitives";
import { YouTubeIcon, XIcon, TelegramIcon, LinkedInIcon } from "./BrandIcons";

const items = [
  { label: "YouTube", Icon: YouTubeIcon },
  { label: "X", Icon: XIcon },
  { label: "Telegram", Icon: TelegramIcon },
  { label: "LinkedIn", Icon: LinkedInIcon },
  { label: "Web3 Academy", Icon: TelegramIcon },
  { label: "TradeKaroVerse", Icon: TelegramIcon },
];

export function ProofStrip() {
  return (
    <div className="border-b border-line py-10">
      <Container>
        <p className="text-center mono text-[11px] uppercase tracking-[0.2em] text-zinc-600">
          One ecosystem · trusted across every platform
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 opacity-70">
          {items.map((it) => (
            <div
              key={it.label}
              className="flex items-center gap-2 text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <it.Icon className="h-5 w-5" />
              <span className="text-sm font-medium">{it.label}</span>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
