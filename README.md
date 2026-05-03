# Ledger Grove

Ledger Grove is a Next.js MVP for the ETHGlobal OpenAgents hackathon: an ENS-powered treasury control plane where `sprucevault.eth` defines rules once, external agents register over HTTP, and every action is checked against treasury policy before execution.

## Prerequisites

- **Node.js** 18.18 or newer (20 LTS recommended)
- **npm** 9+

## What changed

The app is no longer just a browser simulation.

It now includes:

- a server-backed runtime state stored in `data/runtime.json`
- HTTP APIs for agent registration, policy checks, and action reports
- a server-run automation endpoint for default demo agents
- a multi-screen UI so the product reads step-by-step instead of one dense dashboard

## Core model

Your existing server agent should use Ledger Grove like this:

1. Register itself with a role, ENS/subname, wallet, and optional runtime URL.
2. Call `POST /api/policy/check` before executing a swap or transfer.
3. Execute only if the response says `approved` or `review`, depending on your runtime policy.
4. Report the result back with `POST /api/actions/report`.

That makes Ledger Grove the `policy + identity + audit plane`, while your own server remains the actual runtime.

## Main features

- Step-based UI:
  - `Owner Setup`
  - `Agent Registry`
  - `Automation`
  - `Agent API`
  - `Activity`
- ENS identity binding for treasury owner and agents
- Role-based policy rails for `founder`, `trader`, `ops`, and `research`
- HTTP API for existing external agents
- Server-backed automation run endpoint for built-in demo agents
- Live Uniswap V3 quote fetching for auto-generated swap plans
- Audit and automation event history persisted on the server

## HTTP API

### `GET /api/bootstrap`

Returns current runtime state plus treasury ENS resolution.

### `POST /api/runtime/config`

Updates:

- treasury owner config
- automation config

### `POST /api/agents/register`

Registers or updates an agent.

Example body:

```json
{
  "id": "market-steward-01",
  "name": "Market Steward",
  "roleKey": "trader",
  "ens": "trader.sprucevault.eth",
  "walletOrEns": "trader.sprucevault.eth",
  "runtimeUrl": "http://localhost:4001",
  "triggerType": "rebalance",
  "automationEnabled": true
}
```

### `POST /api/policy/check`

Checks whether an agent is allowed to perform an action.

Example body:

```json
{
  "agentId": "market-steward-01",
  "actionType": "swap",
  "amountUsd": 800,
  "slippage": 0.5
}
```

### `POST /api/actions/report`

Stores execution feedback from your real server agent.

Example body:

```json
{
  "agentId": "market-steward-01",
  "roleKey": "trader",
  "actionType": "swap",
  "status": "executed",
  "details": {
    "txHash": "0x123"
  }
}
```

### `POST /api/automation/run`

Runs the built-in demo automation cycle on the server:

- default trader agent prepares a rebalance if stable ratio is above target
- default ops agent prepares a top-up if research balance is below threshold

## Quick start

1. Install dependencies:

```powershell
npm.cmd install
```

2. Start development:

```powershell
npm.cmd run dev
```

3. Open `http://localhost:3000`

ENS and Uniswap reads use the HTTP RPC in `lib/config.js` (`RPC_URL`). Override there if your provider blocks public endpoints.

## Production run

```powershell
npm.cmd run build
npm.cmd run start
```

## Best demo path

1. Open `Owner Setup` and keep `sprucevault.eth`.
2. Open `Agent Registry` and show the built-in agents.
3. Open `Automation` and click `Run Automation Now`.
4. Show that `Market Steward` prepared a live `USDC -> ETH` route.
5. Open `Agent API` and run a policy check for `default-trader`.
6. Report a fake `executed` result to show how a real external runtime would report back.
7. Open `Activity` to show server-backed audit history.

## Important limitation

This project now supports real HTTP integration for your external agents, but it still does not perform unattended treasury signing by itself.

For fully autonomous onchain execution, connect the approved action payload to:

- KeeperHub
- a Safe or policy module
- your own signing/executor service

## Project files

- `app/page.js`: multi-step UI
- `app/api/*`: server endpoints
- `lib/config.js`: shared config and defaults
- `lib/policy.js`: shared policy logic
- `lib/chain.js`: ENS and Uniswap helpers
- `lib/runtime-store.js`: persistent runtime storage
- `data/runtime.json`: current server state
- `HOW_TO_USE.md`: operator guide
