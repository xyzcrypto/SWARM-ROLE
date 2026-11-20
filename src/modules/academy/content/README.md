# Academy starter content

One JSON file per category, `<slug>.json`. Seeded into the database once
(`seedAcademyContent()`), after which admins edit it from /dashboard → Academy.
The database is the source of truth at runtime; these files are only the seed.

Shape (validated by `src/modules/academy/lib/content-schema.ts`):

```jsonc
{
  "slug": "blockchain-fundamentals",       // kebab-case, unique
  "title": "Blockchain Fundamentals",
  "tagline": "One sentence, max 90 chars",
  "icon": "Blocks",                         // a lucide-react icon name
  "order": 1,
  "modules": [                              // exactly 4: beginner, intermediate, advanced, expert
    {
      "slug": "what-is-a-blockchain",        // unique within the category
      "level": "beginner",                   // beginner | intermediate | advanced | expert
      "title": "What is a blockchain?",
      "summary": "One or two sentences.",
      "minutes": 6,
      "objectives": ["3 short learning objectives"],
      "sections": [{ "heading": "…", "body": "2-4 plain sentences" }],   // 3-4 sections
      "concepts": [{ "term": "…", "definition": "one sentence" }],     // 4 concepts
      "example": { "title": "…", "body": "a real-world example, 2-4 sentences" }
    }
  ],
  "questions": [                            // 5 per module = 20 per category
    {
      "module": "what-is-a-blockchain",      // module slug
      "difficulty": "easy",                  // easy | medium | hard | expert (beginner=easy, intermediate=medium, advanced=hard, expert=expert)
      "prompt": "Question text?",
      "options": ["A", "B", "C", "D"],       // exactly 4, similar length, one clearly correct
      "answer": 0,                           // index of the correct option
      "explanation": "Why the answer is right, 1-2 sentences."
    }
  ]
}
```
