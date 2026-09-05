---
title: "From Roadmap to Code: Plan, Review, Implement"
course: "10xdevs-3"
language: "en"
source: "Przeprogramowani.pl"
exported: "2026-09-05"
format: "markdown"
---

![cover](https://images.przeprogramowani.pl/lessons/m2-l2/assets/cover-en.jpg)

In the previous lesson, we built an MVP roadmap – a work map for the human and the agent. It helps to understand what is the foundation of the project, what is a vertical functional slice, what is blocked, what can be done in parallel, and what is consciously put on hold.

This is a good moment to make a very human mistake.

You have a roadmap, you see a few items in the `ready` section, so you start the agent and type: "do the entire Stream A now." The agent starts. It reads the files. It builds a plan in its head. It modifies a dozen places at once.

After a while, some things work, some look almost ready, some are just a promise in a comment, and you try to reconstruct what the actual goal of this session was.

So we're returning to the old problem, just at a higher level. Instead of the prompt "build an MVP," we have the prompt "build a stream." Sounds more professional, but it's still too broad.

In this lesson, we take the next step: we take the roadmap and turn it into the first controlled work cycle:

```
roadmap item -> change-id -> plan.md -> plan review -> phase implementation -> Progress
```

The most important thesis is simple: **a plan is a mechanism for controlling the agent's future work**.

It's not about bureaucracy or a ritual before every task. It's about having a place where the agent records their assumptions, phases, contract modifications, and work completion conditions before a major code edit. Then you can say: "yes, this makes sense" or "no, let's stop here".

First the plan. Then the code.

🎥 **VIDEO**: [Watch here](https://player.vimeo.com/video/1193150555?badge=0&autopause=0&player_id=0&app_id=58479)

### Roadmap as a Stream Map

First, download the artifact package for this lesson:

```bash
npx @przeprogramowani/10x-cli@latest get m2l2
```

This package provides the workflow needed for this lesson: `/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement`.

The starting point is `context/foundation/roadmap.md`, which we created in the previous lesson. This file is not a shopping list that you check off from top to bottom. It is a map of dependencies and workflows that is worth spending a moment to consider.

For our example project 10xCards, the most important now is Stream A, which is the path from minimal product outlines to the first working flow of generating and saving flashcards.

In simple terms, it looks like this:

![Diagram](https://images.przeprogramowani.pl/diagrams/lessons-m2-l2-lesson-draft-1-10x.png)

In this lesson, we are interested in the main path of generating and saving cards:

- `F-01` as a technical basis that organizes access to the product.
- `S-01` as the first secured card generation cycle.
- `S-02` as a record of accepted cards to the deck.
- optionally `S-03` as a continuation, if the demo and time allow.

`S-04`, which is a spaced repetition review session, is waiting its turn. This is not accidental. SRS looks like "another screen," but technically it is blocked by the choice of library, the `ReviewState` model, the rating scale, and the card editing policy. This is a separate level of complexity.

`S-05` from the compliance area is also deliberately omitted in the main track. Not because compliance is unimportant, but because in this lesson we teach the flow from the roadmap to the first working stream, not all parallel product lines.

Sounds like a constraint? Yes. And that's the point.

### Scope of this lesson

In this lesson, we want to do one thing well: run a part of the roadmap through the first practical loop from planning to implementation, with phase division and result verification.

We do not build entire flashcards in one lesson. We do not choose the SRS library. We do not yet delve into a full review of the generated code.

At this stage, we are looking for tasks that we can undertake at low cost and about which we are confident we understand well. These will be the subject of the workflow `plan -> implement`.

| Roadmap item | Role in the lesson   | What we do with it           |
| ------------ | -------------------- | ---------------------------- |
| F-01         | technical foundation | quick plan and get to work   |
| S-01         | functional slice 1   | we plan and implement        |
| S-02         | functional slice 2   | we plan and implement        |
| S-03         | functional slice 3   | we plan and implement        |
| S-04         | SRS system           | in the lesson about research |
| S-05         | after the MVP phase  | homework for volunteers      |

Breaking down the dream project into stages is meant to ensure that step by step we see measurable progress. Let's remember to avoid two extremes.

The first is vibe coding: "let's do everything that's on the roadmap". It usually ends with a large diff where it's hard to separate good progress from the agent's random decisions.

The second: "before each step, let's do exactly the same routine - five steps of preparation, eight of research, twelve markdown files, and only then we code". It sounds mature, but it quickly turns the workflow into art for art's sake. You then stop asking why you are actually performing a given step.

In this lesson, we learn an intermediate approach: we choose the slices that we understand reasonably well, plan their implementation, adjust the plan if necessary, and then start working.

### Change-id as work intention

To talk precisely about the introduced change, the agent needs an operational identifier - a single name under which this change exists.

This identifier is `change-id`, which specifies the "intention" of what you plan to do.

Examples:

```text
gate-product-routes
first-gated-generation
atomic-save-to-deck
```

`change-id` is our convention that ties together several things that would otherwise get scattered during the conversation:

- an item from the roadmap,
- folder `context/changes/<change-id>/`,
- description of the change in `change.md`,
- implementation plan in `plan.md`,
- plan brief in `plan-brief.md`,
- the later command `/10x-implement <change-id> phase 1`,
- section `## Progress`, where we record the actual state of the work.

`change-id` is meant to answer the question: "which specific change are we talking about and where is its memory?".

![Diagram](https://images.przeprogramowani.pl/diagrams/lessons-m2-l2-lesson-draft-2-10x.png)

This is the `Write` strategy from the context engineering prework, but in a production version. Knowledge does not live solely in conversation with the agent. It lives in the repository.

### Where this workflow came from

Before you type the first command, it's good to know what exactly you get in the package.

The workflow `research -> plan -> implement` that we present in this module did not come from a single book or the documentation of one tool. It is the result of many hours of observing how the agent behaves in real code, testing various tool configurations, and exchanging comments about what we don’t like or what is missing.

In short, it looks something like this.

Today, almost everyone who works with agents knows one thing: jumping into coding without a plan is a bad decision. Alright then, let's use the built-in Plan Mode. It works – but it works in its own way. The plan disappears along with the session, it's hard to come back to it a week later, it can't be easily shared with another person, and we have limited control over exactly what should be included in it.

Here arises an opportunity for your own version. We create `/10x-plan`: the plan should go to the repo, have a fixed structure, and be readable both for humans and for `/10x-implement`.

We have a plan. We observe the implementation. The agent runs too fast, does too much at once, and is hard to evaluate during the process. We want to proceed step-by-step and statefully. Alright - let's do `/10x-implement`. We add a phase for automated and manual testing, a commit after each phase, and an update to `## Progress` as a permanent record of the work.

And so, piece by piece, what you now receive in the package is created.

The most important thing: we show you the final result, but the background is the work that you – just like us – should do on your own. Your tools, your team, and your project have their specific quirks. Something in our workflow might not suit you, something might be missing. Treat `/10x-plan`, `/10x-plan-review`, and `/10x-implement` as a starting point, not a final configuration.

We arrived at this version through iteration. You will probably arrive at your own version as well.

Now let's see the whole process in action.

### F-01 as the technical foundation

In our project, the roadmap starts with `F-01 gate-product-routes`.

This is a good example of a task that does not require separate research or framing. The scope is clear: product paths should only be accessible behind an authentication gate, and the agent should determine which files to touch and how to verify the change.

The workflow with such a task consists of three main skills:

- **10x-new** to generate a new change (change-id),
- **10x-plan** to create `plan.md` and `plan-brief.md`,
- **10x-implement** to start the step-by-step task implementation.

```text
/10x-new gate-product-routes F-01 z @roadmap.md
/10x-plan gate-product-routes
/10x-implement gate-product-routes phase 1
```

This is a basic workflow for tasks of low and medium complexity, where we are confident that the agent will manage without much support.

### S-01 and S-02 as the first functional slices

After the warm-up, we move on to the main slice: `S-01 first-gated-generation`, and then `S-02 atomic-save-to-deck`.

Let's see how to prepare for it using the **10x-plan** (you can watch the full process in the video below).

Skill invocation:

```text
/10x-plan atomic-save-to-deck
```

The plan should break the work down into phases that can be completed and verified separately. We don’t want one phase called "implement everything." We want a sequence in which each step has a meaningful contract. This is one of the key differences between the 10xDevs workflow and how the standard, agent-built-in `Plan Mode` functions work.

The skill creates not one, but two artifacts. This is one of the evolutionary changes we introduced when we saw how difficult long plans can be for a human to interpret.

The first artifact is `plan.md`, which should contain at least:

- **end state** \- what should be true after the change,
- **phases** \- logical execution steps,
- **Intent + Contract per file** \- why we touch a given file and which contract must not be broken,
- **Success Criteria** \- how we will know it works,
- **Risks / Open Questions** \- what can still block the work,
- **`## Progress`** \- one place where the implementation records the phase status.

The second artifact, added by us after the first iterations, is `plan-brief.md`. It is a lightweight handover document - a quick assessment of the change, the possibility to confirm or correct the direction of action, as well as context for people who will be doing the review.

The entire planning process works like this:

![Diagram](https://images.przeprogramowani.pl/images/2026/05/aUITauyhBu2nkdUP9YmmmQM.jpeg)

Let's see it in action:

🎥 **VIDEO**: [Watch here](https://player.vimeo.com/video/1193153481?badge=0&autopause=0&player_id=0&app_id=58479)

### Plan review before code

If you want to delegate more work to the agent during the preparation stage, we have one more skill for that.

```text
/10x-plan-review atomic-save-to-deck
```

`/10x-plan-review` is treated as a readiness check of the plan. It involves a few questions before implementation:

- Does the plan truly address the task from the roadmap?
- Is the end state specific?
- Are the phases feasible and do they not skip important decisions?
- Are the contract surfaces named?
- Does `## Progress` have a format that `/10x-implement` will be able to update?
- Do the success criteria check behavior, not just the existence of files?

If the review raises significant remarks, do not treat it as a failure. This is the cheapest moment for a correction. The plan costs a few minutes and some tokens. A bad diff spanning a dozen files costs much more energy.

That is precisely why planning has become a visible pattern in modern coding agents. A person wants to have a moment of control before the agent starts modifying the repository.

### Implementation of one phase

After accepting the plan, you can start the implementation:

```text
/10x-implement atomic-save-to-deck phase 1
```

At this stage, the agent should not reinvent what to do. It should take `plan.md`, execute a specific phase, verify the result, ask for manual decisions where needed, commit the changes, and update `## Progress`.

The minimal loop looks like this:

![Diagram](https://images.przeprogramowani.pl/diagrams/lessons-m2-l2-lesson-draft-4-10x.png)

For now, it is enough that you see the mechanics:

- the agent sticks to one phase,
- reports the affected files,
- runs established verification commands,
- stops at the manual gate if the plan requires it,
- saves the commit SHA or status in `## Progress`.

A more thorough implementation discipline, context assessment, and handling hallucinations will be developed with research on the more difficult SRS stream. Here, we focus on the first contact with phased plan execution.

In other words: you learn to drive the agent on the track before the track starts having turns.

🎥 **VIDEO**: [Watch here](https://player.vimeo.com/video/1193154861?badge=0&autopause=0&player_id=0&app_id=58479)

### Checkpoint progress

Success in this lesson does not mean that the entire 10xCards is ready.

Success means that you have:

- selected stream from the roadmap,
- change folder for a specific change,
- `plan.md` and `plan-brief.md`,
- plan after a quick review,
- at least one implemented phase or a ready checkpoint showing what the phase looks like after execution,
- updated `## Progress`.

## 🧑🏻‍💻 Practical tasks

- **Plan one slice from the roadmap.** Choose a foundation or a small slice for warm-up from `context/foundation/roadmap.md`. Run `/10x-plan <change-id>` and plan the implementation of this functionality. Goal: plan the implementation of the given change broken down into phases.
- **Implement the chosen slice.** Run `/10x-implement <change-id>`. While working, observe how the agent sticks to the given phase, whether it reports the modified files, runs verification commands, and stops at manual tests. Goal: one roadmap slice completed according to plan.

If you successfully test the `plan -> implement` cycle, add other elements from the lessons of the second module and try to close the key areas of your MVP this week. Remember the North Star, which is the one key aspect that determines the value of the project. The rest should wait its turn. Don’t rush blindly – if you need more time to assess the plan and review the code, work at your own pace.

## Deep Dive

### Why a plan is not bureaucracy

Planning has a bad reputation because many of us associate it with a document that is created before the work, and then no one ever goes back to it.

In working with an agent, the plan serves a different function. It is not a forecast. It is a synchronization point before the agent starts modifying files.

The agent can quickly read the repo, suggest the order, indicate files, and build a mental model of the change. The problem is that if it does this only "in its head" within a session, you only see the effect after the diff. And the diff after several minutes of autonomous work may already be too broad to comfortably assess where the deviation started (the so-called drift).

`plan.md` shifts control earlier (shift-left).

Instead of asking afterwards ("why did you change these files?"), you ask earlier ("are these files really in the scope of the task?"). Instead of discovering after implementation that the agent interpreted `S-02` as a complete rebuild of the card model, you catch it at the planning stage.

This is a very practical difference.

Cursor describes Plan Mode as a mode in which the agent first examines the code, asks questions, and creates a plan for review before implementation. Claude Code documents a similar "plan before editing" workflow and also warns that planning has its cost. OpenAI in materials about Codex and execution plans also emphasizes the value of self-sufficient plans for longer tasks.

We do not draw the conclusion "always make a plan" from this. We draw a better one: **the greater the risk and the more files, the more important a clear plan before coding**.

### Plan Mode and `/10x-plan`

The built-in Plan Mode in the tool and `/10x-plan` solve a similar problem, but at different levels of durability.

| Feature                        | Built-in Plan Mode                | /10x-plan in 10xWorkflow                                       |
| ------------------------------ | --------------------------------- | -------------------------------------------------------------- |
| Where the plan lives           | in the tool UI or in conversation | in context/changes/<change-id>/plan.md                         |
| How long it lives              | depending on the session          | as long as the repo                                            |
| What it is for                 | pre-edit control                  | control, hand-off, implementation, review                      |
| How to resume work             | through the tool's history        | through files: change.md, plan.md, plan-brief.md, \## Progress |
| How it connects to the roadmap | manually, by prompt               | via change-id and change folder                                |

You don’t have to choose one or the other. If your tool has a great Plan Mode, you can use it as your working interface. However, at 10xWorkflow, we care about the final contract making it into the repository.

The conversation history is fragile. The file in the repo is durable.

### Architect and coder

Agent tools increasingly separate the model's roles: a stronger model for planning, a cheaper or faster one for execution. Claude Code even has configurations (`opusplan`) - [link](https://code.claude.com/docs/en/model-config), which show such a division as a pattern - planning requires stronger reasoning, while executing some changes may be more routine.

Do not treat this as mandatory configuration. Model names, prices, and default settings change too quickly to build the course method on them.

Think of this as a mental model:

- **architect** defines the scope, risks, contracts, and phases,
- **coder** executes the phase according to the plan,
- **the human** approves the direction and ensures that the plan still matches the product.

In simple tasks, these roles can fit within a single session and a single model. In more complex ones, you can consciously separate planning and implementation: a separate thread, a more powerful model, a subagent for research, or manual plan review.

The branding of the model is not the most important thing. The most important is the boundary of the artifact: before the code starts, we have a plan that can be read.

### What to do with `Unknowns`

The roadmap often includes `Unknowns`, `Blockers`, and `Risk`. The natural reflex is to try to close them all before planning.

Do not do this automatically.

Some of the unknowns are exactly what `/10x-plan` is supposed to resolve after reading the code. If the roadmap says "it is not known whether a form component already exists," then the plan can check the repo and decide. If the roadmap says "it is not known whether the SRS library supports the required rating scale," then you probably need separate research, because that is not a local question about the code.

Practical rule:

- **local unknowns** \- let `/10x-plan` resolve them,
- **external unknowns** \- reach for research if they affect the technical decision,
- **suspect assumptions** \- use framing if you are not sure the problem is well defined,
- **unknowns without impact on the current slice** \- leave in `Open Questions` or `Parked`.

This protects you from "researching in advance." Research is great when it blocks a decision. It is a waste of time when it only improves your well-being.

### When to stop implementation

This lesson is not yet a complete lecture on drifting, but you need to know one signal right away.

If during the phase the agent discovers a fact that changes the plan contract, stop the implementation.

Examples:

- the plan assumed an existing `Deck` model, but there is nothing similar in the repo,
- the plan assumed a single auth path, but the project has two inconsistent paths,
- the plan involved a simple card recording, but domain validation requires a product decision,
- the plan involved touching three files, but the agent wants to rebuild ten modules.

A small mismatch can be adapted on the spot. A typo in the file name, a different export, a slight difference in the component structure - that's normal.

But if the end state or contract surface changes, do not "tighten" the code with another prompt. Go back to the plan, fix it, and only then continue.

In lesson four, we will deepen this on the SRS, where drift may result from a lack of up-to-date library documentation. Here, just remember: the plan is not a prison, but every change to it should be transparent.

## Additional Materials

- **Introducing Plan Mode** / Cursor / <https://cursor.com/blog/plan-mode> \- an example of a product Plan Mode: code research, clarifying questions, and a plan before implementation.
- **Best practices for Claude Code** / Anthropic / <https://code.claude.com/docs/en/best-practices> \- a good source for the principle that planning helps with uncertain and multi-file changes but has overhead.
- **Common workflows** / Anthropic / <https://code.claude.com/docs/en/common-workflows> \- description of the planning workflow before editing and separating research from implementation.
- **Model configuration** / Anthropic / <https://code.claude.com/docs/en/model-config> \- context for the architect/coder pattern; treat as an example of a model role, not a fixed recommendation for a specific configuration.
- **Exec Plans for Complex Coding Tasks** / OpenAI Cookbook / <https://developers.openai.com/cookbook/articles/codex%5Fexec%5Fplans> \- broader justification for self-sufficient plans as work artifacts for longer tasks.
- **How OpenAI uses Codex** / OpenAI / <https://cdn.openai.com/pdf/6a2631dc-783e-479b-b1a4-af0cfbd38630/how-openai-uses-codex.pdf> \- practical tips on working with structure, context, tasks similar to issues, and planning before larger implementation.