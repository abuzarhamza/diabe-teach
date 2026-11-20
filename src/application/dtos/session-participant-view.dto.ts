/**
 * One learner in a Game Session's state, as documented by
 * `SessionParticipantView`. Never carries an email or account id.
 */
export interface SessionParticipantViewDto {
  readonly participantId: string;
  readonly displayName: string;
  readonly joinedAt: string;
  /** When the learner left; `null` while they are still in the session. */
  readonly leftAt: string | null;
}
