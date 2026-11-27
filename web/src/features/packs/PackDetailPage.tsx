import type { ReactNode } from "react";
import type { CurriculumPackDetail, KeywordCard } from "../../api/packs-api.ts";
import { useId } from "react";
import { Link, useLocation, useParams } from "react-router";
import { boardSummary, packRefusalSentence, publishWarningsFrom } from "../../domain/pack-library.ts";
import { ErrorBanner } from "../shared/ErrorBanner.tsx";
import { usePack } from "./pack-hooks.ts";
import { PackIssueList } from "./PackIssueList.tsx";

interface PackSectionProps {
  title: string;
  children: ReactNode;
}

// A titled part of the pack: a region named by its heading.
function PackSection({ title, children }: PackSectionProps) {
  const headingId = useId();
  return (
    <section className="panel" aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      {children}
    </section>
  );
}

function cardLabel(cards: KeywordCard[], cardId: string): string {
  return cards.find(card => card.id === cardId)?.displayLabel ?? cardId;
}

interface PackContentProps {
  pack: CurriculumPackDetail;
}

function KeywordCards({ pack }: PackContentProps) {
  return (
    <>
      {pack.domains.map((domain) => {
        const cards = pack.cards.filter(card => card.domainId === domain.id);
        return (
          <div key={domain.id} className="card-group">
            <h4>{`${domain.label} (${cards.length})`}</h4>
            <ul className="cards-list">
              {cards.map(card => (
                <li key={card.id}>
                  <b>{card.displayLabel}</b>
                  {card.verbatimLabel !== card.displayLabel && <span className="by">{card.verbatimLabel}</span>}
                  <span>{card.summary}</span>
                  {card.aliases.length > 0 && <span className="by">{`Also: ${card.aliases.join(", ")}`}</span>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

function AdjudicationRubric({ pack }: PackContentProps) {
  const rubric = pack.adjudicationRubric;
  return (
    <>
      <dl className="facts">
        <dt>Evaluator</dt>
        <dd>{rubric.evaluatorPersona}</dd>
        <dt>Subject</dt>
        <dd>{rubric.subjectDomain}</dd>
      </dl>
      <h4>Chain continuity criteria</h4>
      <ul>
        {rubric.chainContinuityCriteria.map(criterion => <li key={criterion}>{criterion}</li>)}
      </ul>
      <h4>Calibration examples</h4>
      {rubric.calibrationExamples.length === 0
        ? <p className="empty">No calibration examples.</p>
        : (
            <ul className="cards-list">
              {rubric.calibrationExamples.map(example => (
                <li key={example.id}>
                  <b>{example.title}</b>
                  <span className={example.isValid
                    ? "tag good"
                    : "tag bad"}
                  >
                    {example.isValid
                      ? "Valid"
                      : "Not valid"}
                  </span>
                  <span>{example.keywordIds.map(id => cardLabel(pack.cards, id)).join(" → ")}</span>
                  <span className="by">{example.narrativeExplanation}</span>
                </li>
              ))}
            </ul>
          )}
    </>
  );
}

function PackContent({ pack }: PackContentProps) {
  const questions = pack.assessmentInstrument?.questions ?? null;
  const surveyItems = pack.perceptionSurvey?.items ?? null;
  return (
    <>
      <section className="panel" aria-labelledby="pack-detail-heading">
        <div className="row between">
          <h2 id="pack-detail-heading">{pack.title}</h2>
          <span className="eyebrow">
            {`v${pack.version}`}
            {pack.isSystemPack && <span className="tag">System Pack</span>}
          </span>
        </div>
        <p>{pack.description}</p>
        <div className="row">
          <Link className="btn primary" to={`/setup?packId=${encodeURIComponent(pack.id)}`} aria-label={`Start Game with Pack ${pack.title}`}>
            Start Game with Pack
          </Link>
          {/* System Packs can't be given new versions (403 PACK_IS_SYSTEM_PACK), so the action is hidden. */}
          {!pack.isSystemPack && (
            <Link className="btn" to={`/packs/${encodeURIComponent(pack.id)}/new-version`}>Edit → save as new version</Link>
          )}
          <Link className="btn" to="/packs">Back to the Pack Library</Link>
        </div>
      </section>
      <PackSection title="Board">
        <p>{boardSummary(pack.boardConfig)}</p>
      </PackSection>
      <PackSection title="Semantic Domains">
        <dl className="facts">
          {pack.domains.map(domain => [
            <dt key={`${domain.id}-label`}>{domain.label}</dt>,
            <dd key={`${domain.id}-description`}>{domain.description}</dd>,
          ])}
        </dl>
      </PackSection>
      <PackSection title="Keyword Cards">
        <KeywordCards pack={pack} />
      </PackSection>
      <PackSection title="Adjudication Rubric">
        <AdjudicationRubric pack={pack} />
      </PackSection>
      <PackSection title="Assessment questions">
        {questions === null
          ? <p className="empty">This pack has no assessment questions.</p>
          : (
              <ol>
                {questions.map(question => (
                  <li key={question.id}>
                    <p>
                      {question.stem}
                      <span className="tag">{`Bloom level ${question.bloomLevel}`}</span>
                    </p>
                    <ol type="A">
                      {question.options.map(option => <li key={option}>{option}</li>)}
                    </ol>
                  </li>
                ))}
              </ol>
            )}
      </PackSection>
      <PackSection title="Survey items">
        {surveyItems === null
          ? <p className="empty">This pack has no perception survey.</p>
          : (
              <ol>
                {surveyItems.map(item => <li key={item.id}>{item.prompt}</li>)}
              </ol>
            )}
      </PackSection>
    </>
  );
}

// Pack Detail (/packs/:packId): everything in one Curriculum Pack, read-only. Arriving from the Pack
// Editor's Publish, it also lists the validator's warnings (handed over in the location state).
export function PackDetailPage() {
  const { packId = "" } = useParams();
  const pack = usePack(packId);
  const publishWarnings = publishWarningsFrom(useLocation().state);

  return (
    <div className="wrap">
      {publishWarnings.length > 0 && (
        <PackSection title="Published with warnings">
          <p className="note">Warnings never block publishing; the pack is in the library.</p>
          <PackIssueList label="Warnings" issues={publishWarnings} tone="warn" />
        </PackSection>
      )}
      {pack.isPending && <p className="note">Loading the pack…</p>}
      {pack.data && <PackContent pack={pack.data} />}
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
