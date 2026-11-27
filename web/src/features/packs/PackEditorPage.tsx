import type { PackEditorField, PackEditorProblem } from "../../domain/pack-editor.ts";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { cleanWords, newPackProblem } from "../../domain/pack-editor.ts";
import { packRefusalSentence } from "../../domain/pack-library.ts";
import { ErrorBanner } from "../shared/ErrorBanner.tsx";
import { usePublishPack } from "./pack-hooks.ts";

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

// The Pack Editor (/packs/new): a new Curriculum Pack from pasted words (look from the "New pack" panel
// of claudPoc/concept-chain/setup.html). Publish registers it and opens its Pack Detail.
export function PackEditorPage() {
  const navigate = useNavigate();
  const publish = usePublishPack();
  const [pasted, setPasted] = useState("");
  const [words, setWords] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [objective, setObjective] = useState("");
  const [problem, setProblem] = useState<PackEditorProblem | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  function focusField(field: PackEditorField) {
    (field === "words"
      ? pasteRef
      : nameRef).current?.focus();
  }

  // Adds the pasted words to the list; blanks and repeats (ignoring case) are dropped.
  function handleAddPasted() {
    setWords(cleanWords([
      ...words,
      ...cleanWords(pasted).words,
    ]).words);
    setPasted("");
    setProblem(null);
  }

  function handlePublish() {
    const found = newPackProblem({ name, words });
    setProblem(found);
    if (found) {
      focusField(found.field);
      return;
    }
    publish.mutate({ name, level, objective, words }, {
      onSuccess: result => navigate(`/packs/${encodeURIComponent(result.packId)}`),
    });
  }

  return (
    <div className="wrap">
      <section className="panel" aria-labelledby="pack-editor-heading">
        <div className="row between">
          <h2 id="pack-editor-heading">New pack</h2>
          <span className="eyebrow">Saved to the shared pack library</span>
        </div>
        <div className="editor">
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
            </div>
          </div>
          <div className="field">
            <span className="count">{plural(words.length, "word")}</span>
            <ul className="kwchips" aria-label="Words in the new pack">
              {words.map(word => <li key={word.toLowerCase()} className="chip"><span>{word}</span></li>)}
            </ul>
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
              onChange={event => setName(event.target.value)}
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
              onChange={event => setLevel(event.target.value)}
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
              onChange={event => setObjective(event.target.value)}
            />
          </div>
          {problem && <p className="err" role="alert">{problem.sentence}</p>}
          <div className="row">
            <button className="btn primary" type="button" disabled={publish.isPending} onClick={handlePublish}>Publish</button>
            <Link className="btn" to="/packs">Cancel</Link>
          </div>
        </div>
        <ErrorBanner
          sentence={publish.error
            ? packRefusalSentence(publish.error)
            : null}
          error={publish.error}
        />
      </section>
    </div>
  );
}
