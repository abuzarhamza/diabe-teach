# Concept-Chain Educational Game Engine

A reusable, subject-agnostic educational board game platform where learners build and justify chains of adjacent concepts on a grid, with **Diabe-teach** (Diabetes Mellitus) as the inaugural curriculum pack.

## Language

### Curriculum & Content

**Curriculum Pack**:
A self-contained, subject-specific bundle of educational content—including Keyword Cards, Semantic Domains, an Adjudication Rubric, Calibration Examples, and optional assessment/survey instruments—that configures the engine to run a game for a given discipline.
_Avoid_: Deck, course, topic pack, cartridge, game

**Keyword Card**:
A single concept item within a Curriculum Pack that occupies one cell on the board grid and carries a canonical label, aliases, a Semantic Domain, and a reference definition.
_Avoid_: Tile, flashcard, node, token

**Semantic Domain**:
A subject-specific thematic grouping of Keyword Cards within a Curriculum Pack used for curriculum balance and cross-concept diversity analytics.
_Avoid_: Category, cluster, tag, bucket

**Adjudication Rubric**:
The subject-specific persona, domain description, continuity criteria, and Calibration Examples embedded in a Curriculum Pack that govern how a Narrative Adjudicator evaluates proposed Concept Chains.
_Avoid_: Prompt template, grading rules, judge config

**Calibration Example**:
A canonical valid or invalid Concept Chain paired with a fixed board arrangement and reference rationale inside a Curriculum Pack, used both for the learner's Trial Round orientation and as a few-shot reference for automated adjudication.
_Avoid_: Sample chain, fixture, demo path

### Gameplay & Reasoning

**Game Session**:
A bounded instance of play configured with a Curriculum Pack, a session mode (Solo Practice, Classroom Game, or Study RCT), an adjudication mode, a participant roster, and an ordered sequence of timed phases.
_Avoid_: Room, match, lobby, study

**Gameplay Round**:
A timed cycle within a Game Session starting with a freshly shuffled board grid, split into a Chain-Mapping phase (where learners discover and record Concept Chains) and a Peer-Adjudication phase (where chains are presented, challenged, and ruled valid or invalid).
_Avoid_: Turn, level, stage

**Concept Chain**:
An ordered sequence of physically adjacent Keyword Cards on the board paired with a learner's narrative explanation justifying every transition from one card to the next.
_Avoid_: Word chain, path, sequence, combo, link

**Narrative Adjudicator**:
The authority (human peer consensus, supervising instructor override, or AI specialist) that evaluates whether a topologically valid Concept Chain has a sound, continuous narrative connecting each consecutive Keyword Card.
_Avoid_: Clinical validator, grader, answer checker

**Instructor Final Ruling**:
An authoritative approval or rejection issued by the supervising instructor during a Gameplay Round that permanently locks a Concept Chain's adjudication verdict against subsequent peer votes or automated re-evaluation.
_Avoid_: Admin override, moderator lock, teacher grade

**Capability Token**:
A stateless, session-scoped bearer token encoding a caller's verified role (`instructor` or `participant`) and session identity without requiring a persistent user account.
_Avoid_: JWT session cookie, API key, user login token

### Assessment & Metacognition

**Assessment Attempt**:
A learner's completed set of responses to a Curriculum Pack's multiple-choice instrument (either at the Pretest or Posttest stage), where each item is answered with a candidate option or an explicit *"I don't know"* declaration.
_Avoid_: Quiz submission, test score, exam

**Uncertainty Calibration**:
The metacognitive measure of how reliably a learner recognizes their own knowledge gaps by selecting *"I don't know"* rather than making an incorrect guess when uncertain.
_Avoid_: Confidence score, guessing rate

**Chain Diversity Index**:
A measure of how broadly a learner's approved Concept Chains bridge distinct Semantic Domains rather than remaining confined within a single thematic cluster.
_Avoid_: Variety score, category spread

**Board Neglect Heatmap**:
A grid-coordinate frequency matrix identifying which Keyword Cards and board positions were overlooked by learners across Gameplay Rounds to surface curriculum blind spots.
_Avoid_: Click map, unused card list
