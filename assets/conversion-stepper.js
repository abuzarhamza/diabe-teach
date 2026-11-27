/**
 * Conversion Stepper: turn old code into new code one block at a time.
 * The learner sees the old code with numbered lines. Each step highlights some lines and asks which
 * new construct replaces them. A correct answer strikes those lines through and adds the new line(s)
 * to the "new code" panel, so the learner builds the result themselves. Wrong answers get a hint.
 *
 * initConversionStepper(containerId, {
 *   oldTitle, newTitle,
 *   oldLines: ["const [data, setData] = useState(null);", ...],
 *   newHeader: ["return useQuery({"], newFooter: ["});"],
 *   steps: [{ lines: [0, 1], prompt, options: [...], correctIndex, explanation, hint, adds: ["  queryFn: ...,"] }],
 * })
 */
function initConversionStepper(containerId, config) {
  const root = document.getElementById(containerId);
  if (!root) return;

  const esc = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let current = 0;
  const added = [];

  root.innerHTML = `
    <div class="stepper-panes">
      <div><h3>${config.oldTitle}</h3><pre class="stepper-old"></pre></div>
      <div><h3>${config.newTitle}</h3><pre class="stepper-new"></pre></div>
    </div>
    <div class="stepper-step quiz-question"></div>`;

  const oldPre = root.querySelector(".stepper-old");
  const newPre = root.querySelector(".stepper-new");
  const stepBox = root.querySelector(".stepper-step");
  const done = new Set();

  function renderCode() {
    const active = current < config.steps.length ? new Set(config.steps[current].lines) : new Set();
    oldPre.innerHTML = config.oldLines
      .map((line, i) => {
        const cls = done.has(i) ? "stepper-line replaced" : active.has(i) ? "stepper-line active" : "stepper-line";
        return `<span class="${cls}"><span class="stepper-no">${String(i + 1).padStart(2, " ")}</span> ${esc(line)}</span>`;
      })
      .join("\n");
    newPre.innerHTML = [...config.newHeader, ...added, ...config.newFooter].map(esc).join("\n");
  }

  function renderStep() {
    renderCode();
    if (current >= config.steps.length) {
      stepBox.innerHTML = `<div class="quiz-prompt">Done. Every old line is gone or replaced. Compare the new code with the real hook below.</div>`;
      return;
    }
    const step = config.steps[current];
    stepBox.innerHTML = `
      <div class="quiz-prompt">Step ${current + 1} of ${config.steps.length}. ${step.prompt}</div>
      <div class="quiz-options">${step.options
        .map((opt, i) => `<button type="button" class="quiz-option-btn" data-i="${i}">${opt}</button>`)
        .join("")}</div>
      <div class="quiz-feedback" data-feedback></div>`;
    const feedback = stepBox.querySelector("[data-feedback]");
    stepBox.querySelectorAll(".quiz-option-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (Number(btn.dataset.i) === step.correctIndex) {
          step.lines.forEach((i) => done.add(i));
          added.push(...step.adds);
          current += 1;
          renderStep();
          const note = document.createElement("div");
          note.className = "quiz-feedback";
          note.style.color = "var(--accent-green)";
          note.textContent = `Correct — ${step.explanation}`;
          stepBox.prepend(note);
        } else {
          btn.classList.add("incorrect");
          feedback.style.color = "var(--accent-crimson)";
          feedback.textContent = `Not quite — ${step.hint}`;
        }
      });
    });
  }

  renderStep();
}
