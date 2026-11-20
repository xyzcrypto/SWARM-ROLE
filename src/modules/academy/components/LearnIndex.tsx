"use client";

import { useEffect, useState } from "react";
import { getJson, useMe } from "../client/hooks";
import { say } from "../client/audio";
import { Library } from "./Library";
import type { CatalogCategory } from "./types";
import { ProgressBar, SectionTitle } from "./ui";

export function LearnIndex() {
  const [catalog, setCatalog] = useState<CatalogCategory[] | null>(null);
  const { me } = useMe();
  useEffect(() => {
    say("learn_pick", { auto: true });
  }, []);
  useEffect(() => {
    getJson<{ categories: CatalogCategory[] }>("/api/academy/catalog")
      .then((r) => setCatalog(r.categories))
      .catch(() => setCatalog([]));
  }, []);
  return (
    <div>
      <SectionTitle
        eyebrow="Learning library"
        title={<span className="text-gold-gradient">Learn Web3, one level at a time</span>}
        sub="Every topic runs Beginner, Intermediate, Advanced, Expert. Read a short lesson, pass its knowledge check, and the lesson is complete."
      />
      {me && (
        <div className="mb-6 max-w-md">
          <div className="flex justify-between text-xs text-content-subtle">
            <span>Your progress</span>
            <span>
              {me.progress.done} of {me.progress.total} lessons
            </span>
          </div>
          <ProgressBar value={me.progress.total ? me.progress.done / me.progress.total : 0} tone="mint" className="mt-1.5" />
        </div>
      )}
      <Library categories={catalog} me={me} />
    </div>
  );
}
