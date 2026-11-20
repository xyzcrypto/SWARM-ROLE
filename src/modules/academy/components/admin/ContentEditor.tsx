"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson } from "../../client/hooks";
import { DIFF_LABEL, DIFF_TONE, LEVEL_LABEL, Pill } from "../ui";
import { Field, inputCls, type Overview } from "./AcademyAdmin";

type Run = (b: unknown, ok: string) => Promise<unknown>;
type Q = { id: string; moduleId: string | null; difficulty: string; prompt: string; options: string[]; answer: number; explanation: string; active: boolean };
type ModuleFull = {
  id: string;
  slug: string;
  level: string;
  title: string;
  summary: string;
  minutes: number;
  objectives: string[];
  sections: { heading: string; body: string }[];
  concepts: { term: string; definition: string }[];
  example: { title: string; body: string } | null;
  order: number;
  published: boolean;
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal aria-label={title}>
      <div className="glass max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-display text-lg font-semibold text-content">{title}</div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-content-subtle hover:text-content" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ContentEditor({ data, run }: { data: Overview; run: Run }) {
  const [catId, setCatId] = useState<string>(data.categories[0]?.id ?? "");
  const cat = data.categories.find((c) => c.id === catId) ?? null;
  const [catForm, setCatForm] = useState<null | { id?: string; slug: string; title: string; tagline: string; icon: string; order: number; published: boolean }>(null);
  const [mod, setMod] = useState<null | (Partial<ModuleFull> & { categoryId: string })>(null);
  const [qs, setQs] = useState<Q[] | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [qForm, setQForm] = useState<null | Partial<Q>>(null);

  const loadQs = useCallback(async () => {
    if (!catId) return;
    setQs(null);
    const r = await getJson<{ questions: Q[] }>(`/api/admin/academy?view=questions&category=${catId}`);
    setQs(r.questions);
  }, [catId]);
  useEffect(() => {
    void loadQs();
  }, [loadQs]);

  const editModule = async (id: string) => {
    const r = await getJson<{ module: ModuleFull }>(`/api/admin/academy?view=module&id=${id}`);
    setMod({ ...r.module, categoryId: catId });
  };

  const shown = (qs ?? []).filter((q) => !filter || q.moduleId === filter);

  return (
    <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
      <div className="surface rounded-3xl p-3">
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-content-subtle">Topics</span>
          <button type="button" className="rounded-full p-1.5 text-gold-300 hover:bg-white/5" onClick={() => setCatForm({ slug: "", title: "", tagline: "", icon: "BookOpen", order: data.categories.length + 1, published: true })} aria-label="Add topic">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-0.5">
          {data.categories.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setCatId(c.id)} className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm", c.id === catId ? "bg-gold-400/10 text-gold-100" : "text-content-muted hover:bg-white/[0.03]")}>
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                {!c.published && <EyeOff className="h-3.5 w-3.5 text-content-subtle" />}
                <span className="font-mono text-[10px] text-content-subtle">{c.questions}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {cat && (
        <div className="min-w-0 space-y-5">
          <div className="surface rounded-3xl p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-display text-xl font-semibold text-content">{cat.title}</div>
                <div className="text-sm text-content-muted">{cat.tagline}</div>
                <div className="mt-1 font-mono text-[11px] text-content-subtle">/academy/learn/{cat.slug}</div>
              </div>
              <button type="button" className="btn-secondary h-9 px-3 text-xs" onClick={() => setCatForm({ id: cat.id, slug: cat.slug, title: cat.title, tagline: cat.tagline, icon: cat.icon, order: cat.order, published: cat.published })}>
                <Pencil className="h-3.5 w-3.5" /> Edit topic
              </button>
              <button
                type="button"
                className="btn-ghost h-9 px-3 text-xs text-red-300"
                onClick={() => confirm(`Delete "${cat.title}" with all its lessons and questions? This cannot be undone. Hiding it is usually better.`) && run({ op: "category.delete", id: cat.id }, "Topic deleted")}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-content-subtle">Lessons</span>
              <button
                type="button"
                className="btn-secondary h-8 px-3 text-xs"
                onClick={() => setMod({ categoryId: cat.id, slug: "", level: "beginner", title: "", summary: "", minutes: 5, objectives: [], sections: [{ heading: "", body: "" }], concepts: [], example: null, order: cat.modules.length, published: true })}
              >
                <Plus className="h-3.5 w-3.5" /> Add lesson
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {cat.modules.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-hairline p-3">
                  <Pill tone={DIFF_TONE[m.level]}>{LEVEL_LABEL[m.level]}</Pill>
                  <span className="min-w-0 flex-1 truncate text-sm text-content">{m.title}</span>
                  {!m.published && <Pill>hidden</Pill>}
                  <span className="text-[11px] text-content-subtle">
                    {m.questions} Q · {m.completions} done
                  </span>
                  <button type="button" className="btn-ghost h-8 px-3 text-xs" onClick={() => void editModule(m.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="btn-ghost h-8 px-3 text-xs text-red-300" onClick={() => confirm(`Delete lesson "${m.title}"? Its questions stay in the topic.`) && run({ op: "module.delete", id: m.id }, "Lesson deleted")} aria-label="Delete lesson">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="surface rounded-3xl p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-content-subtle">Question bank</span>
              <select className={cn(inputCls, "ml-auto w-auto py-1.5")} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by lesson">
                <option value="">All lessons</option>
                {cat.modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-secondary h-9 px-3 text-xs" onClick={() => setQForm({ moduleId: filter || null, difficulty: "medium", prompt: "", options: ["", "", "", ""], answer: 0, explanation: "", active: true })}>
                <Plus className="h-3.5 w-3.5" /> Add question
              </button>
            </div>
            {!qs ? (
              <div className="grid h-32 place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-gold-300" />
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {shown.map((q) => (
                  <li key={q.id} className={cn("rounded-2xl border border-hairline p-3.5", !q.active && "opacity-50")}>
                    <div className="flex items-start gap-3">
                      <Pill tone={DIFF_TONE[q.difficulty]}>{DIFF_LABEL[q.difficulty]}</Pill>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-content">{q.prompt}</div>
                        <div className="mt-1 text-xs text-mint-300">✓ {q.options[q.answer]}</div>
                      </div>
                      <button type="button" className="rounded-full p-1.5 text-content-subtle hover:text-content" onClick={() => setQForm(q)} aria-label="Edit question">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-full p-1.5 text-content-subtle hover:text-content"
                        onClick={() => run({ op: "question.save", id: q.id, categoryId: catId, moduleId: q.moduleId, active: !q.active, data: { difficulty: q.difficulty, prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation } }, q.active ? "Question hidden" : "Question active").then(loadQs)}
                        aria-label={q.active ? "Hide question" : "Activate question"}
                      >
                        {q.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button type="button" className="rounded-full p-1.5 text-red-300/70 hover:text-red-300" onClick={() => confirm("Delete this question? If it was ever answered it is archived instead.") && run({ op: "question.delete", id: q.id }, "Question removed").then(loadQs)} aria-label="Delete question">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
                {!shown.length && <li className="text-sm text-content-subtle">No questions here yet.</li>}
              </ul>
            )}
          </div>
        </div>
      )}

      {catForm && (
        <Modal title={catForm.id ? "Edit topic" : "New topic"} onClose={() => setCatForm(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input className={inputCls} value={catForm.title} onChange={(e) => setCatForm({ ...catForm, title: e.target.value })} />
            </Field>
            <Field label="Slug" hint="lowercase-with-dashes, used in the URL">
              <input className={inputCls} value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Tagline">
                <input className={inputCls} value={catForm.tagline} onChange={(e) => setCatForm({ ...catForm, tagline: e.target.value })} />
              </Field>
            </div>
            <Field label="Icon" hint="lucide icon name, e.g. Blocks, Landmark, ShieldCheck">
              <input className={inputCls} value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} />
            </Field>
            <Field label="Order">
              <input type="number" className={inputCls} value={catForm.order} onChange={(e) => setCatForm({ ...catForm, order: Number(e.target.value) })} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-content">
              <input type="checkbox" checked={catForm.published} onChange={(e) => setCatForm({ ...catForm, published: e.target.checked })} /> Published
            </label>
          </div>
          <button
            type="button"
            className="btn-primary mt-5 h-11 w-full justify-center text-sm"
            onClick={async () => {
              if (await run({ op: "category.save", ...catForm }, "Topic saved")) setCatForm(null);
            }}
          >
            Save topic
          </button>
        </Modal>
      )}

      {mod && <ModuleForm mod={mod} onClose={() => setMod(null)} run={run} />}

      {qForm && (
        <Modal title={qForm.id ? "Edit question" : "New question"} onClose={() => setQForm(null)}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Lesson">
                <select className={inputCls} value={qForm.moduleId ?? ""} onChange={(e) => setQForm({ ...qForm, moduleId: e.target.value || null })}>
                  <option value="">No lesson (topic only)</option>
                  {cat?.modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Difficulty">
                <select className={inputCls} value={qForm.difficulty} onChange={(e) => setQForm({ ...qForm, difficulty: e.target.value })}>
                  {["easy", "medium", "hard", "expert"].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Question">
              <textarea className={cn(inputCls, "min-h-[5rem]")} value={qForm.prompt} onChange={(e) => setQForm({ ...qForm, prompt: e.target.value })} />
            </Field>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-subtle">Options (pick the correct one)</span>
              {(qForm.options ?? ["", "", "", ""]).map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={qForm.answer === i} onChange={() => setQForm({ ...qForm, answer: i })} aria-label={`Option ${i + 1} is correct`} />
                  <input
                    className={inputCls}
                    value={o}
                    onChange={(e) => {
                      const opts = [...(qForm.options ?? ["", "", "", ""])];
                      opts[i] = e.target.value;
                      setQForm({ ...qForm, options: opts });
                    }}
                    placeholder={`Option ${"ABCD"[i]}`}
                  />
                </div>
              ))}
            </div>
            <Field label="Explanation" hint="Shown after the answer. 1-2 sentences.">
              <textarea className={cn(inputCls, "min-h-[4rem]")} value={qForm.explanation} onChange={(e) => setQForm({ ...qForm, explanation: e.target.value })} />
            </Field>
            <button
              type="button"
              className="btn-primary h-11 w-full justify-center text-sm"
              onClick={async () => {
                const r = await run(
                  { op: "question.save", id: qForm.id, categoryId: catId, moduleId: qForm.moduleId ?? null, active: qForm.active ?? true, data: { difficulty: qForm.difficulty, prompt: qForm.prompt, options: qForm.options, answer: qForm.answer, explanation: qForm.explanation ?? "" } },
                  "Question saved"
                );
                if (r) {
                  setQForm(null);
                  void loadQs();
                }
              }}
            >
              Save question
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ModuleForm({ mod, onClose, run }: { mod: Partial<ModuleFull> & { categoryId: string }; onClose: () => void; run: Run }) {
  const [m, setM] = useState(mod);
  const lines = (arr?: string[]) => (arr ?? []).join("\n");
  return (
    <Modal title={m.id ? "Edit lesson" : "New lesson"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <input className={inputCls} value={m.title ?? ""} onChange={(e) => setM({ ...m, title: e.target.value })} />
          </Field>
          <Field label="Slug">
            <input className={inputCls} value={m.slug ?? ""} onChange={(e) => setM({ ...m, slug: e.target.value })} />
          </Field>
          <Field label="Level">
            <select className={inputCls} value={m.level} onChange={(e) => setM({ ...m, level: e.target.value })}>
              {["beginner", "intermediate", "advanced", "expert"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minutes">
              <input type="number" className={inputCls} value={m.minutes ?? 5} onChange={(e) => setM({ ...m, minutes: Number(e.target.value) })} />
            </Field>
            <Field label="Order">
              <input type="number" className={inputCls} value={m.order ?? 0} onChange={(e) => setM({ ...m, order: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
        <Field label="Summary">
          <textarea className={cn(inputCls, "min-h-[4rem]")} value={m.summary ?? ""} onChange={(e) => setM({ ...m, summary: e.target.value })} />
        </Field>
        <Field label="Learning objectives" hint="One per line">
          <textarea className={cn(inputCls, "min-h-[5rem]")} value={lines(m.objectives)} onChange={(e) => setM({ ...m, objectives: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
        </Field>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-subtle">Sections</span>
            <button type="button" className="text-xs font-semibold text-gold-300" onClick={() => setM({ ...m, sections: [...(m.sections ?? []), { heading: "", body: "" }] })}>
              + Section
            </button>
          </div>
          {(m.sections ?? []).map((s, i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-hairline p-3">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={s.heading}
                  placeholder="Heading"
                  onChange={(e) => {
                    const ss = [...(m.sections ?? [])];
                    ss[i] = { ...ss[i], heading: e.target.value };
                    setM({ ...m, sections: ss });
                  }}
                />
                <button type="button" className="rounded-full p-2 text-red-300/70" onClick={() => setM({ ...m, sections: (m.sections ?? []).filter((_, k) => k !== i) })} aria-label="Remove section">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea
                className={cn(inputCls, "min-h-[5rem]")}
                value={s.body}
                placeholder="Body"
                onChange={(e) => {
                  const ss = [...(m.sections ?? [])];
                  ss[i] = { ...ss[i], body: e.target.value };
                  setM({ ...m, sections: ss });
                }}
              />
            </div>
          ))}
        </div>
        <Field label="Key concepts" hint="One per line: Term :: definition">
          <textarea
            className={cn(inputCls, "min-h-[5rem]")}
            value={(m.concepts ?? []).map((c) => `${c.term} :: ${c.definition}`).join("\n")}
            onChange={(e) =>
              setM({
                ...m,
                concepts: e.target.value
                  .split("\n")
                  .map((l) => l.split("::"))
                  .filter((p) => p.length >= 2 && p[0].trim() && p[1].trim())
                  .map((p) => ({ term: p[0].trim(), definition: p.slice(1).join("::").trim() })),
              })
            }
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label="Example title">
            <input className={inputCls} value={m.example?.title ?? ""} onChange={(e) => setM({ ...m, example: e.target.value || m.example?.body ? { title: e.target.value, body: m.example?.body ?? "" } : null })} />
          </Field>
          <Field label="Example">
            <textarea className={cn(inputCls, "min-h-[4rem]")} value={m.example?.body ?? ""} onChange={(e) => setM({ ...m, example: { title: m.example?.title ?? "", body: e.target.value } })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-content">
          <input type="checkbox" checked={m.published ?? true} onChange={(e) => setM({ ...m, published: e.target.checked })} /> Published
        </label>
        <button
          type="button"
          className="btn-primary h-11 w-full justify-center text-sm"
          onClick={async () => {
            const example = m.example?.title?.trim() && m.example?.body?.trim() ? m.example : null;
            const r = await run(
              {
                op: "module.save",
                id: m.id,
                categoryId: m.categoryId,
                order: m.order ?? 0,
                published: m.published ?? true,
                data: { slug: m.slug, level: m.level, title: m.title, summary: m.summary ?? "", minutes: m.minutes ?? 5, objectives: m.objectives ?? [], sections: m.sections ?? [], concepts: m.concepts ?? [], example },
              },
              "Lesson saved"
            );
            if (r) onClose();
          }}
        >
          Save lesson
        </button>
      </div>
    </Modal>
  );
}
