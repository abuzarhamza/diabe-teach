import type { FormEvent } from "react";
import type { JoinField, JoinProblem } from "../../domain/join-session.ts";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { joinProblem, MAX_DISPLAY_NAME_LENGTH, ROOM_CODE_LENGTH } from "../../domain/join-session.ts";
import { ErrorBanner } from "../shared/ErrorBanner.tsx";
import { useJoinSession } from "./session-hooks.ts";

// The learner's Quick Join (claudPoc/concept-chain/participant.html join form), shown on /login:
// room code and name, then the Session Shell of the joined game. Learners need no account.
export function JoinSessionForm() {
  const navigate = useNavigate();
  const roomCodeRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  // A refusal found before anything is sent; server refusals come from the mutation.
  const [localProblem, setLocalProblem] = useState<JoinProblem | null>(null);

  function focusField(field: JoinField) {
    (field === "roomCode"
      ? roomCodeRef
      : displayNameRef).current?.focus();
  }

  const join = useJoinSession({
    onSuccess: ({ seat }) => navigate(`/sessions/${encodeURIComponent(seat.sessionId)}`),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const roomCode = String(data.get("roomCode") ?? "");
    const displayName = String(data.get("displayName") ?? "");
    const problem = joinProblem(roomCode, displayName);
    setLocalProblem(problem);
    join.reset();
    if (problem) {
      focusField(problem.field);
      return;
    }
    join.mutate({ roomCode, displayName });
  }

  return (
    <form className="col" aria-label="Join a game" noValidate onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="room-code">Room code</label>
        <input ref={roomCodeRef} className="code-input" type="text" id="room-code" name="roomCode" maxLength={ROOM_CODE_LENGTH} autoComplete="off" required placeholder="e.g. K7Q2MX" />
      </div>
      <div className="field">
        <label htmlFor="display-name">Your name</label>
        <input ref={displayNameRef} type="text" id="display-name" name="displayName" maxLength={MAX_DISPLAY_NAME_LENGTH} autoComplete="nickname" required placeholder="Shown to your class" />
      </div>
      <button className="btn primary" type="submit" disabled={join.isPending}>Join</button>
      <ErrorBanner sentence={localProblem?.sentence} error={localProblem ? null : join.error} />
    </form>
  );
}
