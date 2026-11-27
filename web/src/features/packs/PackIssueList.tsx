import type { PackIssue } from "../../domain/pack-library.ts";
import { useId } from "react";
import { packIssueLine } from "../../domain/pack-library.ts";

interface PackIssueListProps {
  // "Errors" or "Warnings": the list's heading and accessible name.
  label: string;
  issues: PackIssue[];
  tone: "err" | "warn";
}

// The pack validator's issues in plain language, each naming the part of the pack and its path.
// Nothing is rendered when there are none.
export function PackIssueList({ label, issues, tone }: PackIssueListProps) {
  const headingId = useId();
  if (!issues.length)
    return null;
  return (
    <div className={`issues ${tone}`}>
      <h4 id={headingId}>{label}</h4>
      <ul aria-labelledby={headingId}>
        {issues.map(issue => <li key={`${issue.path} ${issue.code} ${issue.message}`}>{packIssueLine(issue)}</li>)}
      </ul>
    </div>
  );
}
