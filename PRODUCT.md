# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Goonginga serves three audience groups, in this priority order for product and visual decisions:

1. Players and league participants.
2. Community members and spectators.
3. League managers and production staff.

The priority changes within operational surfaces. Managers and administrators are the primary users of the Manager Dashboard and administrative areas; production staff are the primary users of broadcast tooling. Each surface should optimize for the people performing its central job without turning the wider product into a generic administration interface.

Players need to understand the current state of the league and find teams, schedules, standings, matches, drafts, statistics, and results quickly. Community members and spectators need an active, entertaining destination worth revisiting beyond a single result. Managers need to run the league quickly without external spreadsheets or avoidable manual work. Production staff need reliable tools that integrate smoothly with broadcasts and OBS.

## Product Purpose

OTP Productions operates the Goonginga Overwatch League as its main product. Goonginga is the league's digital headquarters: player registration, Discord-based identity and community, team formation, schedules, matches, standings, statistics, drafts and bans, league administration, and broadcast production. Minigames such as Family Feud are secondary stream utilities with player join, host control, and OBS output—not standalone product ecosystems.

The product succeeds when:

- Players immediately understand what is happening in the league.
- Teams, schedules, standings, matches, drafts, and results are easy to find and understand.
- The league feels active, competitive, and professionally organized.
- Community members have reasons to return beyond checking one result.
- Interactive experiences feel fun and integral to the league rather than unrelated side tools.
- Managers can operate the league quickly without external spreadsheets or unnecessary manual processes.
- Production tools integrate smoothly with broadcasts and OBS.
- The website functions as the central hub of the Goonginga League ecosystem.

The product balances community entertainment with serious league management.

## Positioning

Goonginga is not merely a standings website or a tournament-management template. It is an integrated platform for both running and experiencing a community Overwatch league.

Its defining mechanism is the connection between league participation and live operations: Discord identity, registration, teams, randomized or managed team creation, schedules, matches, standings, statistics, drafts and bans, manager workflows, broadcast and OBS tooling, synchronized production state, and community minigames all belong to the same league ecosystem.

Goonginga should feel closer to a real esports league ecosystem than to a generic tournament product. Its personality comes from a community-driven culture that is competitive, playful, and closely connected to Discord and live broadcast rituals. Competition and statistics can be serious; community experiences can carry humor, personality, and energy.

## Operating Context

- Players register and identify through the Goonginga Discord community.
- League staff coordinate registration, captain selection, team formation, schedules, match rules, standings, results, and seasonal operations.
- Captains and managers use live draft and ban workflows tied to authoritative match state.
- Managers use operational tools for match control, result registration, statistics, and content management.
- Production staff use broadcast-oriented views and OBS-compatible tooling, including auxiliary Windows workflows.
- Public league pages communicate current and historical league activity to players, community members, and spectators.
- Minigames, including Family Feud, provide lightweight join and broadcast workflows for occasional community streams.

## Capabilities and Constraints

- Preserve existing league functionality, business logic, and integrations unless a clear technical reason requires a change.
- Preserve compatibility with existing OBS, broadcast, and Windows auxiliary tooling.
- Broadcast-oriented views prioritize readability, stability, and reliability.
- Manager and administrative tools prioritize speed, clarity, information density, and task completion over decoration.
- Public league pages may use more personality and visual energy while keeping competition and information legible.
- Family Feud remains playful and dramatic on air while its operator surface stays a compact stream-control utility.
- Image-based stat extraction is deprecated. Match statistics are entered and validated manually.
- Different product areas may use different levels of visual intensity while sharing one underlying system. They are modes of one product, not separate websites.
- Do not remove useful information in the name of minimalism.
- Do not break or obscure real workflows for visual effect.
- Public-facing product copy remains in English.
- Overwatch remains the core game and competitive context.

## Brand Commitments

- The Goonginga and GGL identity must remain recognizable.
- Goonginga is a community Overwatch league founded in 2023.
- Discord is a durable part of identity, authentication, and community.
- The product should feel community-driven, competitive, playful, energetic, and connected to broadcast culture.
- It must not be redesigned into a generic SaaS dashboard or tournament-management template.
- Avoid excessive glassmorphism, gradients, glow, rounded cards, and other generic AI-generated interface patterns.
- Surface modes share Goonginga product identity while emphasizing different qualities:
  - Manager Dashboard: structured, efficient, information-dense, and competitive.
  - Public league pages: polished, energetic, and esports-oriented.
  - Family Feud: playful, dramatic, interactive, and expressive.
  - Broadcast and OBS views: extremely clear, stable, and readable.

## Evidence on Hand

- Product architecture, roles, workflows, routes, and development commands are documented in `README.md`.
- The primary public and operational application is in `migration-uidesign/frontend`.
- Community minigames and Family Feud experiences are in `migration-uidesign/minigames-frontend`.
- Authoritative business logic, role enforcement, synchronized match state, and data persistence are in `migration-uidesign/backend`.
- Existing league history, teams, players, match data, media, broadcast assets, and season content are present under `migration-uidesign/frontend/public` and `migration-uidesign/frontend/src/data`.
- Existing Goonginga landing-page copy identifies eight completed seasons, 122 maps in Season 8, and a 2023 founding date. These claims are repository evidence and must remain tied to real source data rather than be generalized or fabricated.
- Existing Discord, Twitch, Instagram, and TikTok links are encoded in the public application.
- Existing OBS overlays, draft tools, manual stat workflows, and Windows launcher assets are implementation evidence that future work must preserve.
- No testimonials, revenue claims, or permission to invent player counts or competitive metrics have been provided. Future work must not fabricate them.

## Product Principles

1. **The league is the center.** Participation, competition, operations, and broadcast reinforce the same authoritative league state; minigames remain clearly secondary stream utilities.
2. **Community first, context always.** Prioritize players and community across the product, while letting managers and production staff become primary within the tools built for their work.
3. **Clarity makes competition credible.** League state, schedules, standings, matches, drafts, results, and broadcasts must be immediately understandable and reliable.
4. **Serious operations, lively culture.** Operational surfaces favor speed and density; community surfaces earn return visits through personality, humor, energy, and interaction.
5. **Truth and function outrank decoration.** Preserve real data, useful information, accessibility, responsive behavior, workflows, and integrations; never trade them for visual novelty.

## Accessibility & Inclusion

Accessibility, responsive behavior, readability, and information comprehension must improve rather than regress. Public, operational, interactive, and broadcast surfaces may differ in intensity, but all must preserve legible content, clear states, usable controls, and appropriate reduced-motion behavior. Broadcast views require especially strong distance readability and stable presentation.
