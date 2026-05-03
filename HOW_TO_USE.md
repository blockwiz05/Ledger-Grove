# How To Use Ledger Grove

## Requirements

Same as the root README: current **Node.js** (18.18+) and **npm**. No extra global CLI tools.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## Production run

```powershell
npm.cmd run build
npm.cmd run start
```

Open `http://localhost:3000`.

## UI flow

The app is now split into five screens:

1. `Owner Setup`
2. `Agent Registry`
3. `Automation`
4. `Agent API`
5. `Activity`

## What each screen does

### 1. Owner Setup

Use this to define:

- treasury owner ENS
- treasury vault ENS or wallet
- policy profile

This is the source of truth for all agents.

### 2. Agent Registry

Use this when you already have an agent running on your own server.

Register:

- name
- role
- ENS or subname
- wallet or ENS
- runtime URL
- trigger type
- whether it should participate in automation

Once registered, the agent is attached to a policy rail.

### 3. Automation

This screen drives the built-in demo agents from the server.

Default agents:

- `Market Steward` -> trader -> rebalance
- `Ops Relay` -> ops -> topup
- `Research Requester`
- `Founder Escalation`

To test the default trader agent:

1. Keep current stable ratio above target.
2. Click `Run Automation Now`.
3. The server prepares a live Uniswap `USDC -> ETH` plan.

To test the ops top-up flow:

1. Enable `Ops Relay` in the registry.
2. Set `Research USDC balance` below the top-up threshold.
3. Click `Run Automation Now`.

### 4. Agent API

This screen shows how your real external agent should interact with Ledger Grove.

Use `Policy Check API` before your agent acts.

Use `Action Report API` after your agent finishes executing.

### 5. Activity

Shows:

- automation events
- audit log
- reported actions from external agents

## How your real server agent should use this

### Registration

Your agent should register once:

```http
POST /api/agents/register
```

### Policy check before acting

Before swap or transfer:

```http
POST /api/policy/check
```

If response says `approved`, execute.

If response says `review`, either escalate or require extra approval in your runtime.

If response says `blocked`, do nothing.

### Report result after execution

After acting:

```http
POST /api/actions/report
```

This keeps the Ledger Grove audit trail in sync with your real runtime.

## Best hackathon demo

1. Show `Owner Setup`.
2. Show `Agent Registry` and add one of your own external agents.
3. Run `Policy Check API`.
4. Run server automation once to show the built-in trader role acting autonomously.
5. Report an execution result into the audit log.

## Notes

- Runtime state is stored in `data/runtime.json`.
- Uniswap quotes are live reads on Ethereum mainnet.
- ENS resolution is live when records exist.
- The app is best used as a control plane for existing agents, not as the final signing engine itself.
