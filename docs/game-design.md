# SKLAVE — Game Design Document

## High concept

SKLAVE is a browser-based survival game and interactive political artwork about
time, labor, and unequal starting conditions in the postmodern economy. The
player is not asked to become powerful or accumulate wealth. Their immediate
purpose is deliberately smaller: keep one person alive for 100 days.

The game turns social privilege into different rates of time loss. Everyone
receives the same apparent objective and the same six actions, but the answers
given before play determine how forgiving the system will be. The player can
intervene, but they cannot make the starting conditions irrelevant.

## Design pillars

1. **Time is the only currency.** Work, care, health, shelter, and relationships
   are expressed through the character's remaining survival time.
2. **Starting conditions outweigh skill.** The setup answers materially change
   the initial buffer, passive drain, action value, and risk of collapse.
3. **Every intervention has a cost.** No action improves everything. Work buys
   time by spending body and mind; recovery consumes time; support depends on
   whether a support network exists.
4. **Survival is not meaning.** Completing the mechanical objective leads to a
   reflective question rather than a conventional victory celebration.
5. **The system remains legible.** The interface continuously shows remaining
   time, body, mind, condition, chapter progress, and the costs of every action.

## Audience and platform

- Platform: modern desktop and mobile browsers
- Format: short-form interactive editorial experience
- Input: pointer or keyboard; number keys 1–6 activate the six actions
- Language: all player-facing game content is German
- Visual style: a flat, monochrome floor plan with restrained signal orange,
  monospaced system typography, and serif narrative text

## Player journey

### 1. Introduction

Two cards explain the central resource, **Restzeit**, and make clear that the
six setup answers determine the character's conditions.

### 2. Conditions

The player answers questions about:

- housing
- family and social network
- savings
- debt
- physical health
- residency papers

Answers are not cosmetic. They feed directly into the simulation and determine
the player's mode.

### 3. Spielzeit

Before the simulation starts, the game presents the premise in German:

- life in the postmodern era is about to begin
- the mode calculated from the answers
- Chapter 1's objective: survive 100 days

### 4. Chapter 1 — Survive 100 days

One real second advances one in-game hour. Chapter 1 therefore represents 40
minutes of uninterrupted simulated time. The chapter succeeds when the elapsed
clock reaches 2,400 in-game hours while the character still has Restzeit. It
fails if Restzeit reaches zero first.

The current chapter and day remain visible throughout play. When the player
survives Day 100, actions lock and the final card appears:

> Du hast es geschafft, Sklave. Bravo. Jetzt frag dich: Was war der Sinn von
> alledem?

The player can then select **Weiter zu Kapitel 2**, which reveals a German
**Demnächst** card. Chapter 2 is intentionally undefined in the current scope.

## Modes

The mode is a label for systemic difficulty, not a class selected directly by
the player.

| Internal mode | German label  | Rule                                           |
| ------------- | ------------- | ---------------------------------------------- |
| `reich`       | Reich         | Privilege score of 9–10                        |
| `mittel`      | Mittelschicht | Privilege score of 5–8                         |
| `arm`         | Arm           | Privilege score of 0–4                         |
| `illegal`     | Illegal       | No valid residency papers; overrides the score |

The privilege score is intentionally simple and auditable:

- Housing: owned 2, with parents 1, rented 0
- Network: strong 2, thin 1, none 0
- Savings: months 2, weeks 1, none 0
- Debt: none 2, student loan 1, high 0
- Body: stable 1, chronically ill 0
- Papers: permanent 1, fixed-term 0

This label summarizes the setup but does not replace its individual effects. For
example, chronic illness drains time even when two profiles receive the same
overall mode.

## Core resources

### Restzeit

Restzeit is measured in hours and answers one question: how long can the
character survive if the player does nothing? It drains continuously. Savings
and housing determine the starting amount; housing, debt, network, health,
papers, and acquired conditions determine the passive burn rate.

### Body

Body ranges from 0 to 100 and decays over time. Low body creates illness, which
increases time drain. Work spends body; food, sleep, sport, friendship, and
medical care can restore it in different amounts.

### Mind

Mind ranges from 0 to 100 and also decays over time. Low mind creates
depression, increasing time drain and reducing the value of work. Recovery is
possible, but social actions are much weaker without an existing network.

## Actions

| Action       | Primary intent        | Structural trade-off                              |
| ------------ | --------------------- | ------------------------------------------------- |
| Work         | Gain Restzeit         | Loses body and mind; returns less under precarity |
| Eat          | Small recovery        | Costs a little Restzeit                           |
| Sleep        | Restore body and mind | Costs Restzeit                                    |
| Exercise     | Restore body and mind | Costs Restzeit and requires minimum health        |
| See friends  | Restore mind          | Depends heavily on the selected network           |
| Visit doctor | Restore body          | Large time cost, amplified by insecure papers     |

Cooldowns prevent the player from solving the system by repeating one action as
quickly as possible. Homelessness reduces the benefit of interventions, and
depression lengthens cooldowns.

## Systemic events and failure cascade

- Rent or housing costs are charged every 30 in-game days.
- A renter or person living with parents can lose housing near zero Restzeit.
- Homelessness accelerates drain and weakens all recovery.
- Low body causes illness; low mind causes depression.
- These conditions can overlap and reinforce one another.
- At zero Restzeit the character dies, the simulation stops, and the death card
  reports days survived and player interventions.

The cascade is designed to make recovery harder after a threshold has been
crossed. It dramatizes how a small initial disadvantage can compound rather than
presenting every turn as an isolated tactical puzzle.

## Chapter structure

The chapter system gives the game a concrete short-term purpose without
pretending that survival resolves its themes.

- **Chapter 1: Survive 100 days.** Implemented.
- **Chapter 2: Coming soon.** Placeholder only; its mechanics and narrative
  purpose should be defined in a future design pass.

Future chapters should preserve the core pillars, carry consequences forward,
and introduce a new question about labor or meaning rather than simply raising
the numerical difficulty.

## Success criteria

- Players understand the 100-day objective before entering the simulation.
- Players can see their mode and connect it to their setup answers.
- The day counter makes chapter progress readable during play.
- Surviving 100 days reliably stops the simulation and presents the final card.
- Continuing reliably replaces the ending with the Chapter 2 coming-soon card.
- Death before Day 100 continues to use the existing failure ending.
- All interactions remain usable without WebGL and with keyboard input.
