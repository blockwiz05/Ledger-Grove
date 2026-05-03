# Uniswap Developer Platform Feedback

Project: Ledger Grove

## What worked well

- The Uniswap quote architecture is conceptually clean for agentic finance workflows.
- Public contract-based quoting on Ethereum mainnet made it possible to build a no-backend MVP quickly.
- The route concept is easy to explain in a treasury UX context.

## Friction encountered

- The official API path appears to require integrator setup and credentials, which adds hackathon friction when the goal is to get to a usable same-day MVP quickly.
- For fast prototypes, developers may fall back to direct contract reads instead of the API because it is easier to wire immediately.
- It would help to have a very explicit “hackathon mode” guide that compares:
  - API with key
  - contract reads
  - app deep linking
  - recommended path for agents

## Documentation gaps

- A concise single-page “agent treasury integration” guide would be useful.
- It would help to document the lowest-friction route for quote-only integrations where execution happens later in another system.

## Feature requests

- More starter examples for treasury assistants, policy engines, and quote-then-execute flows
- Clear guidance on when to prefer the API versus direct contract quoting for MVP builds
- A minimal example for building execution payloads that can be handed to another agent or executor

_Submitted as hackathon sponsor feedback for Ledger Grove (OpenAgents); integration uses Quoter V2 reads on mainnet only._
