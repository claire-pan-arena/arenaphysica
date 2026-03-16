# DS Operating System — North Star

> This document exists to keep this project honest. As the codebase grows, as AI agents rewrite components, as new features get proposed — come back here. If a change doesn't serve this North Star, it doesn't ship.

---

## The Thesis

Arena's Deployment Strategist is the most important role in enterprise AI. The DS guide says it plainly: few individuals can be talented at product, customer support, project management, and strategy at the same time. The job is exceptionally challenging. And the single KPI is usage — everything a DS does exists to drive adoption of Atlas within the customer.

Today, the tooling available to a DS is generic: Notion pages, spreadsheets, Slack threads, calendar invites, and memory. None of these tools understand what a deployment is, what a customer champion is, what an expansion signal means, or why a stale relationship with a VP is a different kind of risk than a stale relationship with a data engineer. The DS carries the entire context model in their head, and when that head is running on 3 hours of sleep in a hotel in a city they've never been to, things fall through.

This project exists to build the operating system that makes that impossible.

---

## What This Is

The DS Operating System is the tool that a Deployment Strategist opens first thing in the morning and the last thing they check before logging off. It is the single place where a DS tracks:

- Which deployments they own and how healthy each one is
- Which customer groups they're engaged with, and the people within each group — their roles, their sentiment, when they were last contacted, whether they're champions
- What workstreams are active, who owns what, and where the deadlines are
- Every meeting that has happened — who was there, what was discussed, what action items came out, and whether the agenda was sent 24 hours before and the recap within 24 hours after
- Expansion signals: hints from customers that there's appetite for broader adoption
- Competitive intel: what other tools the customer has evaluated or is evaluating
- Their own weekly P0/P1/P2 priorities, with a forcing function to set them at the start of each week and reflect at the end
- Internal Arena work — PRDs, playbook contributions, cross-team initiatives — alongside deployment work, so nothing gets siloed

And sitting beside all of this, a co-pilot that can query it, update it, analyze it, and proactively surface risks before they become problems.

---

## What This Is Not

This is not a CRM. It is not Salesforce. It is not a project management tool. It is not Jira or Asana or Linear.

Those tools are built for generic workflows. This tool is built for one specific workflow: running a deployment of an AI product within a large enterprise customer. Every entity in the data model, every view in the dashboard, every prompt in the co-pilot is designed around the specific reality of what a DS does every day, as defined by Arena's own DS guide.

If a feature request doesn't map to a real pain point in a DS's week, it doesn't belong here. If a view doesn't answer a question a DS actually asks, rip it out. If the co-pilot starts giving generic advice instead of grounded-in-data analysis, retrain it.

---

## The Three Pillars

Every feature and design decision must serve at least one of these. If it serves none, kill it.

### 1. Instant Situational Awareness

A DS opens the dashboard and within 5 seconds knows: what's on fire, what's on track, and what needs their attention today. This means the Command Center is the most important view. It must be fast, dense, and honest. Red means something is actually wrong. Green means something is actually fine. Amber means pay attention. No false positives. No vanity metrics.

The weekly sprint view is part of this: a DS should start every Monday by declaring their P0/P1/P2 items and end every Friday by reflecting on what actually happened. This creates the rhythm of a deployment, which is the only defense against chaos.

### 2. Institutional Memory

Every meeting, every decision, every org change, every competitive data point, every expansion signal — captured once, retrievable forever. When a DS preps for a meeting, the system already knows: who will be there, what their sentiment was last time, what action items are still open, what expansion signals they've dropped. When a DS transitions off a deployment, their replacement doesn't start from scratch — they inherit a complete record of every conversation and relationship built.

The meeting log is the most important data entry point in the entire system. It must be fast enough that a DS fills it out immediately after every call, not "later." If the meeting form is slow or annoying, the institutional memory dies and the whole system becomes a fancy task tracker.

### 3. Proactive Intelligence

The system doesn't just track — it thinks. It knows that a champion who hasn't been contacted in 10 days is a risk. It knows that neutral sentiment for 3 consecutive meetings is a trend, not a blip. It knows that an expansion signal combined with a stale relationship is a missed opportunity. It knows that a task due in 2 days that's still marked "to do" is probably going to slip.

The co-pilot is the primary vehicle for this, but proactive intelligence should also surface in the Command Center (the "Needs Attention" card, the relationship alerts, the expansion signals view). The goal: no DS should ever be surprised by something the system could have told them.

---

## Principles for Building

**The DS guide is the soul of the system.** Every design decision should be traceable back to a responsibility or lesson in the guide. "Send the agenda via email 24 hours in advance" -> the meeting form has an agenda_sent checkbox and the system nudges you when it's not checked. "Name every user, their role, team, pain points, and their fun fact" -> the person model has all these fields and the co-pilot can quiz you. "Hunt for expansion opportunities" -> expansion signals are a first-class field in every meeting log.

**Speed of data entry is existential.** If it takes more than 30 seconds to log a meeting's key data (sentiment, notes, action items), the system will be abandoned. Every form should have smart defaults, keyboard navigation, and the minimum number of required fields. Better to capture 80% of the data in 30 seconds than 100% in 5 minutes, because 5 minutes means "I'll do it later" which means never.

**The data model is the product.** Views and UI can be rebuilt. The co-pilot can be retrained. But the data model — the entities, relationships, and fields — is the foundation. Get it right and everything built on top works. Get it wrong and no amount of UI polish saves it. The current data model was designed by walking through a real DS's week and mapping every piece of information they need to track. Don't add tables to be clever. Don't remove fields to be minimalist. Change the model only when a real DS workflow demands it.

**Shared intelligence compounds.** When one DS is using this, it's a personal tracker. When every DS is using it, it's an intelligence platform. Competitive intel becomes a searchable database. Meeting templates become shared playbooks. Engagement patterns become benchmarks. The system should be designed from day one to support this — user-scoped data with intentional shared layers — even if multi-DS support ships later.

**The co-pilot is a DS, not a chatbot.** The co-pilot's system prompt includes the full DS guide. It should think like a DS, prioritize like a DS, and flag risks like a DS. When it surfaces an alert, it should explain why it matters in DS terms ("Tom Walsh is a champion and you haven't contacted him in 12 days — if he goes cold, the expansion proposal loses its sponsor"). Generic AI advice ("Consider following up with your contacts periodically") is a failure.

---

## The Measure of Success

This project succeeds when:

1. Every DS at Arena opens it every morning before they open anything else
2. When asked about any detail of any deployment — a person's role, the last meeting's action items, the competitive landscape — the DS's first instinct is to check the dashboard, not to search their email or memory
3. A new DS can be onboarded to an existing deployment by reading the dashboard for 30 minutes instead of being verbally briefed over 2 weeks
4. Leadership can see the health of every deployment at a glance without asking each DS for a status update
5. The sentence "I didn't know about that" becomes rare — because the system told them

This project fails when:

1. DS'es stop logging meetings (the meeting form is too slow or annoying)
2. The Command Center becomes a wall of green when things aren't actually green (false confidence)
3. The co-pilot gives generic advice disconnected from the actual data
4. It becomes "another tool to maintain" instead of "the place where I work"

---

## A Note for Future AI Agents Working on This Codebase

You will be tempted to add features, refactor patterns, and optimize code. Before you do, read this document. Then read the DS guide. Then look at the data model. If your change doesn't serve instant situational awareness, institutional memory, or proactive intelligence — and if it can't be traced back to a real DS workflow — stop and ask why you're making it.

The goal is not to build a beautiful application. The goal is to build the tool that turns Arena's Deployment Strategists from talented individuals into a legendary team. Every line of code either serves that goal or it's dead weight.
