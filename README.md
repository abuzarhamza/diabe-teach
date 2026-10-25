# Diabe-Teach

> An evidence-based educational serious game designed to enhance medical undergraduates' knowledge, comprehension, and metacognitive clinical reasoning in diabetes mellitus.

This project is built directly on the randomized controlled trial (RCT) research published in *BMC Medical Education* (2025):

**"Diabe-teach: a randomized controlled trial of a gamified approach to enhance medical undergraduates’ knowledge and comprehension of diabetes mellitus"**  
*Mariam Shadan, Heba Ismail, and Fathima Hana Mohamed Naushad*  
DOI: [10.1186/s12909-024-06602-9](https://doi.org/10.1186/s12909-024-06602-9) | PMCID: [PMC11697910](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11697910/)

---

## 📄 Source Papers & Artifacts

- **Full Publication PDF:** [`papers/diabe-teach.pdf`](papers/diabe-teach.pdf)
- **Supplementary Material (Appendices 1 & 2):** [`papers/supplementary_material_1.docx`](papers/supplementary_material_1.docx)

---

## 📖 Comprehensive Project Wiki

A comprehensive wiki converting the entire publication into structured, actionable documentation has been created in the [`wiki/`](wiki/index.md) directory:

1. **[Paper Overview & Executive Summary](wiki/01-paper-overview.md)**  
   Citation metadata, abstract breakdown, objectives, key trial findings, and significance.
2. **[Study Methodology & RCT Design](wiki/02-study-methodology-and-rct-design.md)**  
   Ethical approvals, inclusion/exclusion criteria, power calculation, randomization, and the 2-hour session timeline.
3. **[Game Mechanics & Rules](wiki/03-game-mechanics-and-rules.md)**  
   7×7 grid layout, minimum 4-card chain rule, Chebyshev adjacency (horizontal/diagonal), valid vs invalid chain criteria, scoring, and adjudication.
4. **[The 49 Keywords & Clinical Domains](wiki/04-the-49-keywords-and-clinical-domains.md)**  
   Full catalog of all 49 medical keywords from Appendix 1, definitions, clinical relevance, and 7-domain semantic clustering.
5. **[Results & Statistical Analysis](wiki/05-results-and-statistical-analysis.md)**  
   Pretest vs post-test data, Table 1 & Table 2 t-test statistics, and the crucial metacognitive finding ("I don't know" vs blind guessing error reduction).
6. **[Discussion & Comparative Analysis](wiki/06-discussion-and-comparative-analysis.md)**  
   Pedagogical comparison of Diabe-teach vs trivia games (*Candyland*) and escape rooms, constructivist learning mechanisms, and study limitations.
7. **[Digital Implementation Architecture](wiki/07-digital-implementation-architecture.md)**  
   Full software engineering architecture: 2D adjacency algorithms, LLM clinical reasoning validation prompt, game modes, and analytics engine.

---

## 🎮 How the Board Game Operates (Summary)

```
+-------------------------------------------------------------------------------+
|                                7 x 7 GRID BOARD                               |
| [ Retinopathy ] [  Pancreas  ] [    Ulcer   ] [Sulfonylureas] [  Metformin  ] |
| [ Autoimmune  ] [Glycemic Ind] [Hypoglycemia] [ Weight loss ] [ Adiponectin ] |
| [ Islet Cells ] [ Transplant ] [     HHS    ] [   Amylin    ] [Thiazolidined] |
| [ACE Inhibitor] [ Screening  ] [Microalbumin] [   Smoking   ] [   Genetic   ] |
| [  Glucagon   ] [ Neuropathy ] [Dyslipidemia] [   Insulin   ] [   Weight    ] |
| [ Polydipsia  ] [Gastroparesi] [  C-Peptide ] [   Venous    ] [Ketoacidosis ] |
| [    MODY     ] [Lipohypertro] [  Children  ] [  Pregnancy  ] [    LADA     ] |
+-------------------------------------------------------------------------------+
```

- **Objective:** Find sequences of $\ge 4$ connected cards touching horizontally or diagonally.
- **Requirement:** Explain and justify the medical and pathophysiological reasoning connecting every keyword in the chain.
- **Winning:** The player with the longest valid clinical chain (or highest count of valid chains in ties) wins the round.
