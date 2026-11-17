# Issue 05: Update Step Definitions - Remove App Parameter

## Task

Update all step definition files to remove `this.app` parameter from HTTP client calls.

## Files to Update

- `tests/integration/step-definitions/session-lifecycle.steps.ts`
- `tests/integration/step-definitions/phase-transition.steps.ts`
- `tests/integration/step-definitions/chain-submission.steps.ts`

## Changes Required

Remove the `this.app` parameter from all HTTP client calls:

```typescript
// Before
this.lastResponse = await createSession(this.app, { packId, mode, ... });

// After
this.lastResponse = await createSession({ packId, mode, ... });
```

## Example Change in `session-lifecycle.steps.ts`

```typescript
When(
  "the instructor creates a classroom session with pack {string}",
  async function (this: TestWorld, packId: string) {
    this.lastResponse = await createSession({  // No this.app
      packId,
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    this.parseLastResponse();
    // ...
  },
);
```

## Acceptance Criteria

- [ ] No references to `this.app` in step definitions
- [ ] All HTTP client calls use simplified signature
- [ ] TypeScript compiles without errors
- [ ] Tests pass when `netlify dev` is running
