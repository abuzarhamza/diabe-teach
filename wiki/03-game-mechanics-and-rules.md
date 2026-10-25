# 03 - Game Mechanics & Rules

## Game Overview

**Diabe-teach** is a serious tabletop educational game designed to stimulate higher-order cognitive processing (Bloom's Taxonomy Levels 2 & 3: Comprehension, Association, and Clinical Application). 

Rather than prompting players with pre-fabricated questions, Diabe-teach forces students to **discover and construct relationships** across clinical endocrinology concepts laid out on a grid.

---

## Equipment & Setup

1. **Card Deck:** Exactly 49 printed keyword cards (A4 paper cuts) representing foundational diabetes mellitus concepts (see [04 - The 49 Keywords](04-the-49-keywords-and-clinical-domains.md)).
2. **Board Configuration:** A **7×7 square matrix** (49 positions total).
3. **Player Materials:** Each participant or team receives paper and a pen to write down chains and draft their clinical explanations.
4. **Setup Procedure:**
   - The instructor thoroughly shuffles all 49 cards before each round.
   - Cards are placed face-up in a $7 \times 7$ grid layout on a large table.
   - No card is repeated; every cell on the board contains one distinct keyword.

---

## Rules of Play

### 1. Minimum Chain Length
- Each proposed chain must connect **at least 4 cards** ($\ge 4$ keywords).

### 2. Physical Adjacency Rule
- Each sequential keyword in the chain must **physically touch** the previous keyword on the grid.
- **Allowed connections:**
  - **Horizontal:** Adjacent cells in the same row ($\text{cell}_{x, y} \leftrightarrow \text{cell}_{x \pm 1, y}$).
  - **Diagonal:** Diagonally touching cells ($\text{cell}_{x, y} \leftrightarrow \text{cell}_{x \pm 1, y \pm 1}$).
  - *(Vertical connections are naturally aligned with adjacent grid rules).*
- **Disallowed:** Leaping across non-touching cells or disconnected grid locations.

### 3. Pathophysiological / Clinical Validity Rule
- Merely touching adjacent cards is insufficient. 
- For every transition in the chain ($A \to B \to C \to D$), the player must articulate a legitimate, medically sound rationale explaining how $A$ leads to, interacts with, diagnoses, treats, or complicates $B$, and so on.

---

## Illustrated Chain Examples (From the Study Publication)

Below are three examples featured in Figure 2 of the publication:

```
[Row 1] Retinopathy   Pancreas       Ulcer         Sulfonylureas  Metformin     Beta cells   Diet
[Row 2] Autoimmune    Glycemic Index Hypoglycemia  Weight loss    Adiponectin   Glucose      Hyperglycemia
[Row 3] Islet Cells   Transplant     HHS           Amylin         Thiazolidine  Podiatrist   Polyphagia
[Row 4] ACE Inhibitors Screening     Microalbumin  Smoking        Genetic       Fasting      GTT
[Row 5] Glucagon      Neuropathy     Dyslipidemia  Insulin        Weight        Polyuria     Glucometer
[Row 6] Polydipsia    Gastroparesis  C-Peptide     Venous         Ketoacidosis  Glucosuria   Hypertension
[Row 7] MODY          Lipohypertrophy Children     Pregnancy      LADA          Glipizide    HbA1c
```

### ✅ Example Valid Chain A (9 Keywords)
> **Chain:** `Genetics` $\to$ `Smoking` $\to$ `Weight` $\to$ `Insulin` $\to$ `Microalbuminuria` $\to$ `Screening` $\to$ `Neuropathy` $\to$ `Gastroparesis` $\to$ `Lipohypertrophy`

- **Clinical Rationale:**
  - `Genetics` and `Smoking` combined with excess `Weight` contribute to `Insulin` resistance.
  - Long-standing poorly managed insulin dynamics cause end-organ damage such as `Microalbuminuria`.
  - Regular `Screening` is essential in diabetic patients, or they risk developing chronic complications like diabetic `Neuropathy` and autonomic dysfunction like `Gastroparesis`.
  - Insulin injection routines require rotation to avoid localized complication of `Lipohypertrophy`.
- **Verdict:** **VALID** (All 9 cards are contiguous/touching horizontally or diagonally, and logical medical narrative is substantiated).

---

### ✅ Example Valid Chain B (7 Keywords)
> **Chain:** `Polyphagia` $\to$ `Hyperglycemia` $\to$ `Beta cells` $\to$ `Glucose` $\to$ `Metformin` $\to$ `Sulfonylureas` $\to$ `Weight loss`

- **Clinical Rationale:**
  - Classic symptoms of uncontrolled diabetes include `Polyphagia` stemming from cellular starvation amidst severe `Hyperglycemia`.
  - This results from progressive dysfunction or destruction of pancreatic `Beta cells` failing to regulate circulating blood `Glucose`.
  - First-line oral therapy begins with insulin-sensitizing agents like `Metformin`, often complemented by insulin secretagogues such as `Sulfonylureas`, alongside lifestyle modifications aimed at `Weight loss`.
- **Verdict:** **VALID** (All 7 cards touch consecutively and clinical mechanism is sound).

---

### ❌ Example Invalid Chain C
> **Chain:** `Autoimmune` $\to$ `Islet cells` $\to$ `Pancreas` $\to$ `Retinopathy`

- **Attempted Rationale:** Autoimmune destruction of islet cells in the pancreas causes diabetes, which has complications like retinopathy.
- **Why it is INVALID:** While the clinical statement is medically accurate, on this board layout, the card for `Pancreas` did not physically touch the card for `Islet cells`. Because adjacency was broken, the chain was disqualified.

---

## Scoring & Determining the Winner

1. **Chain Length Ranking:**
   - The participant/team with the **longest verified valid chain** in that round is declared the winner.
2. **Tie-Breaker Rule:**
   - In the event of a tie in length (e.g., two players each create an 8-card chain), the tie is broken by the player who formulated the **greatest total number of distinct valid chains**.
3. **Consensus & Instructor Adjudication:**
   - Chains are presented aloud to the team/peers.
   - If peers or competitors question the validity of a clinical connection, peer discussion ensues.
   - The supervising instructor/faculty member acts as the supreme clinical arbiter whose ruling is final.
