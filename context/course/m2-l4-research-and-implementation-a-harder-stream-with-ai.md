---
title: "Research and Implementation: A Harder Stream with AI"
course: "10xdevs-3"
language: "en"
source: "Przeprogramowani.pl"
exported: "2026-09-06"
format: "markdown"
---

![cover](https://images.przeprogramowani.pl/lessons/m2-l4/assets/cover-en.jpg)

In previous lessons, we went through the full cycle of a single change: roadmap, plan, phased implementation, and review of the generated code. Card generation works, saving to the deck works, editing too. CRUD as it should be.

And suddenly a slice appears, which at first glance looks like another endpoint, but it is not one at all.

`S-04 srs-review-session`, that is review session. At first glance, it's simply "show the card, collect the rating, update the state, show the next one." Classic CRUD with a bit of logic. You open Cursor or Claude Code, enter the same command as before - `/10x-plan srs-review-session`. After a moment, the agent starts asking questions you might not have expected: what ratings do we accept, does the card have a single review policy or a configurable one, how do we calculate the `due date`, what happens to the card after editing. And which library do we use. How are you supposed to know that?

The workflow is not broken. The business logic is starting to become more unique, and your project stops being a collection of endpoints.

So we need new tools for more challenging cases. First, such a slice requires **broader preparation before planning**: in CRUD, `/10x-plan` was sufficient, but for less obvious functions it's worth gathering additional context first – from the codebase and external sources. Second, we add a specific toolkit for external research for agents: AI-native search, live docs, and a discipline of searching sources designed for LLM.

The workflow remains the same. Only the preparation increases along with the risk.

### After CRUD we have cards, but reviews are missing

Our checkpoint now looks as follows: the user generated flashcard proposals, accepted some, and saved them as `Flashcard` in the deck. The card exists. It has a front, back, deck, and creation date. And this is exactly where what Stream A offers to the product ends.

Because from a learning perspective, a deck full of cards without review sessions is just a better version of a notebook.

We lack a review system:

![Diagram](https://images.przeprogramowani.pl/diagrams/lessons-m2-l4-lesson-draft-1-10x.png)

`S-04` is precisely this loop. The card gains a `ReviewState`. From the `ReviewState`, it follows which cards need to be shown today. We display them, the user evaluates ("Again / Hard / Good / Easy" or "1-5", depending on the algorithm), based on the evaluation we update the state and set the next review date.

Sounds simple. And it is precisely this simplicity that is a trap you can easily fall into.

### SRS is a contractual decision

A natural reflex when working with the agent is to treat `S-04` like any other slice from the roadmap: change-id, `/10x-plan`, phases, implementation. Try to start this way in your mind and stop at the first decision the agent will have to make.

What shape should `ReviewState` have?

There is no "common sense" answer here. If you base yourself on the classic SuperMemo algorithm (SM-2), used in the older version of [Anki](https://apps.ankiweb.net/), `ReviewState` is roughly `easeFactor`, `interval`, `repetitions` plus the date of the last review. The grading scale has six levels, and the editing policy is quite liberal. If you adopt FSRS (a newer algorithm, optional in Anki since version 23.10 from November 2023), `ReviewState` is a triple `Difficulty / Stability / Retrievability` plus model parameters, the grading scale has four levels (`Again / Hard / Good / Easy`), and card editing affects the state in a way that must be consciously handled.

Each such decision is a contract that propagates further:

![Diagram](https://images.przeprogramowani.pl/images/2026/05/3kcTaqeKFIKekdUP4Ymp6QI.jpeg)

In other words: in `S-04` you are not blocked by lack of code to write. You are blocked by the **lack of embedding code in specific domain decisions**, without which the agent doesn't know which direction to take with the writing. A plan built before this decision will be very limited – the agent will choose something on its own, halfway through the implementation it will turn out that the schema doesn't fit the library's API and you will end up back in the same place, only with a mess in the repo.

You will see the same pattern in many other applications:

- In a typical SaaS, "subscription plan change" sounds like a form and a webhook. In practice, you are blocked by prepayment rules, billing cycles, payment renewals, corrective invoices, taxes, and the payment provider's API.
- In the logistics application, "suggest a route to the courier" sounds like a map view. In practice, you need to choose an optimization model: time windows, vehicle capacity, package priorities, traffic jams, pickup points.
- In a marketplace service, "match client to contractor" sounds like a search engine. In practice, research may concern ranking methods, availability, distance, rates, cancellations, reputation, and whether the result should be deterministic or learn from user behavior.
- In the educational product, "recommend the next lesson" sounds like a list of recommendations. In practice, you need to determine whether you recommend based on completed lessons, quiz results, skill gaps, time to goal, or content similarity.

In each of these cases, the agent can write code. The problem is that without research, it will write it based on a random world model.

This is the signal that our slice from the SRS needs broader preparation.

To fit all the new information into the model's context window, we will split it into two moves: first external reconnaissance (what is a sensible ready-made solution on the market?), then project analysis (what do we already have in the code?). Let's start with some ideas for SRS from the outside.

### External research for agents

To start the implementation of SRS, we will look for inspiration online – what exactly this system is, how many algorithms are available, and what the trade-offs are. And here comes a reflex from the ChatGPT era that is worth addressing right away:

> "I will paste the question into the free ChatGPT, take the first answer, and put it into the plan."

First, a typical chatbot will respond from training memory – it will hit the data cutoff date, resulting in hallucinations and outdated package names. Second, even if the answer is sensible, we don’t know if it is based on something that can be verified. We haven’t done the so-called `grounding`, which means embedding AI results in real data.

We return here to the difference from the prework: the chatbot mainly responds, the agent operates in the harness and uses tools. One of these tools is fetching resources from the web, e.g. `WebFetch`, which allows going beyond the model's memory limitations and loading current documentation, issues, README, or technical articles.

Only that `WebFetch` is just the first piece of the puzzle. If you have a specific URL, the agent will fetch it. If you are still looking for sources, you also need a tool like `WebSearch` or an external MCP. This is where inequality among agents begins: not everyone has a built-in search engine, not everyone allows it to be configured, and not everyone uses the same backend.

For today it looks more or less like this:

- **Cursor** \- uses the Exa.ai service to search for current information and add it to the context.
- **Codex** and **ChatGPT** \- integration with Microsoft's Bing search engine - [support page](https://help.openai.com/en/articles/9237897-chatgpt-search).
- **Claude Code** \- the built-in `WebSearch` tool does not have described providers, but Reddit users indicate that the results often overlap with those of [Brave Search](https://search.brave.com/), which is also noted by [Simon Willison](https://simonwillison.net/2025/Mar/21/anthropic-use-brave/).

Other tools may approach searching differently or not support this functionality at all. Fortunately, thanks to MCP and external AI-native search providers, we can address this gap.

#### Agentic search

Before we choose a specific provider, let's pause for a moment on the concept of integrating search engines with agents. **Agentic search** is a separate layer designed to work with an agent: queries can use more natural phrases and terms, results come in a format ready for further processing (most often pure markdown with metadata), and APIs are designed for call chaining - quick responses, cleaned page content instead of raw HTML, `answer`\-type endpoints that immediately return a result with cited sources.

Today, there are several major players on the market vying for your attention: **Brave Search**, **Firecrawl**, **Exa**, **Tavily**, **Perplexity**, **Parallel Search**, **SerpAPI**.

In May 2026, the AIMultiple team [published a benchmark](https://aimultiple.com/agentic-search) of all eight on 100 real questions from the programming industry. GPT-5.2 served as the judge (LLM-as-a-Judge), and 10% of the results were additionally verified by humans. The main conclusion – there is no single leader dominating the competition: **the group of four leaders (Brave, Firecrawl, Exa, Parallel Pro) is statistically indistinguishable** in the overall ranking

The most interesting are the results broken down by query type. The benchmark divides questions into six categories: _Research_, _Factual Verification_, **Technical Documentation**, _Real-time Events_, _Comparative_, and _Tool Discovery_.

What we need to do in `S-04` \- find a candidate for an SRS library in TypeScript, read the documentation, verify the shape of the API - is a textbook example of _Technical Documentation_. And in this very category, the upcoming **Exa.ai received the highest quality rating** among all eight.

Added to this is the market signal we already know: Cursor under `@web` is using Exa, and Notion AI uses it for news searches. The choice of practitioners and an independent benchmark point in the same direction. Therefore, in the next part of the lesson, we integrate Exa – as one of the representatives of the category, selected for our specific case.

> Note - if you are using Cursor, the integration with Exa.ai below is not essential for you, as Cursor supports it natively. If your agent already works with another top provider (Brave, Firecrawl, Tavily), do not change it reflexively - first see how it performs on a task similar to yours, and only then decide on migration.

#### Exa.ai as AI-native search

Exa.ai describes itself as "the best search API for AI" and "industry-leading web index built for agents." Marketing aside, behind this slogan are three things that really matter when working with an agent and are confirmed by the benchmark described above: accuracy on technical queries, short response times, and results in a format ready for further processing. In addition, we get MCP, which allows the agent to easily integrate this search engine into its set of tools.

In the free plan, we will perform 1000 queries, and the next 1000 costs only $7 (for comparison, `WebSearch` in apps based on Claude SDK costs $10 per 1000 queries). For the purpose of coding with agents and occasional web research, the free tier will be sufficient.

![Exa - Pricing](https://images.przeprogramowani.pl/lessons/m2-l4/assets/exa-pricing.png)

To get started, create a free account and choose the environment variant. We do not use Exa.ai as a library because we are not building an AI search application (you can consider this option too!), but we need the MCP:

![Exa - Setup](https://images.przeprogramowani.pl/lessons/m2-l4/assets/exa-config.png)

In response, we get a prompt that we can transform, for example, into a custom command (`.claude/commands/exa-init.md` or similar – the important thing is to be able to refer to it in your agent):

![Exa - Prompt](https://images.przeprogramowani.pl/lessons/m2-l4/assets/exa-prompt.png)

What will we use this tool for? We will search the internet for SRS algorithms and candidates for libraries supporting the core of this functionality. A video example is coming up shortly.

#### Context7 as live library docs

Let's say that Exa confirmed that the strongest candidate in TypeScript is `ts-fsrs` (an FSRS implementation from the Open Spaced Repetition community). You already know _which_ library you want in your plan. Now you need to know _how_ this library looks from the API side: what types it exports, what contracts it has, how initialization looks, how a typical call looks.

Here begins the second class of errors: you ask the agent about a library API, it answers from training memory and provides nicely formatted code with functions that do not exist or were changed three versions ago. A classic hallucination of the technical layer.

`Context7` is one of the options that solves this problem by injecting the current documentation into the agent's context. It supports MCP, [CLI](https://context7.com/docs/clients/cli), and dedicated [skills](https://context7.com/docs/skills) – you can configure it according to your preferences. The free plan allows 1000 calls, and for $10/month you get "unlimited API calls".

Installation - [Install tab](https://context7.com/install).

![Context 7](https://images.przeprogramowani.pl/lessons/m2-l4/assets/context-7.png)

We copy the specified command, run it **outside the agent** to update our MCP setup, open a new session, and MCP should be ready to authenticate with our account.

How does it work? When you ask the agent to fetch the selected documentation, it actually uses two tools:

```text
1. resolve-library-id: "ts-fsrs"
   → /open-spaced-repetition/ts-fsrs

2. query-docs: "/open-spaced-repetition/ts-fsrs"
   → structured markdown with current docs, trimmed to token budget
```

You can call these two tools separately, but you can also ask a general query:

`Download the documentation for <library_name>, which will allow you to implement S-04 from the roadmap. Use Context7 mcp`

In everyday conversation with the agent, breaking this down into two steps is not necessary. If your tool is integrated with Context7 and knows how to use it, speak to it naturally; if you see issues, break it into two stages - "first identify the library by ID, then fetch specific parts of the documentation".

The effect is that `/10x-plan` for `S-04` receives a fragment of the `ts-fsrs` docs as input instead of a hallucinated API. The plan can honestly say "we use `createEmptyCard` and `fsrs().next(card, rating)`" instead of making up functions.

Sticking to these two tools, we also have a hidden bonus for the quality of sources. Exa and Context7 return content designed for LLM - clean markdown without chrome, paywall, and popups. I develop this category of "agent-friendly docs" (Cloudflare `markdown-for-agents`, `llms.txt`, `/md` endpoints) in the Deep Dive section - there I show why a source in clean markdown beats HTML with navigation and why it is worth recognizing these traces.

### Internal research on project code

Time for the last piece of the puzzle - a skill for analyzing the project state with consideration of efficient use of the context window.

`/10x-research` is a new addition to our toolkit. It launches several subagents in parallel and returns a condensed report. The subagents read, grep, and inspect the structure. You receive a synthesis at the end.

From the content side:

![Diagram](https://images.przeprogramowani.pl/images/2026/05/F0gTavKsAp60kdUPw_PW0AI.jpeg)

- **A group of subagents running in parallel.** The skill uses the `Explore` agent (fast search through files and patterns) and the `general-purpose` agent (deeper multi-file analysis with reasoning). The main agent splits the question into 2-4 areas and launches them in one message, then collects the results into a single report. Your main context window does not load the entire repo – the subagents do that on their own, and the conversation receives a synthesis with `file:line` references.
- **Scope check before research.** If the question is ambiguous, the skill stops and asks via `AskUserQuestion` about the scope, depth, and area (e.g., "architecture & patterns" vs "integration points"). A short dialogue forces a decision before the agent starts burning tokens.
- **The output lands on disk as `context/changes/<change-id>/research.md`.** A structured document with sections _Summary_, _Detailed Findings_ (each with a reference `file.ext:line`), _Code References_, _Architecture Insights_, and _Open Questions_.
- **`context/foundation/lessons.md` as an introduction.** Rules accepted earlier in the project (e.g., "we keep SQLite in the prototype," "logger via `pino`, not `console.log`") are loaded as known context and narrow down what is even worth investigating.

Example call:

```text
/10x-research <change-id> <query>
```

In our 10xCards, well-formulated internal research answers questions like:

- What is the main flow of information in the card management area?
- What is the user session lifecycle?
- Is the latest version of the `ts-fsrs` library compatible with our code?

In the response, we receive file names, short code snippets, a list of conventions, and locations related to the question.

Remember - what internal research **will not** do:

- **It won't tell you which SRS library to choose.** Even if you ask directly. The agent will see that there is nothing like that in `package.json` and at best will suggest writing your own scheduling, but with SRS that is a very quick sandcastle pattern – a well-functioning spaced repetition algorithm is not just "a few lines with `setTimeout`".
- **Does not modify the project code.** The only file the skill is allowed to write is `research.md` in the change folder. This is an intentional safeguard – research is not a gateway for "the agent tidied up on the side."
- **Does not go beyond the agreed scope.** If you agreed to a "quick overview," subagents will not suddenly start reading `node_modules` or the git history.
- **Does not guess when it can check.** Every finding must come with a reference to the file and line. No reference = no claim, no respect.

Throughout the entire workflow, `research.md` is not a report to be shelved. A fixed location on the disk means that `/10x-plan` pulls it through `@research.md`, `/10x-plan-review` has something to compare the assumptions to, and `/10x-implement` returns to the same document when a phase enters an area the agent hasn't touched before.

Combining all components together, we have the following scheme for preparing the context for a new task:

![Diagram](https://images.przeprogramowani.pl/images/2026/05/QUgTauGKCJapnsEPtdHv-QE.jpeg)

Let's see how it works in practice:

🎥 **VIDEO**: [Watch here](https://player.vimeo.com/video/1194309204?badge=0&autopause=0&player_id=0&app_id=58479)

### Plan based on collected research

We now have all the pieces of the puzzle in one place. External research from Exa.ai and Context7 indicated that `ts-fsrs` is a sensible choice. We know the library’s API and its alternatives. Internal research with the new skill analyzed this option in the context of the current state of the project.

The entire prepared context is an excellent input for the new plan:

```text
/10x-plan srs-review-session Build S-04 implementation plan based on @research.md and @ts-fsrs.md
```

Previously, `/10x-plan` progressed with locally gathered ad hoc context. Here it enters with context trimmed to measure:

- Exa results that justify the choice of `ts-fsrs` instead of SM-2 or a custom implementation,
- documentation from Context7 with the current `ts-fsrs` API,
- a report `/10x-research` with a description of the 10xCards conventions and a file map.

What does this change in the `plan.md` itself? The questions become **solution-oriented**, rather than purely diagnostic or exploratory.

Instead of "what rating scale do we adopt?" the agent directly enters: "rating scale: `Rating.Again | Hard | Good | Easy` from `ts-fsrs`, the UI has four buttons, we save the last rating". Instead of "what does `ReviewState` look like?" - "we keep the `card` structure from `ts-fsrs` (returned by `createEmptyCard`) as a single object in the `review_state` column in the `flashcard` table; we update it via `scheduler.next(card, new Date(), rating)`; full structure in `plan-brief`".

`plan-brief.md` stops being a summary of the plan and becomes a true decision contract. One place where you can see why the library is like this and not another; why four buttons and not five; why editing the card resets the state instead of modifying it in place.

All embedded in carefully gathered research.

### Plan review and implementation for successful closure

Before we dive into the code, optionally another gate for those particularly skeptical about the quality of the agent's work. The `/10x-plan-review` skill from the previous lesson doesn't disappear just because the plan is based on research. On the contrary - when the plan begins to carry contractual decisions (rating scale, the shape of `ReviewState`, edit-vs-reset policy), `/10x-plan-review` is the cheapest place to catch blind spots and inconsistencies before the agent starts modifying files.

After such a review, we can start the implementation. You have already learned the mechanics of `/10x-implement` earlier: the agent takes the plan, executes a specific phase, verifies it, stops at manual verification methods, commits, updates the `## Progress`, and allows returning to the task execution later.

![Diagram](https://images.przeprogramowani.pl/diagrams/lessons-m2-l4-lesson-draft-5-10x.png)

Embedding the plan in carefully gathered sources further increases the effectiveness of the agent's actions. Difficult and non-obvious problems are broken down into smaller, "bite-sized" subtasks.

This is how you should work with challenges that are difficult for you (and the agent). First, gather context, research (both internal and external), then a plan, and only then implementation.

### Context drift, or when the agent cascades errors

The workflow `research -> plan -> implement` limits the most common pitfall of working with an agent, which we have not directly named until now. It is called **context drift**.

Drift is a cascade of small, erroneous decisions by the agent that, after several steps, lead the work in the wrong direction. A single decision seems reasonable. The second builds on the first. The third treats the previous two as facts. After the fifth step, you have internally consistent code that solves a problem you didn’t have.

Drift can come from two different directions.

**Due to lack of preparation.** The agent starts the task without a solid context – without a plan, without research, without knowledge of the project's conventions – so it begins to guess. The first guess looks good. Each subsequent one becomes the foundation for the next. This is exactly the case we address with `/10x-research`, Exa, and Context7: instead of model memory, we base decisions on verifiable sources.

**From conversation dragging.** Here the matter is less intuitive. Language models lose quality as the context length increases – and not only when the window "runs out." The phenomenon is described by [Chroma's "Context Rot" study](https://research.trychroma.com/context-rot) from 2025, conducted on 18 leading models (including GPT-4.1, Claude Opus 4, Gemini 2.5). All show the same pattern: the more tokens at input, the lower the precision – even when the window is not yet filled.

This is due to the architecture of transformers. The middle of the context statistically receives less attention than the beginning and the end ("lost in the middle"), and semantically similar but incorrect fragments confuse the model like distractors. Anthropic in [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) states this directly: increasing the window does not solve the problem because it's a property of the architecture, not a gap in training.

In practice, a drift from a long session looks like this:

- first message: the agent should implement one phase,
- after a dozen exchanges: the conversation contains fragments of three slices, two abandoned approaches, and half of the previous plan,
- after an hour: the agent mixes names from different steps, "remembers" decisions you didn’t make, and writes code for a data model from two topics earlier.

Same agent, same model. Different context state.

That's why the entire workflow from this lesson is not bureaucracy, but concrete answers to drift:

- **research embeds decisions in sources** instead of in the model's memory - subsequent steps are not built on guessing,
- **the plan in the file** is a fixed reference point that the agent does not lose after a session reset,
- **commit phases** separate work into short contexts that end with a clear state on the disk,
- **`## Progress`** allows you to return to work in a fresh session without "starting the story from the beginning".

A signal that drift is starting is usually not one specific error, but a set of minor symptoms: the agent repeats the same fixes over and over, corrupts file names, loses track of the previous decision, mixes phases. Then don't "fix it again." Open a fresh session, load `plan.md` and the last state of `## Progress`, and start the phase with a clean context.

Drift is not "the agent had a bad day." It is a predictable property of the system that can be specifically constrained.

### SRS is complete, but what if the plan doesn't work out?

A short break before we wrap up the main part of the lesson.

The fact that the workflow delivered the SRS does not mean it will deliver everything. When working with an agent, there are situations where even well-gathered clues are not enough. The plan does not form a clear decision. Or the plan forms, but during implementation subsequent steps hit a wall, and attempts to continue are fruitless. Or — most confusingly — the implementation starts to deviate from the plan in a way that, after two corrections, returns exactly the same as if you were trying to fix the wrong thing.

These are three different symptoms of the same problem. Not a lack of preparation, but **incorrect framing** \- the problem is being approached from the wrong side.

Incorrect framing means that the very name of the problem is misleading and merged with the proposed solution. Research then produces more and more detailed answers to a question that was wrongly posed from the start.

![Diagram](https://images.przeprogramowani.pl/images/2026/05/b0gTatzGGLm0kdUPxMyX8AI.jpeg)

In our case, the question "what does the target review session look like?" was clear. We conducted research, based on that a plan was created, and from that came a successful implementation. But it is not always like that.

Now you will learn a skill that will help you solve problems for which you are not sure whether a good solution actually exists. Or those where the agent persistently refuses to comply.

To show how it looks, let's step outside of 10xCards for a moment.

### `/10x-frame` as a lifeline

You will use the new skill everywhere where:

a) you lack expertise in the area you are working in,

One of the examples we ran it on concerned the game Space Explorers. We lacked expertise in gamedev and the intricacies of 2D games, but we saw the problem – overlapping characters. The solution? Unknown... but since there is a collision system, it is probably the culprit.

We plan, we act, we burn tokens - zero results.

The characters were still visually overlapping. Each subsequent attempt to fix it went deeper into a layer where there was no problem.

What went wrong? Lack of experience and focusing on the wrong area of the application. We took the wrong tool in hand.

Where does this discrepancy come from? Three different things have merged:

![Diagram](https://images.przeprogramowani.pl/images/2026/05/i0gTaubDHJiMvdIPuq2MmQQ.jpeg)

`/10x-frame` is a skill that enforces separating these three layers **before** you even move on to the plan. It guides you through the Frame Brief: write down the observation separately, the assumed cause separately, and the proposed fix separately.

Ask if the observation really requires this specific cause. Ask if the proposed fix was not inherited from a previous conversation or issue where you did not yet have all the data.

Let's look at this in the next fragment:

🎥 **VIDEO**: [Watch here](https://player.vimeo.com/video/1193158119?badge=0&autopause=0&player_id=0&app_id=58479)

Three things to remember about `/10x-frame`:

- **It is not part of the main 10xDevs workflow - it is a lifeline.** For the MVP you prepared for last week, you most likely won't start it, and the work will follow the path `research -> plan -> implement`. In projects outside the course, legacy or brownfield (where you lack knowledge), it can definitely come in handy.
- **Does not replace research.** Research addresses the lack of data and evidence. A frame addresses misnaming the problem and approaching the task from the wrong side. Sometimes you need the frame first, then research, then a plan – the order depends on what is really blocking the work.
- **Not every problem is a "misframing".** A small discrepancy in the agent's behavior can be adapted within the current session. The frame comes into play when, despite attempts to continue the conversation, your actions do not bring results - more than one session, more than one slip-up, or a complete lack of idea what to do.

## 🧑🏻‍💻 Practical tasks

👉 Note - the research and framing stages are optional. Perform the exercises below only when you encounter particularly complex tasks in your project, or simply when you want to test services like Exa. Do not complicate the planning process if it is not necessary.

- **Connect Exa.ai and Context7, then do external research for one slice.** Choose from the roadmap a slice where you are unsure about the library, algorithm, or domain model (your equivalent of `S-04`). Configure Exa MCP and Context7 MCP in your agent and open a fresh session. Ask the agent for two steps: first, search through Exa for 2-3 candidates for the library or approach, then use Context7 to fetch the current API of the winner (`resolve-library-id` → `query-docs`). Goal: one justified sentence "we choose X because ..." with a specific excerpt from the current documentation — instead of a hallucinated proposal from training memory. If Exa mostly returns SEO spam, rephrase the query for _Technical Documentation_, not for "best library 2026".
- **Go through the full `research → plan` loop for a non-obvious change.** For the same change-id, run `/10x-research <change-id> <query>` with a specific question about the project status (file map, conventions, points of contact with the new functionality). After generating `context/changes/<change-id>/research.md`, run `/10x-plan <change-id>` with references to `@research.md` and the downloaded docs. Compare the new `plan-brief.md` with the plan made earlier "from memory" on a similar slice. The goal: a plan where contract decisions (data shape, API contracts, edge case policies) point to a specific source instead of the agent’s "let's assume." If the plan still contains open questions – leave them as explicit `Open Questions`, do not allow the agent to guess them.

## 🔎 Deep Dive

This section contains a deeper insight into selected topics related to the lesson. In this Deep Dive, you will find:

- **Agent-friendly docs** — why markdown beats HTML in an agent workflow and how to recognize conscious "content providers for the agent internet".
- **Service visibility on the agents' internet** — who actually chooses the library today: you, or the agent who knows it and can access it in one step.

This section of the lesson is not mandatory, but it is worth reviewing if you want to become an expert.

### Agent-friendly docs

At this stage of the 10xDevs training, you can already see that the AI agent is becoming a real collaborator for the developer - it works in a loop, receives tasks, uses tools, and corrects its actions.

For this whole machine to work correctly, the agent always needs context where the quality and quantity of information are optimally balanced. The context format must also be optimal, specifically the format of the technical documentation.

> That's great, it's enough for the agent to get the link to the documentation!

Providing the agent with a link to any documentation may not be enough. Many websites obscure the most important content with JavaScript, ads, cookie banners, and other decorations that make navigation on the site difficult.

That is exactly why, for some time now, we have been observing a trend of building documentation in a format friendly to agents. The format is most often markdown – such documentation loads quickly, is concise, and contains only the necessary elements.

Several approaches to this practice include:

**`llms.txt`.** A convention proposed in 2024 by Jeremy Howard (Answer.AI). The `llms.txt` file at the root of the domain (`https://przeprogramowani.pl/llms.txt`) contains markdown with links to the most important resources and short descriptions of what is on the site. This is not a `robots.txt` (it does not regulate crawling) nor a sitemap (it does not index everything). It is intentionally a short index "start here if you are an agent." Adoption is uneven - Anthropic, Stripe, Cursor, Cloudflare, Vercel, Mintlify, Supabase have it; most projects globally unfortunately do not. The absence of `llms.txt` is the norm. Its presence is a signal that the project consciously works with agents. Documentation [at this link](https://llmstxt.org/).

**Dynamic content format switching.** In February, Cloudflare launched a mechanism where their docs (and hosted site resources - possibly including yours) serve markdown on demand. Just add the header `Accept: text/markdown` in the request to the chosen page and you get a version without navigation, footer, scripts, and CSS. The response additionally includes the `x-markdown-tokens` header, which allows the agent to budget the context before even loading the payload. This is a format switch on the fly, through which the website provider does not need to take extra actions to become "visible" to agents. Currently, this is only planned for Pro, Business, and Enterprise plans, but you can consider a similar change in your company’s middleware and proxies.

**Additional content rendering options** Increasingly, popular library and framework websites feature a new content rendering format – raw markdown. Some services, like Cloudflare, implement this through a dedicated link to an agent-friendly format, while others, such as Vercel, allow adding ".md" to the URL to access a lightweight version.

![markdown format](https://images.przeprogramowani.pl/lessons/m2-l4/assets/markdown.png)

```
https://vercel.com/docs/deployments
=>
https://vercel.com/docs/deployments.md
```

This type of change is not just a fleeting trend but evidence of how important the compatibility of delivered services with AI agents will soon be. An agent fed HTML with a paywall, navigation bar, pop-ups, and scripts spends tokens parsing noise, and the most important information often escapes it. Today, this cannot be afforded.

### Service visibility on the agents' internet

Documentation is one layer, but a broader change is happening on the product side itself. Lavanya Shukla captured this observation in a [spot-on thread on X](https://x.com/lavanyaai/status/2037589114170789951): in 2026, products will increasingly be chosen not by programmers, but by agents who are to propose, install, and launch them in one go.

From its thread, it is worth taking away three specific signals:

- **Resend.** From zero to about 500 thousand developers in a year. When Claude Code gets a general prompt "add email sending support," in 63% of cases it suggests Resend. SendGrid gets 7%. Not because Resend knocks out the competition technologically. Because the integration is _one command, one environment variable, and one page of docs_ that the agent reads from top to bottom without guessing.
- **Supabase.** From 1 million to 4.5 million developers in 12 months. The growth is mainly driven by a single SDK, clear types, and markdown docs, from which the agent operates before you even finish reading the first paragraph.
- **First Successful Execution.** Lavanya calls the first invocation that the agent delivered from start to finish without human intervention. This event carries the most weight because it remains in the session memory, in copied community snippets, and in subsequent model trainings. The loop strengthens itself.

The quote that resonates the most: _"your product is no longer your UI. It's your API."_ Andrej Karpathy in the same spirit adds: _"It's 2026\. Build. For. Agents."_

Practical conclusion for the research from the previous section: Exa and Context7 are not just a "search engine and docs." They are also a filter that shows which projects _want_ to be found by the agent. And today, that often overlaps with the ones that will actually work when the agent takes them on.

## 📚 Additional Materials

- [Context Rot: How Increasing Input Tokens Impacts LLM Performance](https://research.trychroma.com/context-rot) — Chroma Research, 2025; a study on 18 leading models (GPT-4.1, Claude Opus 4, Gemini 2.5, and others) showing that response quality decreases as input length increases - even before the window fills up. The basis for naming the mechanism context drift.
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — Anthropic, 2025; a practical guide to managing context (write/select/compress/isolate) as a response to context rot. The direct background for our `research -> plan -> implement` workflow with files on disk instead of long conversations.
- [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) — Lewis et al., NeurIPS 2020; background for the mental model "model memory vs retrieval," which underlies Exa and Context7.
- [Cognitive Biases in Software Engineering: A Systematic Mapping Study](https://arxiv.org/abs/1707.03869) — Mohanani et al.; review of biases in SE and rationale for scaffolding in agent workflow.
- [No Silver Bullet: Essence and Accidents of Software Engineering](https://www.cin.ufpe.br/~phmb/ip/MaterialDeEnsino/BrooksNoSilverBullet.html) — Frederick P. Brooks Jr.; a canonical text stating that there is no single solution for everything.
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — Open Spaced Repetition; TypeScript implementation of FSRS used as a candidate library in the demo ([docs](https://open-spaced-repetition.github.io/ts-fsrs/)).
- [Anki FAQ: spaced repetition algorithm](https://faqs.ankiweb.net/what-spaced-repetition-algorithm) — Anki; algorithmic background FSRS vs SM-2, optional deepening.
- [Lavanya Shukla on the agent flywheel](https://x.com/lavanyaai/status/2037589114170789951) — X thread from 2026 about products chosen by agents (Resend, Supabase, "First Successful Execution"); strong practical signal, not hard proof.
- Prework [\[3.3\]](https://platforma.przeprogramowani.pl/courses/10xdevs-3-prework/en/11) _Thread lifecycle and context management_ — context engineering Write/Select/Compress/Isolate; background for context assessment between phases.
- Prework [\[3.2\]](https://platforma.przeprogramowani.pl/courses/10xdevs-3-prework/en/10) _Prompting patterns and antipatterns_ — prompt/plan as a contract; background for `plan-brief.md` as a decision contract.
- Prework [\[1.2\]](https://platforma.przeprogramowani.pl/courses/10xdevs-3-prework/en/02) _Chatbot vs Agent vs Harness - definitions_ — background for understanding `/10x-research` and Context7 as tool use in the harness.
- Prework [\[4.2\]](https://platforma.przeprogramowani.pl/courses/10xdevs-3-prework/en/15) _Good and Bad Course Design_ — MVP with real business logic; background for treating SRS as business logic, not just another CRUD.
