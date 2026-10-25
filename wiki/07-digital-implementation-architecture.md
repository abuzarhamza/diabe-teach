# 07 - Digital Implementation Blueprint

This architectural blueprint outlines how to engineer a production-ready, interactive digital version of **Diabe-teach** as a modern web and mobile application, translating the physical RCT game mechanics into software.

---

## High-Level System Architecture

```
+-----------------------------------------------------------------------------------+
|                            FRONTEND (React / Next.js / Tailwind)                  |
|  - 7x7 Interactive Matrix Grid UI     - Gesture & Drag-to-Select Chain Builder    |
|  - Timer & Turn Management            - Rationale Explanation Input Form          |
|  - Leaderboard & Chain Visualizer     - Post-Session Quiz & Feedback Survey       |
+-----------------------------------------------------------------------------------+
                                          |
                                          | JSON API / WebSockets
                                          v
+-----------------------------------------------------------------------------------+
|                             BACKEND / GAME LOGIC ENGINE                           |
|  1. Grid Engine: Shuffler, seed-based board generator, balanced category spread   |
|  2. Graph Validator: 2D Chebyshev Adjacency matrix verification (O(1) path check) |
|  3. Clinical Validator: Rules engine + LLM Clinical Verification for explanations |
|  4. Scoring Engine: Length + Multi-chain scoring + tie-breaker algorithms          |
|  5. Multi-Player & Room Orchestrator: Asynchronous solo or synchronous multiplayer |
+-----------------------------------------------------------------------------------+
```

---

## 1. Grid Engine & 2D Adjacency Graph Math

The board is a 2-dimensional array of coordinates $(r, c)$ where $0 \le r < 7$ and $0 \le c < 7$.

### Adjacency Definition (Chebyshev Distance)
Two cells $P_1 = (r_1, c_1)$ and $P_2 = (r_2, c_2)$ are physically adjacent (horizontal, vertical, or diagonal) if and only if:
$$\max(|r_1 - r_2|, |c_1 - c_2|) = 1$$

And a path of $N$ keyword cards $[C_0, C_1, \dots, C_{N-1}]$ is topologically valid on the board if:
1. $N \ge 4$ (minimum chain length rule).
2. All cells in the path are unique: $C_i \ne C_j \quad \forall i \ne j$.
3. Every consecutive pair is adjacent: $\text{ChebyshevDistance}(C_i, C_{i+1}) = 1 \quad \forall 0 \le i < N-1$.

### TypeScript Implementation Example

```typescript
export interface BoardCell {
  row: number; // 0..6
  col: number; // 0..6
  keywordId: string;
  name: string;
  domain: string;
}

export function isValidPhysicalChain(chain: BoardCell[]): { valid: boolean; error?: string } {
  if (chain.length < 4) {
    return { valid: false, error: "A valid chain must contain at least 4 keywords." };
  }

  // Check uniqueness of cells
  const visited = new Set<string>();
  for (const cell of chain) {
    const key = `${cell.row},${cell.col}`;
    if (visited.has(key)) {
      return { valid: false, error: `Duplicate cell visited at (${cell.row}, ${cell.col}).` };
    }
    visited.add(key);
  }

  // Check physical adjacency
  for (let i = 0; i < chain.length - 1; i++) {
    const curr = chain[i];
    const next = chain[i + 1];
    const rowDiff = Math.abs(curr.row - next.row);
    const colDiff = Math.abs(curr.col - next.col);

    if (Math.max(rowDiff, colDiff) !== 1) {
      return {
        valid: false,
        error: `Keywords "${curr.name}" and "${next.name}" do not touch horizontally or diagonally on the grid.`
      };
    }
  }

  return { valid: true };
}
```

---

## 2. Clinical Semantic Validation with AI

In the physical board game, the supervising instructor validated whether a student's narrative was medically sound. In a digital app, this can be automated using an LLM evaluator (e.g., Gemini 1.5 Flash / Pro):

### LLM Evaluation Prompt Template
```
You are a Board-Certified Endocrinologist and Medical School Professor acting as the judge for the medical board game "Diabe-teach".
A student submitted the following ordered sequence of medical terms and an explanation:

Sequence of Keywords:
${keywords.join(" -> ")}

Student's Clinical Explanation:
"${explanation}"

Evaluate this chain based on:
1. Pathophysiological, pharmacological, diagnostic, or clinical accuracy.
2. Continuity: Does each transition from term (i) to term (i+1) logically connect?
3. Plausibility: Is the narrative sound according to current clinical guidelines?

Return a JSON object:
{
  "isValid": true | false,
  "score": number (1 to 10),
  "detailedFeedback": "Explanation of clinical strengths or misconceptions",
  "recommendedRefinements": "How the student could improve or deepen the reasoning"
}
```

---

## 3. Game Modes

1. **Solo Practice Mode (Time Attack / Puzzle Mode):**
   - Learner gets a freshly shuffled 7×7 board.
   - Timer counts down 10 or 20 minutes.
   - Objective: Discover the longest chains, articulate explanations, receive instant AI feedback, and earn mastery points.
2. **Synchronous Multiplayer (Classroom / Peer Challenge):**
   - Room code lobby; all students in a cohort receive the **identical randomized board seed**.
   - Phase 1: 20 minutes simultaneous chain building.
   - Phase 2: Peer-review / AI verification.
   - Real-time leaderboard based on longest verified chain, total verified chains, and rationale quality score.
3. **Assessment Mode (Pretest $\to$ Game $\to$ Post-Test):**
   - Built-in replication of the study's RCT protocol: 10 pretest MCQs with *"I don't know"*, followed by the game module, then the 10 post-test MCQs and Likert feedback survey.

---

## 4. Key Metrics & Learning Analytics

The digital platform captures rich metacognitive analytics unavailable in the manual paper version:
- **Chain Diversity Index:** Does the student stay within safe pharmacology loops, or do they construct cross-disciplinary bridges connecting genetics $\to$ molecular signaling $\to$ public health screening?
- **Uncertainty Calibration:** Tracks the ratio of admitted unknowns vs. erroneous guesses over time.
- **Path Heatmaps:** Visualizes which cells on the 7×7 board are most frequently overlooked by students, flagging curriculum blindspots for faculty.
