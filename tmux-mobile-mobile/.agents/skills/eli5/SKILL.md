---
name: eli5
description: Explain any topic to a complete beginner as a self-contained HTML artifact with large visual illustrations and very few words. Use when the user asks for ELI5, a beginner-friendly visual explanation, a picture-first explainer, or invokes `$eli5` with a topic in `$ARGUMENTS`.
---

# ELI5

Explain the topic as if the reader knows nothing about it. Treat `$ARGUMENTS`, or the text following the skill invocation, as the topic.

## Create the artifact

- Produce one standalone `.html` file and give the user a link to it.
- Make the explanation picture-first: use large inline SVG or CSS illustrations, diagrams, arrows, and familiar objects.
- Use very few words. Prefer labels and one short sentence over paragraphs.
- Use an everyday analogy before introducing the real concept.
- Organize the page into at most five simple ideas with a clear visual flow.
- Define unavoidable jargon immediately in plain language.
- Include one concrete example and a tiny recap.

## Keep it self-contained

- Put HTML, CSS, and JavaScript in the same file.
- Do not require external libraries, fonts, images, accounts, or network access.
- Make the layout responsive, readable on phones, and usable without animation.
- Use large type, strong contrast, semantic headings, and accessible labels for meaningful graphics.
- Respect `prefers-reduced-motion` if motion adds real explanatory value.

## Check the result

- Open or render the artifact and fix broken layout, clipped text, or unclear visuals.
- Confirm that a first-time learner can understand the main idea by scanning only the pictures and labels.
- Remove any text or decoration that does not help explain the topic.
