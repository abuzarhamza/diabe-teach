import type { SessionSeat } from "../../api/session-seat-store.ts";
import type { PublicSessionState } from "../../api/sessions-api.ts";
import type { PhaseScreen } from "../../domain/session-phase.ts";
import { Link, useParams } from "react-router";
import { PHASE_STEP_COUNT, phaseScreen, roundViewKey } from "../../domain/session-phase.ts";
import { ErrorBanner } from "../shared/ErrorBanner.tsx";
import { useSessionState } from "./session-hooks.ts";
import { useSessionSeat } from "./use-session-seat.ts";
import { ComingSoonView } from "./views/ComingSoonView.tsx";
import { LobbyView } from "./views/LobbyView.tsx";

interface PhaseViewProps {
  screen: PhaseScreen;
  state: PublicSessionState;
  seat: SessionSeat;
}

// The view session-phase.ts picks for the phase. Views not built yet show a placeholder.
function PhaseView({ screen, state, seat }: PhaseViewProps) {
  switch (screen.view) {
    case "lobby":
      return <LobbyView state={state} seat={seat} />;
    default:
      return <ComingSoonView title={screen.title} />;
  }
}

function NotJoined() {
  return (
    <div className="wrap">
      <section className="panel login">
        <h2>You haven't joined this game</h2>
        <p className="note">This browser tab holds no seat for this Game Session.</p>
        <Link className="btn primary" to="/login">Join with a room code</Link>
      </section>
    </div>
  );
}

// /sessions/:sessionId: the single owner of the Game Session state. It polls the state every 2 seconds
// with this tab's seat (useSessionState) and renders the view for `state.currentPhase`, keyed by phase and
// round so each new phase or round starts its view afresh (no useEffect).
export function SessionShellPage() {
  const { sessionId = "" } = useParams();
  const seat = useSessionSeat(sessionId);
  const session = useSessionState(sessionId);

  if (!seat)
    return <NotJoined />;

  const state = session.data;
  if (!state) {
    return (
      <div className="wrap">
        {session.error
          ? <ErrorBanner error={session.error} />
          : <p className="note" role="status">Loading the game…</p>}
      </div>
    );
  }

  const screen = phaseScreen(state.currentPhase, seat.role);
  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1>
            Concept
            {" "}
            <span>Chain</span>
          </h1>
        </div>
        <span className="phase-pill" title={`Step ${screen.step} of ${PHASE_STEP_COUNT}`}>{screen.title}</span>
      </header>
      {/* A failed poll keeps the last state on screen and says why; the next poll may succeed. */}
      {session.error && <ErrorBanner error={session.error} />}
      <PhaseView key={roundViewKey(state.currentPhase, state.activeRoundNumber ?? null)} screen={screen} state={state} seat={seat} />
    </div>
  );
}
