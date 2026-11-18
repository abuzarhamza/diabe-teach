# 06: Pin, copy, touch and keyboard polish

**What to build:** Clicking or tapping a tag pins its card open (the only way to open a card on touch screens). A pinned card has copy buttons for the path, sample request and sample response, closes with Esc or a close button, and returns focus to its tag. Cards stay inside the viewport. Outline, tag and badge colors meet contrast in light and dark mode, and reads vs. writes are distinguishable without color (solid vs. dashed).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Tags are focusable buttons labelled with step and operation
- [ ] Pinned card is a non-modal dialog; Esc closes it and focus returns to the tag
- [ ] Copy buttons put the exact JSON or path on the clipboard and confirm with a short message
- [ ] Cards reposition to stay on screen near edges and on small screens
- [ ] Checked by hand in light and dark mode on a desktop and a narrow (phone-width) window
