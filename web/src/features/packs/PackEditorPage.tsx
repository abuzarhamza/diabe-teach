import type { ChangeEvent } from "react";
import type { CurriculumPackDetail } from "../../api/packs-api.ts";
import type { PackEditorField, PackEditorProblem, WordsAdded } from "../../domain/pack-editor.ts";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  addWords,
  MIN_PACK_WORDS,
  newPackProblem,
  nextVersion,
  packWords,
  wordCountNote,
  wordFileProblem,
  wordsAddedNote,
} from "../../domain/pack-editor.ts";
import { packCheckSummary, packRefusalIssues, packRefusalSentence } from "../../domain/pack-library.ts";
import { ErrorBanner } from "../shared/ErrorBanner.tsx";
import { useCheckPack, useFetchPack, usePack, usePackList, usePublishPack } from "./pack-hooks.ts";
import { PackIssueList } from "./PackIssueList.tsx";

// The prototype's learner level suggestions (setup.html, datalist "levels").
const LEVEL_SUGGESTIONS = [
  "Pre-clinical",
  "Year 1 undergraduate",
  "Year 2 undergraduate",
  "Clinical years",
  "Postgraduate",
  "Interprofessional",
];

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1
    ? ""
    : "s"}`;
}

// The Pack Editor (/packs/new): a new Curriculum Pack from pasted, uploaded or copied words.
export function PackEditorPage() {
  return <PackEditor base={null} />;
}

// Edit → save as new version (/packs/:packId/new-version): the Pack Editor prefilled from the pack's
// current version. The pack is read from the URL, so a reload gives the same prefill.
export function PackVersionEditorPage() {
  const { packId = "" } = useParams();
  const pack = usePack(packId);
  if (pack.data)
    return <PackEditor base={pack.data} />;
  return (
    <div className="wrap">
      {pack.isPending && <p className="note">Loading the pack…</p>}
      {pack.error && (
        <section className="panel">
          <Link className="btn" to="/packs">Back to the Pack Library</Link>
        </section>
      )}
      <ErrorBanner
        sentence={pack.error
          ? packRefusalSentence(pack.error)
          : null}
        error={pack.error}
      />
    </div>
  );
}

interface PackEditorProps {
  // The pack's current version, for a new Pack Version; null for a new pack.
  base: CurriculumPackDetail | null;
}

// The editor (look from the "New pack" panel of claudPoc/concept-chain/setup.html). Check pack dry-runs the
// server's validator; Publish registers the pack (or the new version) and opens its Pack Detail, handing it the
// validator's warnings.
function PackEditor(props: PackEditorProps) {
  // The version being edited stays as it was opened, even when a publish refetches the pack.
  const [base] = useState(props.base);
  const navigate = useNavigate();
  const publish = usePublishPack();
  const check = useCheckPack();
  const library = usePackList(false);
  const fetchPack = useFetchPack();
  const [fromId, setFromId] = useState("");
  const [pasted, setPasted] = useState("");
  const [words, setWords] = useState<string[]>(() => base
    ? packWords(base)
    : []);
  const [addedNote, setAddedNote] = useState("");
  const [name, setName] = useState(base?.title ?? "");
  const [level, setLevel] = useState("");
  const [objective, setObjective] = useState("");
  const [problem, setProblem] = useState<PackEditorProblem | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLUListElement>(null);
  const packs = library.data ?? [];
  // The pack "Copy its words" reads: the one picked, else the first in the library.
  const fromPackId = fromId || packs[0]?.id || "";

  // An edit makes the last Check pack result stale, so it is dropped.
  function edited() {
    check.reset();
  }

  function focusField(field: PackEditorField) {
    (field === "words"
      ? pasteRef
      : nameRef).current?.focus();
  }

  // Adds words to the list (blanks and repeats, ignoring case, are dropped) and says what happened.
  function add(input: string | readonly string[], source?: string): WordsAdded {
    const result = addWords(words, input);
    setWords(result.words);
    setAddedNote(wordsAddedNote(result, source));
    setProblem(null);
    edited();
    return result;
  }

  function handleAddPasted() {
    add(pasted);
    setPasted("");
  }

  // Reads a .txt or .csv file in the browser (nothing is uploaded) and adds its words.
  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file)
      return;
    const fileProblem = wordFileProblem(file);
    if (fileProblem) {
      setProblem({ sentence: fileProblem, field: "words" });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    }
    catch {
      setProblem({ sentence: `Couldn't read “${file.name}”.`, field: "words" });
      return;
    }
    add(text, file.name);
  }

  // Adds the chosen pack's card labels, and names the new pack after it if no name is given yet.
  function handleCopy() {
    if (!fromPackId)
      return;
    fetchPack.mutate(fromPackId, {
      onSuccess: (pack) => {
        add(packWords(pack), pack.title);
        if (!name.trim())
          setName(`${pack.title} (my copy)`);
      },
    });
  }

  // Removes one word, keeping focus in the list: on the next chip's button, else the previous one,
  // else the paste box. The chips are keyed by word, so the focused button survives the re-render.
  function handleRemove(index: number) {
    const buttons = chipsRef.current?.querySelectorAll("button") ?? [];
    (buttons[index + 1] ?? buttons[index - 1] ?? pasteRef.current)?.focus();
    const rest = words.filter((_, i) => i !== index);
    setWords(rest);
    edited();
    if (!rest.length)
      setAddedNote("");
  }

  function handleClear() {
    setWords([]);
    setAddedNote("");
    setProblem(null);
    edited();
  }

  // The client's checks (word count, name, word length), run before any request; a problem moves focus.
  function draftReady(): boolean {
    const found = newPackProblem({ name, words });
    setProblem(found);
    if (found)
      focusField(found.field);
    return !found;
  }

  function handleCheck() {
    if (draftReady()) {
      check.mutate({
        name,
        level,
        objective,
        words,
        base: base ?? undefined,
      });
    }
  }

  function handlePublish() {
    if (!draftReady())
      return;
    publish.mutate({
      name,
      level,
      objective,
      words,
      base: base ?? undefined,
    }, {
      // The warnings ride along in the location state, for Pack Detail to show.
      onSuccess: result => navigate(`/packs/${encodeURIComponent(result.packId)}`, {
        state: { publishWarnings: result.warnings },
      }),
    });
  }

  // Check pack and Publish wait for each other, so a double click sends one request.
  const busy = check.isPending || publish.isPending;
  const refusal = publish.error ?? check.error ?? fetchPack.error;
  // A 422 refusal's issues, else the last Check pack result.
  const issues = (publish.error && packRefusalIssues(publish.error)) ?? check.data ?? null;

  return (
    <div className="wrap">
      <section className="panel" aria-labelledby="pack-editor-heading">
        <div className="row between">
          <h2 id="pack-editor-heading">
            {base
              ? `Edit “${base.title}” → save as v${nextVersion(base.version)}`
              : "New pack"}
          </h2>
          <span className="eyebrow">Saved to the shared pack library</span>
        </div>
        <div className="editor">
          <div className="field">
            <label htmlFor="pack-from">Start from an existing pack</label>
            <div className="row">
              <select id="pack-from" value={fromPackId} onChange={event => setFromId(event.target.value)}>
                {packs.map(pack => <option key={pack.id} value={pack.id}>{pack.title}</option>)}
              </select>
              <button className="btn sm" type="button" disabled={!fromPackId || fetchPack.isPending} onClick={handleCopy}>Copy its words</button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="pack-paste">Paste words</label>
            <textarea
              id="pack-paste"
              ref={pasteRef}
              placeholder="One per line, or separated by commas"
              value={pasted}
              onChange={event => setPasted(event.target.value)}
            />
            <div className="row">
              <button className="btn sm" type="button" onClick={handleAddPasted}>Add pasted words</button>
              <input
                id="pack-file"
                className="visually-hidden"
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                onChange={(event) => {
                  void handleUpload(event);
                }}
              />
              <label className="btn sm" htmlFor="pack-file">Upload .txt or .csv…</label>
            </div>
          </div>
          <div className="field">
            <div className="row between">
              <span className="count">{plural(words.length, "word")}</span>
              <button className="btn sm" type="button" onClick={handleClear}>Clear all</button>
            </div>
            <ul ref={chipsRef} className="kwchips" aria-label="Words in the new pack" aria-describedby="pack-size-note">
              {words.map((word, i) => (
                <li key={word.toLowerCase()} className="chip">
                  <span>{word}</span>
                  <button type="button" aria-label={`Remove ${word}`} onClick={() => handleRemove(i)}>×</button>
                </li>
              ))}
            </ul>
            {!words.length && <p className="empty">No words yet. Paste, upload or copy from a pack.</p>}
            <p className="note" role="status" aria-live="polite" aria-label="Words added">{addedNote}</p>
            <p
              id="pack-size-note"
              className={words.length >= MIN_PACK_WORDS
                ? "ok"
                : "warn"}
            >
              {wordCountNote(words.length)}
            </p>
          </div>
          <div className="field">
            <label htmlFor="pack-name">Pack name</label>
            <input
              id="pack-name"
              ref={nameRef}
              type="text"
              maxLength={80}
              autoComplete="off"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                edited();
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="pack-level">
              Learner level
              {" "}
              <span className="opt">(optional)</span>
            </label>
            <input
              id="pack-level"
              type="text"
              list="pack-levels"
              maxLength={60}
              placeholder="e.g. Year 2 medicine"
              value={level}
              onChange={(event) => {
                setLevel(event.target.value);
                edited();
              }}
            />
            <datalist id="pack-levels">
              {LEVEL_SUGGESTIONS.map(suggestion => <option key={suggestion} value={suggestion} />)}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="pack-objective">
              Learning objective
              {" "}
              <span className="opt">(optional)</span>
            </label>
            <textarea
              id="pack-objective"
              maxLength={300}
              placeholder="e.g. Explain how insulin resistance leads to type 2 diabetes complications"
              value={objective}
              onChange={(event) => {
                setObjective(event.target.value);
                edited();
              }}
            />
          </div>
          {problem && <p className="err" role="alert">{problem.sentence}</p>}
          <div className="row">
            <button className="btn" type="button" disabled={busy} onClick={handleCheck}>Check pack</button>
            <button className="btn primary" type="button" disabled={busy} onClick={handlePublish}>Publish</button>
            <Link className="btn" to="/packs">Cancel</Link>
          </div>
        </div>
        <ErrorBanner
          sentence={refusal
            ? packRefusalSentence(refusal)
            : null}
          error={refusal}
          alert
        />
        {issues && (
          <section className="check-results" aria-labelledby="pack-check-heading">
            <h3 id="pack-check-heading">Pack check</h3>
            {/* A Check pack result says whether it can be published; a 422 refusal already said so above. */}
            {check.data === issues && (
              <p
                className={issues.errors.length
                  ? "err"
                  : "ok"}
                role={issues.errors.length
                  ? "alert"
                  : "status"}
              >
                {packCheckSummary(issues)}
              </p>
            )}
            <PackIssueList label="Errors" issues={issues.errors} tone="err" />
            <PackIssueList label="Warnings" issues={issues.warnings} tone="warn" />
          </section>
        )}
      </section>
    </div>
  );
}
