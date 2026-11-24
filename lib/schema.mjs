import { z } from "zod";
export const id = z.string().min(1).max(100);
const str = z.string().max(10000),
  title = z.string().trim().min(1).max(240);
const url = z
  .string()
  .url()
  .regex(/^https?:\/\//i);
export const settings = z.object({
  mode: z.enum(["auto", "manual"]).default("auto"),
  threshold: z.number().int().min(0).max(500).default(0),
  seconds: z.union([z.literal(0), z.number().int().min(3).max(300)]).default(0),
  countdown: z.number().int().min(0).max(10).default(3),
  solution: z.number().int().min(2).max(60).default(5),
  board: z.number().int().min(2).max(60).default(5),
  closeAll: z.boolean().default(false),
  ranks: z.enum(["each", "interval", "final", "private"]).default("each"),
  interval: z.number().int().min(1).max(100).default(2),
  top: z.union([z.literal(3), z.literal(5), z.literal(10)]).default(5),
  personal: z.boolean().default(true),
  fixed: z.boolean().default(false),
  shuffle: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  sound: z.boolean().default(true),
  group: z.string().max(80).default(""),
});
export const media = z.object({
  file: id,
  caption: str.default(""),
  alt: str.default(""),
  transcript: str.default(""),
});
const option = z.object({ id, text: str, file: id.optional() });
export const question = z.object({
  id,
  text: title,
  textPosition: z.number().int().min(0).max(20).default(0),
  type: z.enum(["one", "many", "bool", "number"]),
  options: z.array(option).max(30),
  correct: z.array(id),
  value: z.number().finite().default(0),
  tolerance: z.number().nonnegative().default(0),
  unit: z.string().max(60).default(""),
  seconds: z.number().int().min(3).max(300).default(25),
  explanation: str.default(""),
  media: z.array(media).max(20).default([]),
});
export const quiz = z.object({
  title,
  questions: z.array(question).max(200),
  settings: settings.default({}),
});
export const task = z.object({
  title,
  intro: str,
  cover: id.optional(),
  blocks: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("text"), text: str }),
        z.object({
          kind: z.literal("image"),
          file: z.union([id,z.literal("")]),
          alt: str,
          caption: str,
        }),
        z.object({ kind: z.literal("file"), file: z.union([id,z.literal("")]), label: str }),
        z.object({ kind: z.literal("link"), url, label: title }),
        z.object({ kind: z.literal("quiz"), quiz: id }),
      ]),
    )
    .max(300),
});
export function validateGame(q) {
  if (!q.questions.length) throw Error("Doplňte alespoň jednu otázku.");
  for (const [i, x] of q.questions.entries()) {
    const ids = x.options.map((o) => o.id),
      correct = new Set(x.correct);
    if (
      x.type !== "number" &&
      (ids.length < 2 ||
        ids.length !== new Set(ids).size ||
        !correct.size ||
        correct.size !== x.correct.length ||
        x.correct.some((k) => !ids.includes(k)) ||
        (x.type !== "many" && correct.size !== 1) ||
        x.options.some((o) => !o.text.trim() && !o.file) ||
        (x.type === "bool" && ids.join(",") !== "true,false"))
    )
      throw Error("Zkontrolujte možnosti a řešení otázky " + (i + 1) + ".");
  }
}
