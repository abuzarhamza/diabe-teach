import type { SessionSeat } from "../../../api/session-seat-store.ts";
import type { PublicSessionState, SessionParticipantView } from "../../../api/sessions-api.ts";

interface LobbyViewProps {
  state: PublicSessionState;
  seat: SessionSeat;
}

const MODE_LABEL: Record<PublicSessionState["mode"], string> = {
  "classroom": "Classroom game · 2 rounds",
  "solo": "Solo practice · 2 rounds",
  "study-rct": "Study game · 2 rounds",
};

const REVIEW_LABEL: Record<PublicSessionState["adjudicationMode"], string> = {
  "peer-instructor": "Class votes + teacher's final say",
  "ai": "AI review",
  "hybrid": "AI review + teacher's final say",
};

// The prototype's avatar colours (claudPoc/concept-chain/lobby.html), one per learner, from the participantId.
const AVATAR_COLORS = [
  "#0B7A6A",
  "#3D5BD9",
  "#B4489B",
  "#C2620C",
  "#5B7F12",
  "#1F7FA8",
  "#8A4FD0",
  "#B42318",
];

function avatarColor(participantId: string): string {
  const hash = [...participantId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

function rosterName(learner: SessionParticipantView, seat: SessionSeat): string {
  if (learner.leftAt !== null)
    return `${learner.displayName} (left)`;
  return learner.participantId === seat.participantId
    ? `${learner.displayName} (you)`
    : learner.displayName;
}

// The Lobby (look from claudPoc/concept-chain/lobby.html): the room code, the live roster from the polled
// `state.participants` (active while `leftAt` is null, departed otherwise) and the session settings.
export function LobbyView({ state, seat }: LobbyViewProps) {
  const me = state.participants.find(p => p.participantId === seat.participantId) ?? null;
  const heading = seat.role === "participant"
    ? `You're in, ${me?.displayName ?? seat.displayName ?? "learner"}!`
    : "Your game is open";
  // The learner first, then everyone else in join order.
  const roster = me
    ? [
        me,
        ...state.participants.filter(p => p !== me),
      ]
    : state.participants;

  return (
    <>
      <section className="panel hero" aria-live="polite">
        {me && (
          <div
            className="avatar big"
            aria-hidden="true"
            style={{
              background: avatarColor(me.participantId),
            }}
          >
            {initial(me.displayName)}
          </div>
        )}
        <div>
          <h2>{heading}</h2>
          <p className="wait">
            <span className="pulse" aria-hidden="true"></span>
            <span>
              {seat.role === "participant"
                ? "Waiting for your teacher to start…"
                : "Share the room code with your class."}
            </span>
          </p>
        </div>
        <div className="room">
          <span className="eyebrow">Room code</span>
          <span className="code">{state.roomCode}</span>
        </div>
      </section>

      <div className="grid2">
        <section className="panel">
          <div className="row between">
            <h2 id="roster-heading">In the room</h2>
            <span className="eyebrow">{`${state.participantCount} in the room`}</span>
          </div>
          <ul className="people" aria-labelledby="roster-heading">
            {roster.map(learner => (
              <li
                key={learner.participantId}
                className={[
                  learner === me
                    ? "me"
                    : "",
                  learner.leftAt === null
                    ? ""
                    : "left",
                ].join(" ").trim() || undefined}
              >
                <span
                  className="avatar"
                  aria-hidden="true"
                  style={{
                    background: avatarColor(learner.participantId),
                  }}
                >
                  {initial(learner.displayName)}
                </span>
                {rosterName(learner, seat)}
              </li>
            ))}
            {roster.length <= 1 && <li className="note waiting">Waiting for classmates to join…</li>}
          </ul>
        </section>

        <section className="panel">
          <h2>Today's session</h2>
          <dl className="facts">
            <dt>Pack</dt>
            <dd>
              {state.packVersion
                ? `${state.packId} · v${state.packVersion}`
                : state.packId}
            </dd>
            <dt>Format</dt>
            <dd>{MODE_LABEL[state.mode]}</dd>
            <dt>Review</dt>
            <dd>{REVIEW_LABEL[state.adjudicationMode]}</dd>
          </dl>
        </section>
      </div>

      <p className="note">Keep this tab open. The game screen opens by itself when your teacher starts.</p>
    </>
  );
}
