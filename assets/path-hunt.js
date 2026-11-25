/**
 * Path Hunt: a free-recall exercise. The learner reads a task ("where does X live?"), types a file
 * path from memory, and gets immediate feedback. Recall without options builds storage strength.
 *
 * initPathHunt(containerId, tasks)
 *   tasks: [{ prompt, answers: ["web/src/api/http-client.ts", ...], hint, explanation }]
 *   An answer matches when the typed path, after trimming, removing a leading "./", and lower-casing,
 *   equals one of `answers` or ends with "/" + one of them.
 */
function initPathHunt(containerId, tasks) {
  const root = document.getElementById(containerId);
  if (!root) return;

  const normalise = (text) => text.trim().replace(/^\.\//, "").replace(/\\/g, "/").toLowerCase();

  root.innerHTML = tasks
    .map(
      (task, index) => `
    <form class="hunt-task" data-index="${index}">
      <div class="quiz-prompt">${index + 1}. ${task.prompt}</div>
      <div class="hunt-row">
        <input class="hunt-input" type="text" spellcheck="false" autocomplete="off" placeholder="web/src/…" aria-label="File path for task ${index + 1}" />
        <button class="quiz-option-btn" type="submit">Check</button>
        <button class="quiz-option-btn hunt-reveal" type="button">Show answer</button>
      </div>
      <div class="quiz-feedback" data-feedback></div>
    </form>`,
    )
    .join("");

  root.querySelectorAll(".hunt-task").forEach((form) => {
    const task = tasks[Number(form.dataset.index)];
    const input = form.querySelector(".hunt-input");
    const feedback = form.querySelector("[data-feedback]");
    const accepted = task.answers.map(normalise);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const typed = normalise(input.value);
      const ok = typed && accepted.some((a) => typed === a || typed.endsWith(`/${a}`) || a.endsWith(`/${typed}`) && typed.includes("/"));
      input.classList.toggle("correct", !!ok);
      input.classList.toggle("incorrect", !ok);
      feedback.style.color = ok ? "var(--accent-green)" : "var(--accent-crimson)";
      feedback.textContent = ok ? `Correct — ${task.explanation}` : `Not yet — ${task.hint}`;
    });

    form.querySelector(".hunt-reveal").addEventListener("click", () => {
      feedback.style.color = "var(--ink-secondary)";
      feedback.textContent = `${task.answers[0]} — ${task.explanation}`;
    });
  });
}
