---
title: "MVP Roadmap: Milestones, Dependencies, and Priorities"
course: "10xdevs-3"
language: "en"
source: "Przeprogramowani.pl"
exported: "2026-09-05"
format: "markdown"
---

![cover](https://images.przeprogramowani.pl/lessons/m2-l1/assets/cover-en.jpg)

Sprint zero is behind us - congratulations! The idea has been chewed over by `/10x-shape` and `/10x-prd`, the stack chosen, the repo prepared, the rules for the agent in place, the application in production.

A natural temptation? Copy `prd.md` into the agent’s window and write "build me an MVP from this." A week of after-hours work, presentation on Friday, let's go.

And then... well. The agent gets to work. Powered by the chosen LLM and all the characteristics of nondeterministic models, sometimes it will start with endpoints, and other times with the UI. Sometimes it will remember to add a migration to the database, and other times you'll find out about missing tables at runtime. In some cases, progress will proceed horizontally (layer by layer), and in others more full-stack.

Result? We produced something, tokens burned, but no repeatable effects.

This is not an agent error – it is rather a direct result of the architecture of the engine that drives it. The agent received too broad a goal, without expected directions for work, without priorities, and without indication of where the greatest risk lies. **The agent is working you.**

In module 2 we change this arrangement. In this lesson you step into the shoes of a Technical Project Manager: instead of asking "what to code now?", you plan a sequence of milestones together with the agent, ensure a feasible task order, and translate this into a backlog accessible to both the human and the agent.

Plan before coding.

### Programmer as Technical Project Manager

Before we return to the previously discussed project, let's first notice what kind of expectations the accelerating AI revolution may generate for the programmer.

In traditional organizations, even before the boom of agents, programmers usually worked on tasks that were part of a larger plan, but they did not always have influence over that plan. Company programs, portfolios, or so-called "work streams" were arranged by technical leaders, architects, and project managers. Today, it seems that acquiring even a part of the skills from these roles in our environment is a priority for effective work with agents and also a concrete way for personal upskilling. Therefore, we begin the second module with a brief discussion of the role of the TPM - Technical Project Manager.

A Technical Project Manager is a person who connects the product goal with the technical execution. They decide in what order the work proceeds, where the greatest risks lie, what blocks the start, who has time for what, and what consciously falls outside the scope. All this is to ensure that during the actual implementation phase, "things happen" as smoothly as possible.

In a traditional team setup, this task belonged to someone else. The programmer received a ticket "implement endpoint X," and the need, priorities, and trade-offs were already decided somewhere higher up.

Working with an agent changes this setup. The agent accelerates code writing but at the same time allows you to produce apparent progress much faster – if the work sequence is wrong, you end up with a growing application in which it is unclear whether the most important scenario for the project's recipient actually works.

![Diagram](https://images.przeprogramowani.pl/images/2026/05/pj4TarjVFuqkkdUPgI21sAI.jpeg)

Here the TPM’s skills can help, as they genuinely impact the effective support of agents. And by no means do we mean organizing meetings or status updates.

From now on, we start paying more attention to the project as a system of interconnected vessels, and each task as a small fragment of this system. We want to understand:

- **Goal** \- what exactly we want to have after the first milestone and why.
- **Sequence** \- what goes first, what goes second, what is put on the hold.
- **Risk** \- where the project might fail and what first reduces this risk.
- **Capacity and ownership** \- who (or which agent) does what, where synchronization points are needed, what can be done in parallel.

With these decisions, delegating agents becomes a more predictable contract. The agent receives not only the prompt "what to do," but also "this is milestone number one from a list of five and here are its dependencies."

🎥 **VIDEO**: [Watch here](https://player.vimeo.com/video/1193145324?badge=0&autopause=0&player_id=0&app_id=58479)

### Artifact chain

Being aware of how important it is to have a broader perspective on the tasks at hand, let's now move on to a roadmapping exercise - let's create a task diagram that we will complete together, step by step, with the agent.

The starting point will be artifacts you are familiar with. We will finish with a roadmap as a map of the next tasks to be completed this week.

![Diagram](https://images.przeprogramowani.pl/images/2026/05/zD4Tao3oC7fU7M8P9P3x2AI.jpeg)

What each file describes:

- **`shape-notes.md`** \- raw Socratic session. Decisions, open questions, consciously postponed decisions.
- **`prd.md`** \- production contract. User stories, FRs with priorities, success criteria, Non-Goals.
- **`tech-stack.md`** \- technical hand-off. Selected framework, databases, hosting, integrations, decisions about auth and the target deployment environment.
- **`roadmap.md`** \- sequence of tasks. Preparations, e2e slices, dependencies, blockers, unknowns.
- **Task (change-id)** \- operational unit of work. Status, owner, acceptance criteria, link to the roadmap.
- **`context/changes/<change-id>/plan.md`** \- per-change implementation plan. Architecture of one slice, steps, files.

Each of these artifacts is a separate zoom level on the same project. The PRD describes what we are doing and for whom. The tech stack describes what we use to do it. The roadmap describes in what order. The backlog describes what now. The plan describes how exactly.

Mixing these levels is one of the main reasons why chaos appears in projects. AI only amplifies that chaos. Mixing business needs with technical ones causes us to want to build everything in the same way, using our favorite framework. Failing to analyze the client's needs causes us to lose contact with the recipient of the work. Ignoring the exercise from the roadmap means that risks will appear five minutes before releasing an important feature. An agent — one or several — will only complicate all this. And that is exactly what we want to avoid.

In this lesson, we are building `roadmap.md` and something like a preliminary backlog. All this to avoid chaos.

### Vertical-first as the default strategy

The roadmap we are about to generate is based on so-called **vertical slices**. Each slice is one specific user flow that goes through all layers of the application – UI, data, logic, integrations – and ends with something the user can actually see and verify.

An alternative is **horizontal slicing** \- planning work by layers. First the entire database, then the entire API, then the entire UI. This is the natural way teams divided functionally (frontend, backend, data) think, and this is how the "foundations" naturally form in the minds of developers with more engineering experience.

With an AI agent, we want to proceed differently by default. Why?

- **Verifiability.** A vertical slice ends with something clickable. You can run an end-to-end test, take a screenshot, manually check that "the user pastes text and sees saved cards." A horizontal layer ends... with the existence of the layer. From the agent's perspective, this is a weak signal of whether they did a good job.
- **Integration.** A vertical slice enforces the integration of layers already at the first milestone. Interface conflicts reveal themselves immediately, not after two weeks of stitching together.
- **Illusory progress.** Horizontal slicing looks beautiful on the screen – directories full of files, database schemas, dozens of endpoints. The thing is, no user has yet seen what the product is really being made for.

For 10xCards (PRD from prework [\[4.2\]](https://platforma.przeprogramowani.pl/courses/10xdevs-3-prework/en/15)) bad and good decomposition look like this:

![Diagram](https://images.przeprogramowani.pl/images/2026/05/9j4TauPHIdHNnsEPyubr2QI.jpeg)

The `vertical-first` approach starts with the `north star slice` – the smallest working flow that proves the product hypothesis. In 10xCards, this could be, for example, S-01 "First gated generation loop": you paste text, you receive generated cards, you accept or reject each one individually, and the accepted ones end up in the deck. The product actually starts handling flashcards.

If this flow works, the project makes sense. If not – the rest of the plan is gymnastics around something that didn't work anyway.

#### What about the foundations?

"But wait, first I need the database and auth for anything to work" - yes, you are right. That's why there is also a `## Foundations` section in the roadmap.

Foundation (denoted `F-NN`) is a short, controlled preliminary task that does not have its own user-visible outcome but **unlocks a specific vertical milestone**. Each `F-NN` must have the field `Unlocks: S-NN` filled in – otherwise, it is simply a purposeless layer and gets parked.

Examples of justified foundations:

- `F-01 minimal-persistence-and-auth` \- minimal data model plus the concept of user session, **unlocks S-01** (without session we won't show "my" cards).
- `F-02 openrouter-privacy-spike` \- a short spike verifying privacy control options with the LLM provider, **unlocks S-01** (without this, we don't know if sending the user's text to the LLM meets the PRD requirements).
- `F-03 srs-library-spike` \- checking the contract of the selected SRS library, **unlocks S-03 review session** (PRD deliberately leaves SRS details for later).

Example of a misclassified foundation:

- "F-XX complete data model for all entities in the application" - without a specific downstream slice. This is horizontal drift disguised as a foundation.

The principle is simple - no foundation exists without specifying the target task. If you cannot point to a single, specific vertical milestone that this foundation unlocks, then this work does not yet have a place on the roadmap.

> **A brief note for 10xDevs veterans.** Earlier editions more often planned work layer by layer: first the foundations, then the gluing. This made sense in a mode where a person manually stitched the layers. In 2026, agents like Claude Code and Codex handle small, verifiable end-to-end tasks much better ([Best practices for Claude Code](https://code.claude.com/docs/en/best-practices), [Introducing Codex](https://openai.com/index/introducing-codex/)). That is why in 10xDevs 3.0 we consciously shift towards vertical-first - with allowed, limited enablers in the `## Foundations` section.

### Skill /10x-roadmap in practice

Ok, theory is enough. It's time to generate `roadmap.md`.

Let's start the same way as before - by downloading the skill package for this lesson:

```bash
npx @przeprogramowani/10x-cli@latest get m2l1
```

In the package, you get a new feature - `/10x-roadmap` \- a skill that reads `context/foundation/prd.md`, audits the repository for what has already been bootstrapped (frontend, backend/API, data, auth, deploy, observability), and sequences the work as a series of vertical milestones with foundations.

🎥 **VIDEO**: [Watch here](https://player.vimeo.com/video/1193146130?badge=0&autopause=0&player_id=0&app_id=58479)

The skill does not choose frameworks (that’s what `tech-stack.md` is for), does not design database schemas (that’s what `/10x-plan` is for, which we will introduce in the next lesson), and does not write an implementation plan for a single slice (that’s what `/10x-plan <change-id>` is for). It only decides **what goes first, in what order, and what unlocks what**. At this stage, we want to have a preliminary idea of how to break down the project work task by task.

Let's start by initializing the process:

```text
/10x-roadmap
```

The skill does four things in sequence:

**1\. Checks if the PRD is ready for roadmapping.** We start with a simple assessment on a 0-4 scale: whether the Vision section is filled, whether there are user stories with Given/When/Then, whether there is at least one must-have FR, and whether the Business Logic has meaningful content (not `# TODO: domain rule`). A score < 3 stops the process at your decision: the skill recommends closing the PRD, but allows you to consciously continue and raise the deficiencies as blocking unknowns.

This is a deliberate safeguard. A roadmap generated from a flawed PRD will inherit the gaps as "blocked slices" – and will mainly be a list of things you don't yet know. Sometimes such a result is useful, but let's not pretend then that we have a ready execution plan.

**2\. Audits the project code.** The skill launches parallel subagents across six layers – frontend, backend/API, data, auth, deploy, observability – and each returns a one-line verdict: present, partial, or absent, with a link to the supporting file. This replaces the question "what do you already have in the project?" – the code itself is the most reliable source. If you work in a stack other than `web`, you can adapt this part to your needs.

**3\. Conducts a minimal interview.** The skill does not want to play a full product interview. It only asks the questions that the PRD and baseline themselves did not close:

- **Sequencing goal** (`main_goal`) - time / market feedback / quality / availability / learning. Each option leads to a different order when two slices are equivalent.
- **North star** (`north_star`) – the overarching direction and the smallest working flow that proves the product thesis. It usually points to the highest priority user story.
- **Main risk** (`top_blocker`) - decisions / time / availability / external factors / knowledge / motivations / lack. It influences what the skill parks more aggressively.

This is a deliberate compromise. We don't want to return to a model where all the planning work falls on the developer: you read the PRD, manually outline dependencies, search for gaps in the repository yourself, and still make sure the backlog doesn't drift into layered work. That's why we have an agent—to leverage its ability to quickly read artifacts, compare options, and propose a sensible sequence.

But we also don't want an "AI-autopilot" mode where the agent quietly decides what the most important product flow is and which risk should be tackled first. These three questions are a human checkpoint. The agent comes with a recommendation, justification, and 1-2 alternatives, and you approve or correct the decisions that actually set the roadmap.

Each question has one recommended option, along with a specific justification ("Vision says 'launch before X' plus `timeline_budget: 1 week` \-> recommend `speed`"), 1-2 alternatives, and an option "something else - I will explain". The interview is no longer than three questions (with a slight exception for projects with an unusual MVP shape).

**4\. Generate the `context/foundation/roadmap.md` artifact.** From the PRD we build vertical slices, from the initial project reconnaissance we extract layers marked as `absent` or `partial` (candidates for foundations), we set the order (foundations first, north star as early as preliminary requirements allow), we close the `backlog handoff` and park what you consciously reject.

The skill is designed so that roadmaps generated between consecutive sessions should have a consistent structure. The only exception is the `## Streams` section – this section appears only when the task dependency graph is branched enough that an additional map of "major streams" is truly helpful.

```text
## Vision recap
## North star
## At a glance
## Streams (opcjonalnie)
## Baseline
## Foundations
## Slices
## Backlog Handoff
## Open Roadmap Questions
## Parked
## Done
```

The above list is a starting point, not a rigid standard. After a few iterations, you will probably see that your project could use an additional field in the slice, another section at the beginning, or more concise statuses. Just open the `SKILL.md` file in the package and adjust the format to suit yourself – a skill is an artifact that can evolve along with your workflow.

If you are working in a team, there is an additional dimension – the natural rhythm of the entire group's work. A roadmap created weekly, accounted for per sprint or per release, looks different. It is worth having the agent generating `roadmap.md` know your conventions: names of work streams, priority markings, the way prerequisites are grouped, review frequency. The closer the output is arranged to your current process, the easier it is to convince the rest of the team to realistically work with this roadmap instead of parallel sources of truth.

#### The anatomy of a single slice

Each slice in `## Slices` has the same set of fields. Filled for 10xCards S-01 look roughly like this:

```markdown
### S-01: First gated generation loop

- **Outcome:** User can paste source text, request a card batch, accept/reject each
  candidate, and finalize accepted cards into the deck.
- **Change ID:** first-gated-generation
- **PRD refs:** US-01, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012
- **Prerequisites:** F-01 (minimal-persistence-and-auth), F-02 (openrouter-privacy-spike)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Czy OpenRouter privacy mode pokrywa wymaganie z PRD? — Owner: ty. Block: yes.
- **Risk:** This slice is the product wedge — if it doesn't work,
  nothing downstream matters. Sequenced first because everything else is
  read/edit on top of cards this loop produces.
- **Status:** blocked
```

The `blocked` status lights up automatically when at least one Unknown has `Block: yes`. Until you resolve the question about OpenRouter privacy, the slice is not ready for implementation. This is good news - the skill tells you directly what you don't know _before_ you run into it during coding.

The **Outcome** field always starts with a verb: "user can ...". This is a quality control – if you can't write this sentence, the slice is probably not vertical, and your focus remains on independent layers.

The **PRD refs** field must contain specific identifiers from the PRD. After generation, the skill performs a `self-review` and ensures that each must-have section from the PRD is included in at least one slice – otherwise, some requirement may "get lost in the roadmap".

The **Risk** field is a single sentence answering the question "why are we making this decision _here_ in the sequence." A reader will review the roadmap in six months and understand why the choice made sense.

#### What the skill consciously does not do

`/10x-roadmap` does not estimate work time - in the era of AI Agents this is really challenging. There is no "Day 1", "Week 2", t-shirt sizes, or story points. This is a conscious decision, consistent with the realities of working with virtual collaborators.

Additionally, task execution with the agent is nonlinear - one slice can take an hour or two evenings, depending on how many corrections it requires in the plan-implement-review loop. Made-up estimates would give a false sense of control. The execution order is determined by `Prerequisites`, the pace by `Blockers` and `Unknowns`.

The skill also does not choose frameworks, create database schemas, or define API endpoints. All of this is the task of proper planning and implementation, which we will address in the following lessons.

### 10xCards Roadmap: one concrete thing

The current 10xCards roadmap starts with two `foundations` tasks and five functional slices. Looking at it from a bird's-eye view, it looks as follows:

| ID   | Change ID                       | Outcome                                       | Prereq | Status   |
| ---- | ------------------------------- | --------------------------------------------- | ------ | -------- |
| F-01 | gate-product-routes             | Product routes are protected by login         | —      | ready    |
| F-02 | first-prod-deploy               | First production deployment is ready          | —      | ready    |
| S-01 | first-gated-generation          | Inserted text generates saved draft cards     | F-01   | proposed |
| S-02 | atomic-save-to-deck             | Candidates are evaluated and saved atomically | S-01   | proposed |
| S-03 | deck-edit-delete                | Deck allows browsing, editing, and deleting   | S-02   | proposed |
| S-04 | srs-review-session              | First review saves card rating                | S-02   | blocked  |
| S-05 | account-deletion-with-retention | Account deletion has a 30-day retention       | F-01   | proposed |

The most important thing: the north star here is not just generating cards. In this roadmap, the north star is S-04, which is the first card assessment in the review session. Only then do we know that the entire product idea worked from start to finish: the user pasted their own material, received proposals from AI, accepted the selected cards, saved them to the deck, and used them in the spaced repetition mechanism.

This clearly shows that the north star is not always the first slice in the queue. S-01 and S-02 are necessary because without them there are no cards to review. However, S-04 is a validation milestone - the first point at which the product thesis truly comes together. That's why the roadmap moves it as early as dependencies allow, but it doesn't pretend that you can start with the review if a recorded deck doesn't yet exist.

F-01 is a small foundation, not a separate "auth project." The login skeleton already exists in the baseline, so the foundation is limited to securing the product paths and refining the landing page. F-02 proceeds in parallel: the production deployment does not build a user-visible function but allows checking privacy and responsiveness in real conditions.

The block on S-04 is also substantial. The roadmap doesn't say "let's build the SRS someday." It says: before you plan a review session, choose the SRS library because it will impose the structure of `ReviewState`, the rating scale, and the policy of "what happens after editing a card." This is exactly the type of unknown that should surface on the roadmap, not only in the middle of implementation.

The roadmap does not have a separate `Acceptance criteria` field, but it provides material from which you can derive them when creating a backlog item: `Outcome`, `PRD refs`, `Risk`, `Unknowns`, and status. For S-02, such criteria can be recorded as follows:

- Each candidate requires explicit acceptance or rejection.
- `Save` works atomically: all accepted drafts go to the deck or none do.
- Drafts with `pending` and `rejected` do not go into the deck.
- After saving, the user sees the basic list of saved cards.
- The state logic of `FlashcardDraft` is tested because this is where the business rule is finalized: the card starts as an AI proposal but ends up in the deck only after a human decision.

These are the sentences that should be entered into the backlog item as acceptance criteria and provided further as context for the agent in `/10x-plan atomic-save-to-deck`.

> **A small note.** `main_goal` in this roadmap is `speed`, and `top_blocker` is `time`. Therefore, observability, preview environment per PR, own SRS algorithm, PDF/DOCX import, and manual card creation go into `Parked`. The roadmap is not a complete wishlist - it is a decision on what we deliver first to validate the product hypothesis as quickly as possible.

### Backlog as the project memory

The roadmap helps you decide what to build and in what order, but remember – the project doesn’t live only in your head or in a single markdown file. That’s why, to complete this lesson, we want to ensure full transparency and at the same time get to know other important extensions of collaboration with the agent.

So far, our roadmap, as a task backlog, has answered simple questions: what are we working on now, who is leading it, what is blocked, what is waiting for review, what can be taken next. Without this, the project status spreads across Slack, DMs, PR comments, and the memory of a few people. You go on vacation, get sick, take time off – and there’s a bottleneck. Everything seems clear until one person disappears for two days.

Now we also want to take care of external communication. The boss, client, PM, or stakeholder can access Jira, Linear, GitHub Projects, or a public roadmap board and see the project from a bird's-eye view. What is in progress. What is blocked. What is waiting for additional resources. What has fallen outside the scope of work. They don’t have to ping you every three hours asking, "So how’s it going?".

This proactive communication "to the outside" is really a good remedy for micromanagement. Not because the tool magically fixes the work culture. It’s simply that a visible project status reduces the need for constant checking in. If the backlog is up to date, the conversation can focus on decisions and risks, rather than manually asking about status.

`roadmap.md` fulfills only half of these assumptions - it works at the project level but does not provide clarity for people outside the team.

Hence the external backlog, in a more classical form with UI - Jira, Linear, GitHub Projects, plus one of dozens of other tools - as the **operational memory of the project and a lower entry barrier for everyone in the company**.

Backlog does things that a markdown file does not do out-of-the-box:

- **Status** \- backlog/ready/in-progress/blocked/in-review/done, visible immediately.
- **Ownership** \- who is responsible for the issue, who currently has the context on it.
- **Dependencies** \- link between issues, automatic unlocking after closing the prerequisite.
- **Acceptance criteria** \- visible to everyone who opens the ticket, no need to search in the roadmap.
- **Audit trail** \- who moved the ticket, when, why (comments).

The question that only now begins to make sense: how to hook an agent into this?

### MCP and CLI: the agent gains access to the task system

We finished the previous module by gaining access to the infrastructure from the terminal - using a CLI such as `wrangler`. Here we add another variant of the agent's access to an external system: this time concerning issue trackers.

This allows the agent to have controlled, tool-based access to the backlog: reading issues, creating new entries, updating statuses, or adding comments. In other words, doing what you normally do through the UI - just via explicitly described tools. All on your behalf - upon clear request, as a side-effect of a hook, another skill, or in automation. When these external resources are updated by the rest of the team, the agent can successfully prepare, for example, a morning report of tasks waiting for you or summarize the day by listing all current achievements.

Depending on service support, the options will be CLI (e.g., Github) or MCP (e.g., Linear).

The entire work scheme can be based on three types of actions and queries:

- **Read** \- "show me open tasks in the 10xCards project with the label `ready`", "show me the acceptance criteria for TEN-14".
- **Create** \- "create issue 'First gated generation loop' with acceptance criteria, dependencies, and label `north-star`".
- **Update** \- "change status TEN-14 to `in-progress`", "add a comment with a link to the PR".
  ![Diagram](https://images.przeprogramowani.pl/images/2026/05/Fz8TavamFNSCkdUPzM7oyAI.jpeg)

In our lesson, we will see how easy it is to leverage the potential of the already mentioned Github CLI and the new MCP Linear:

- **Linear MCP** \- <https://linear.app/docs/mcp> \- the official MCP server for the Linear service, with OAuth authentication, compatible with any popular agent (Claude Code, Cursor, Zed, and others).

Linear MCP operates as a remote MCP server at `https://mcp.linear.app/mcp`. Today, you can easily integrate it into your agent tool depending on the option:

#### Claude Code

```
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
```

#### Codex

```
codex mcp add linear --url https://mcp.linear.app/mcp
```

#### Cursor

The official MCP marketplace contains the Linear connector - [Cursor Marketplace](https://cursor.com/marketplace).

---

After connection and authorization, the agent has access to Linear system tools.

The first interaction may involve directly translating the roadmap into a working system in this very tool – this will result in labels, tasks, projects, or dependency diagrams between tasks.

🎥 **VIDEO**: [Watch here](https://player.vimeo.com/video/1193148810?badge=0&autopause=0&player_id=0&app_id=58479)

#### For the ambitious: an agent as the backlog caretaker

If you like this direction of work, there is plenty of room here for experimentation. An agent with access to the issue tracker is one of the most accessible ways to introduce AI automation into a team's workflow. It doesn't have to start working on production code from day one, yet it still genuinely improves work quality.

What exactly can such an agent do in the role of a backlog caretaker? A few ideas from different levels of ambition:

- **Daily cleaning.** Identification of tickets that have not moved for several weeks, closing duplicates, marking tasks without an owner or without acceptance criteria.
- **Context update.** Adding links to PRs in issues, linking tasks with matching slices from the roadmap, adding comments with fresh team decisions.
- **Triage of incoming reports.** Tagging new tickets, proposing priority based on project definition, suggesting an owner based on work history in the given area.
- **On-demand reports.** Morning summary of what is blocked, what is waiting for review, what has fallen off the radar, plus a brief recommendation "what to focus on first".

The value of this approach? Even if the agent makes a mistake, the cost of fixing it is low. You'll change the status, retract the comment, add the missing field. No mistake crashes production or introduces a bug into the code. At the same time, the benefit grows quickly because a backlog that someone actively manages is much more useful than a list of outdated tasks that no one looks at.

This is a good starting point for a broader reflection on where else in your work AI can add value without directly touching production code.

#### Agent's access boundaries to the backlog

Here returns the same question that is worth asking every time an agent accesses an external system: **is this access absolutely necessary for the agent to do what it needs to do?**

The backlog is generally safer than production. Mixing up statuses does not crash the database. But still - rotating statuses, deleting issues, adding comments "from you" to a thousand tickets - these are actions visible to the team and leave a trace in the logs.

Practical rules beyond the MVP scale:

- **Token with limited permissions.** Do not issue an admin token to the agent when you only need reading and creating issues in one project.
- **"Destructive" actions only from the UI level.** Deleting a project, changing roles, bulk status changes - clicking in the panel costs 30 seconds, cleaning up after an automatic mistake takes several hours.
- **Audit log.** Linear, Jira, and enterprise alternatives have built-in activity logs. Check them once after the first session with the agent to see what the agent actually did.

A new layer comes into the team: can an agent change the statuses of _other_ people's issues, or only their own? Can they comment on others' tickets? These are decisions worth settling within the team before the agent gets broad access.

## 🧑🏻‍💻 Practical tasks

- **Generate a `roadmap.md` for your project.** Download the `m2l1` package and run `/10x-roadmap` in the repo with the ready `context/foundation/prd.md`. Approach the interview consciously – decide for yourself on the `main_goal`, `north_star`, and `top_blocker` instead of clicking the default recommendations. Goal: a roadmap with at least one slice in the `ready` status, a clearly indicated north star, and no orphaned foundations. If all slices are `blocked`, treat this as a signal that the PRD requires completion or clarification.
- **(Optional) Move the roadmap to an external backlog via an agent.** By creating a free account in the service, use Linear MCP or GitHub CLI to create a tangible, public project roadmap. Ask the agent to create issues from the `## Slices` section – the title from `Outcome`, a description containing `PRD refs`, `Prerequisites`, and `Risk`, labels `slice` / `foundation` / `north-star`. Goal: a backlog visible to someone outside the development team, with mapped dependencies between tickets and without manually clicking in the UI. Show off the result at the 10xDevs Arena.

## Deep Dive

### Why the recommendation has changed since 10xDevs 2.0

Some of you may remember that in earlier editions of 10xDevs, working with agents was more horizontal.

This made sense with the limited potential and capabilities of models, where a person more often manually pieced together layers and "fixed after AI." Writing the schema by hand, then writing endpoints by hand, then writing components by hand – that was the natural sequence because each of these steps required the same pair of hands.

In 2026, agents like Claude Code and Codex (and soon probably dozens more) are truly changing this arrangement. From Anthropic's documentation ([Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)) and the description of how Codex works ([Introducing Codex](https://openai.com/index/introducing-codex/)), one significant workflow change emerges: **an agent performs best when given a narrow task with a verifiable result**.

A vertical slice implements exactly this assumption. The horizontal layer "create database schema" has no verifiable result beyond "there is a migration file" – this is a weak signal of whether the schema is good. The vertical slice "user pastes text and saves the first card" has clear success criteria and can be tested end-to-end (even manually, and in the final version – with tests).

The more observant will probably recognize that we heavily rely on decades of industry experience. Agile Alliance has long described how to [split user stories](https://agilealliance.org/glossary/story-splitting/) while maintaining measurable business value. [Story mapping](https://agilealliance.org/glossary/story-mapping/) places even greater emphasis on the "walking skeleton" — a minimal but actually functioning version of the product as the first milestone. Vertical-first in working with an agent is a practical application of these principles in a new role arrangement: the agent executes, you steer. And we implement this in practice.

What does this mean for you? If you have ever planned projects in layers, your engineering intuition is not wrong. Purely technical and more layered tasks still exist in the `## Foundations` section of the roadmap, but they can no longer be orphaned - each foundation must point to a specific user-visible slice that it unlocks.

### What to do if your project really needs horizontal-first

There are projects where the first move is actually horizontal. Three typical situations are, for example:

- **Integration with legacy.** Without an adaptation layer to the existing database or API, it is impossible to start a vertical slice. Then F-01 is an integration spike with a specific `Unlocks: S-01`.
- **Compliance/security requirement.** A regulatory requirement (e.g., GDPR plus retention details) requires a decision about the data model before anything can be shown to the user. Then F-01 is work on the data model with `Unlocks` indicating the slice that could breach compliance.
- **Performance-critical core.** Some projects (real-time, embedded, low-level systems) require an early architectural decision, where a bad version will block the entire project. Then F-01 is an architectural spike with `Unlocks` pointing to the first demonstration flow.

In each of these situations, horizontal work is **specific, limited, and pinned to a specific vertical slice**. It is never "first the entire database, then the entire API." The skill `/10x-roadmap` addresses this by enriching the `## Foundations` section and assigning the `blocked` status to slices that are blocked by these foundations.

If you are reading the generated `roadmap.md` and see that you have five F-NN, but no vertical slice has the status `ready`, it is a signal that either the PRD is overloaded with technical requirements or `/10x-roadmap` misinterpreted the baseline. You can consult all less typical scenarios on the course platform.

Good luck!

## Additional Materials

- **Best practices for Claude Code** / Anthropic / <https://code.claude.com/docs/en/best-practices> \- why narrow, verifiable tasks work better when working with an agent than broad commands.
- **Story Splitting** / Agile Alliance / <https://agilealliance.org/glossary/story-splitting/> \- classic rules for splitting user stories while preserving business value.
- **Story Mapping** / Agile Alliance / <https://agilealliance.org/glossary/story-mapping/> \- "walking skeleton" as the first milestone and conceptual basis for vertical-first roadmapping.
- **A Tale of Slicing and Imagination** / Agile Alliance experience report / <https://agilealliance.org/resources/experience-reports/a-tale-of-slicing-and-imagination/> \- a practical description of why horizontal slicing looks attractive in teams with strong specializations and why it is a weaker strategy from the product perspective.
- **What is a Project Roadmap** / Atlassian / <https://www.atlassian.com/agile/project-management/create-project-roadmap> \- embeds the roadmap in the classic concept of project management (goals, milestones, dependencies); omits time estimates, which `/10x-roadmap` consciously rejects.
- **Project Manager Roles and Responsibilities** / Atlassian / <https://www.atlassian.com/en/work-management/project-management/project-manager> \- PM duties as a role connecting the goal with execution; explains why "TPM" is a good mental model for a developer with an agent.
- **Model Context Protocol - Server Concepts** / MCP / <https://modelcontextprotocol.io/docs/learn/server-concepts> \- minimal mental model: tools, resources, prompts, user consent.
- **Linear MCP Server** / Linear / <https://linear.app/docs/mcp> \- documentation of the official Linear remote MCP server (OAuth, compatibility with main clients).
