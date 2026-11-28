"use client";

import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, inputCls, type Overview } from "./AcademyAdmin";

type Run = (b: unknown, ok: string) => Promise<unknown>;

function Num({ value, onChange, step = 1 }: { value: number; onChange: (n: number) => void; step?: number }) {
  return <input type="number" step={step} className={inputCls} value={value} onChange={(e) => onChange(Number(e.target.value))} />;
}

function Card({ title, sub, children, onSave, onReset }: { title: string; sub: string; children: React.ReactNode; onSave: () => void; onReset: () => void }) {
  return (
    <div className="surface rounded-3xl p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold text-content">{title}</div>
          <div className="text-xs text-content-subtle">{sub}</div>
        </div>
        <button type="button" className="btn-ghost h-9 px-3 text-xs" onClick={() => confirm("Reset these settings to the defaults?") && onReset()}>
          <RotateCcw className="h-3.5 w-3.5" /> Defaults
        </button>
        <button type="button" className="btn-primary h-9 px-4 text-xs" onClick={onSave}>
          <Save className="h-3.5 w-3.5" /> Save
        </button>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export function SettingsEditor({ data, run }: { data: Overview; run: Run }) {
  const [xp, setXp] = useState(data.config.xp);
  const [levels, setLevels] = useState(data.config.levels);
  const [awards, setAwards] = useState(data.config.awards);
  const [ach, setAch] = useState(data.config.achievements);
  const diffs = ["easy", "medium", "hard", "expert"] as const;

  return (
    <div className="space-y-5">
      <Card title="Scoring & XP" sub="Applies to quizzes finished after you save. Past XP is never recalculated." onSave={() => run({ op: "config.save", key: "xp", value: xp }, "XP rules saved")} onReset={() => run({ op: "config.reset", key: "xp" }, "XP rules reset")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {diffs.map((d) => (
            <Field key={d} label={`Points: ${d}`}>
              <Num value={xp.base[d]} onChange={(n) => setXp({ ...xp, base: { ...xp.base, [d]: n } })} />
            </Field>
          ))}
          {diffs.map((d) => (
            <Field key={d} label={`Seconds: ${d}`}>
              <Num value={xp.seconds[d]} onChange={(n) => setXp({ ...xp, seconds: { ...xp.seconds, [d]: n } })} />
            </Field>
          ))}
          <Field label="Speed bonus (max fraction)" hint="0.5 = up to +50% for an instant answer">
            <Num step={0.05} value={xp.speedBonus} onChange={(n) => setXp({ ...xp, speedBonus: n })} />
          </Field>
          <Field label="Streak bonus from" hint="correct answers in a row">
            <Num value={xp.streakFrom} onChange={(n) => setXp({ ...xp, streakFrom: n })} />
          </Field>
          <Field label="Streak step / cap">
            <div className="flex gap-2">
              <Num step={0.05} value={xp.streakStep} onChange={(n) => setXp({ ...xp, streakStep: n })} />
              <Num step={0.05} value={xp.streakCap} onChange={(n) => setXp({ ...xp, streakCap: n })} />
            </div>
          </Field>
          <Field label="Score points per 1 XP">
            <Num value={xp.scoreToXp} onChange={(n) => setXp({ ...xp, scoreToXp: n })} />
          </Field>
          <Field label="Perfect-run bonus" hint="fraction of quiz XP">
            <Num step={0.05} value={xp.perfectBonus} onChange={(n) => setXp({ ...xp, perfectBonus: n })} />
          </Field>
          <Field label="Daily quiz XP cap" hint="0 = no cap">
            <Num value={xp.dailyQuizCap} onChange={(n) => setXp({ ...xp, dailyQuizCap: n })} />
          </Field>
          <Field label="Repeat cooldown (days)" hint="re-answering inside it earns no XP">
            <Num value={xp.repeatCooldownDays} onChange={(n) => setXp({ ...xp, repeatCooldownDays: n })} />
          </Field>
          <Field label="Lesson XP / pass %">
            <div className="flex gap-2">
              <Num value={xp.module} onChange={(n) => setXp({ ...xp, module: n })} />
              <Num value={xp.modulePass} onChange={(n) => setXp({ ...xp, modulePass: n })} />
            </div>
          </Field>
          <Field label="Streak XP per day">
            <Num value={xp.streakDay} onChange={(n) => setXp({ ...xp, streakDay: n })} />
          </Field>
          <Field label="Live XP per point">
            <Num step={0.01} value={xp.livePerPoint} onChange={(n) => setXp({ ...xp, livePerPoint: n })} />
          </Field>
          <Field label="Live podium XP (1st, 2nd, 3rd)">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <Num key={i} value={xp.livePodium[i]} onChange={(n) => setXp({ ...xp, livePodium: xp.livePodium.map((v, k) => (k === i ? n : v)) as [number, number, number] })} />
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {Object.keys(xp.modeBonus).map((m) => (
            <Field key={m} label={`${m} bonus`}>
              <Num value={xp.modeBonus[m as keyof typeof xp.modeBonus]} onChange={(n) => setXp({ ...xp, modeBonus: { ...xp.modeBonus, [m]: n } })} />
            </Field>
          ))}
        </div>
        <div className="mt-5">
          <Field label="Streak milestones" hint="day:XP, comma separated, e.g. 3:30, 7:100">
            <input
              className={inputCls}
              defaultValue={Object.entries(xp.streakMilestones)
                .map(([d, v]) => `${d}:${v}`)
                .join(", ")}
              onChange={(e) => {
                const m: Record<string, number> = {};
                for (const part of e.target.value.split(",")) {
                  const [d, v] = part.split(":").map((s) => s.trim());
                  if (/^\d+$/.test(d) && Number.isFinite(Number(v))) m[d] = Number(v);
                }
                setXp({ ...xp, streakMilestones: m });
              }}
            />
          </Field>
        </div>
      </Card>

      <Card title="Levels" sub="The first level always starts at 0 XP." onSave={() => run({ op: "config.save", key: "levels", value: levels }, "Levels saved")} onReset={() => run({ op: "config.reset", key: "levels" }, "Levels reset")}>
        <div className="space-y-2">
          {levels.map((l, i) => (
            <div key={i} className="grid grid-cols-[3rem_minmax(0,1fr)_8rem_2rem] items-center gap-2">
              <span className="font-mono text-sm text-gold-300">L{i + 1}</span>
              <input className={inputCls} value={l.name} onChange={(e) => setLevels(levels.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              <Num value={l.xp} onChange={(n) => setLevels(levels.map((x, k) => (k === i ? { ...x, xp: n } : x)))} />
              <button type="button" className="text-red-300/70" onClick={() => levels.length > 2 && setLevels(levels.filter((_, k) => k !== i))} aria-label="Remove level">
                ×
              </button>
            </div>
          ))}
          <button type="button" className="text-xs font-semibold text-gold-300" onClick={() => setLevels([...levels, { name: "New level", xp: (levels[levels.length - 1]?.xp ?? 0) * 2 || 100 }])}>
            + Level
          </button>
        </div>
      </Card>

      <Card title="Certificate awards" sub="Who gets a certificate when a period or live quiz ends. Turn off auto to approve each one yourself." onSave={() => run({ op: "config.save", key: "awards", value: awards }, "Award rules saved")} onReset={() => run({ op: "config.reset", key: "awards" }, "Award rules reset")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(awards) as (keyof typeof awards)[]).map((k) => (
            <div key={k} className="space-y-2 rounded-2xl border border-hairline p-3">
              <div className="font-semibold capitalize text-content">{k}</div>
              <Field label="Top places">
                <Num value={awards[k].top} onChange={(n) => setAwards({ ...awards, [k]: { ...awards[k], top: n } })} />
              </Field>
              <Field label={k === "live" ? "Min score" : "Min XP"}>
                <Num value={awards[k].minXp} onChange={(n) => setAwards({ ...awards, [k]: { ...awards[k], minXp: n } })} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-content">
                <input type="checkbox" checked={awards[k].auto} onChange={(e) => setAwards({ ...awards, [k]: { ...awards[k], auto: e.target.checked } })} /> Issue automatically
              </label>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Achievements" sub="Turn achievements on or off and set their XP. Conditions are fixed in code." onSave={() => run({ op: "config.save", key: "achievements", value: ach }, "Achievements saved")} onReset={() => run({ op: "config.reset", key: "achievements" }, "Achievements reset")}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ach.map((a, i) => (
            <div key={a.code} className={cn("grid grid-cols-[auto_minmax(0,1fr)_5rem] items-center gap-3 rounded-2xl border border-hairline p-3", !a.enabled && "opacity-60")}>
              <input type="checkbox" checked={a.enabled} onChange={(e) => setAch(ach.map((x, k) => (k === i ? { ...x, enabled: e.target.checked } : x)))} aria-label={`Enable ${a.title}`} />
              <div className="min-w-0">
                <input className={cn(inputCls, "py-1.5")} value={a.title} onChange={(e) => setAch(ach.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} />
                <div className="mt-1 truncate text-[0.6875rem] text-content-subtle">{a.description}</div>
              </div>
              <Num value={a.xp} onChange={(n) => setAch(ach.map((x, k) => (k === i ? { ...x, xp: n } : x)))} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
