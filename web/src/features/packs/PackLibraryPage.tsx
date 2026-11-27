import type { CurriculumPackListItem } from "../../api/packs-api.ts";
import { useId, useState } from "react";
import { Link } from "react-router";
import { packByline, packRefusalSentence } from "../../domain/pack-library.ts";
import { ErrorBanner } from "../shared/ErrorBanner.tsx";
import { useArchivePack, usePackList, useUnarchivePack } from "./pack-hooks.ts";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1
    ? ""
    : "s"}`;
}

interface PackCardProps {
  pack: CurriculumPackListItem;
  // An archive or unarchive is being sent: the controls wait for it.
  busy: boolean;
  onArchive: (pack: CurriculumPackListItem) => void;
  onUnarchive: (pack: CurriculumPackListItem) => void;
}

// One pack of the library (look from the pack panel of claudPoc/concept-chain/setup.html).
// System Packs get no Archive or Unarchive control (the server refuses them with 403 PACK_IS_SYSTEM_PACK);
// an archived pack can't start a game until it is unarchived.
function PackCard({ pack, busy, onArchive, onUnarchive }: PackCardProps) {
  const titleId = useId();
  return (
    <li
      className={pack.isArchived
        ? "packitem archived"
        : "packitem"}
      aria-labelledby={titleId}
    >
      <div className="pack">
        <span>
          <span className="nm">
            <Link id={titleId} to={`/packs/${encodeURIComponent(pack.id)}`}>{pack.title}</Link>
            {pack.isSystemPack && <span className="tag">System Pack</span>}
            {pack.isArchived && <span className="tag">Archived</span>}
          </span>
          <span className="by">{packByline(pack)}</span>
          <span className="by">{`${plural(pack.cardCount, "card")} · ${pack.subjectDomain}`}</span>
        </span>
      </div>
      <div className="acts">
        {!pack.isArchived && (
          <Link className="btn sm primary" to={`/setup?packId=${encodeURIComponent(pack.id)}`} aria-label={`Start Game with Pack ${pack.title}`}>
            Start Game with Pack
          </Link>
        )}
        {!pack.isSystemPack && (pack.isArchived
          ? (
              <button className="btn sm" type="button" disabled={busy} aria-label={`Unarchive pack ${pack.title}`} onClick={() => onUnarchive(pack)}>
                Unarchive
              </button>
            )
          : (
              <button className="btn sm bad" type="button" disabled={busy} aria-label={`Archive pack ${pack.title}`} onClick={() => onArchive(pack)}>
                Archive
              </button>
            ))}
      </div>
    </li>
  );
}

// The Pack Library (/packs): the shared library's Curriculum Packs.
export function PackLibraryPage() {
  const [showArchived, setShowArchived] = useState(false);
  const packs = usePackList(showArchived);
  const archive = useArchivePack();
  const unarchive = useUnarchivePack();
  // The refusal to explain: from the list, or from the last archive / unarchive (each clears the other's).
  const error = packs.error ?? archive.error ?? unarchive.error;

  function handleArchive(pack: CurriculumPackListItem) {
    unarchive.reset();
    archive.mutate(pack.id);
  }

  function handleUnarchive(pack: CurriculumPackListItem) {
    archive.reset();
    unarchive.mutate(pack.id);
  }

  return (
    <div className="wrap">
      <section className="panel" aria-labelledby="pack-library-heading">
        <div className="row between">
          <h2 id="pack-library-heading">Pack Library</h2>
          <Link className="btn sm primary" to="/packs/new">New pack</Link>
        </div>
        <label className="archtoggle">
          <input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />
          {" "}
          Show archived
        </label>
        {packs.isPending && <p className="note">Loading the pack library…</p>}
        {packs.data && (
          <ul className="packs" aria-label="Curriculum Packs">
            {packs.data.map(pack => (
              <PackCard
                key={pack.id}
                pack={pack}
                busy={archive.isPending || unarchive.isPending}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
              />
            ))}
          </ul>
        )}
        {packs.data?.length === 0 && <p className="empty">No packs yet.</p>}
        <ErrorBanner
          sentence={error
            ? packRefusalSentence(error)
            : null}
          error={error}
        />
      </section>
    </div>
  );
}
