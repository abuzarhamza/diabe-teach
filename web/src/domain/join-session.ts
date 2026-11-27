// The learner's Quick Join form (react-web-ui 02): what is refused before anything is sent.
// Pure rules: no React, no fetch, no storage.

// docs: the server deals 6-character room codes (src/domain/game-session/room-code.ts).
export const ROOM_CODE_LENGTH = 6;
// The prototype's learner name limit (claudPoc/concept-chain/participant.html).
export const MAX_DISPLAY_NAME_LENGTH = 40;

export const MISSING_ROOM_CODE_SENTENCE = "Enter the room code from your teacher.";
export const MISSING_DISPLAY_NAME_SENTENCE = "Enter your name, as your class will see it.";

export type JoinField = "roomCode" | "displayName";

export interface JoinProblem {
  sentence: string;
  field: JoinField;
}

// Both fields must hold more than spaces; the room code is checked first. Anything else (a code no game
// uses) is the server's 404 ROOM_CODE_NOT_FOUND to report.
export function joinProblem(roomCode: string, displayName: string): JoinProblem | null {
  if (!roomCode.trim())
    return { sentence: MISSING_ROOM_CODE_SENTENCE, field: "roomCode" };
  if (!displayName.trim())
    return { sentence: MISSING_DISPLAY_NAME_SENTENCE, field: "displayName" };
  return null;
}
