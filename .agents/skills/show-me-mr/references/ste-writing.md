# Writing style: about 80% of ASD-STE100

ASD-STE100 (Simplified Technical English) is a controlled language from aerospace maintenance documentation. Follow its rules about 80% of the way. The full spec is too strict for code review, so keep the code terms the reader already uses.

## Rules

1. **Short sentences.** At most 20 words in an instruction. At most 25 words in a description.
2. **One idea per sentence.** Split any sentence that contains "and" between two actions.
3. **Active voice.** Name the actor: "The worker retries the job." Do not write "The job is retried."
4. **Simple verb forms.** Use the imperative ("Check the migration."), simple present ("The handler returns 404."), simple past, and simple future. Do not use "-ing" forms as verbs ("is calling", "having fetched").
5. **One word, one meaning.** Choose one name for each thing and use it every time. If the code calls it `session`, do not also call it "conversation" or "run".
6. **Concrete words.** Use code identifiers in backticks. Do not use vague words such as "handle", "deal with", "leverage", "utilize", "various", or "some logic".
7. **Warnings first.** Put a warning before the text it concerns. Begin it with **Warning:** for data loss, security, or breaking changes, and with **Note:** for everything else.
8. **Short paragraphs.** At most 6 sentences in a paragraph. Use a numbered list for steps.
9. **No filler.** Do not write "This PR aims to", "basically", "it's worth noting", or "in order to".

## Allowed exceptions (the other 20%)

- Technical names: framework, library, and protocol terms (`idempotent`, `debounce`, `JWT`).
- Identifiers from the code, even if they are not English words.
- One short "why" clause after "because" or "so that".

## Example

Before:

> This PR basically refactors the way session handling is being done so that we can leverage the new event stream, and it also fixes an issue where reconnects were sometimes dropping messages.

After:

> `SessionStore` now reads events from `EventStream` and does not poll.
> A reconnect replays events from the last saved `cursor`, so no messages are lost.
> **Warning:** The `sessions.cursor` column is new. Run the migration before you deploy.
