"use client";

import { useEffect, useMemo, useState } from "react";
import { createWalletClient, custom } from "viem";
import { mainnet } from "viem/chains";
import { POLICY_PROFILES, ROLE_BLUEPRINTS, ROLE_NAME } from "../lib/config.js";
import { buildPolicySummary, estimateRoleRisk } from "../lib/policy.js";

const STEPS = [
  { key: "owner", label: "1. Owner Setup" },
  { key: "registry", label: "2. Agent Registry" },
  { key: "automation", label: "3. Automation" },
  { key: "api", label: "4. Agent Calls" },
  { key: "activity", label: "5. Results" },
];

const EMPTY_API_TEST = {
  agentId: "default-trader",
  actionType: "swap",
  amountUsd: "800",
  slippage: "0.5",
};

export default function Page() {
  const [step, setStep] = useState("owner");
  const [state, setState] = useState(null);
  const [walletIdentity, setWalletIdentity] = useState(null);
  const [ownerResolution, setOwnerResolution] = useState(null);
  const [treasuryResolution, setTreasuryResolution] = useState(null);
  const [resolvedAgents, setResolvedAgents] = useState([]);
  const [ownerForm, setOwnerForm] = useState({
    teamRoot: "0xvinit.eth",
    treasuryInput: "vitalik.eth",
    policyProfile: "balanced",
  });
  const [automationForm, setAutomationForm] = useState({
    enabled: true,
    currentStableRatio: 72,
    targetStableRatio: 60,
    treasuryUsd: 18000,
    researchUsdcBalance: 25,
    researchTopupThreshold: 50,
    researchTopupAmount: 100,
    cycleSeconds: 15,
  });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    roleKey: "ops",
    ens: "",
    walletOrEns: "",
    runtimeUrl: "",
    triggerType: "topup",
    automationEnabled: true,
  });
  const [policyTest, setPolicyTest] = useState(EMPTY_API_TEST);
  const [policyResponse, setPolicyResponse] = useState(null);
  const [reportPayload, setReportPayload] = useState({
    agentId: "default-trader",
    roleKey: "trader",
    actionType: "swap",
    status: "executed",
    details: "{\"txHash\":\"0x-demo\"}",
  });
  const [latestMessage, setLatestMessage] = useState("Loading runtime state...");

  useEffect(() => {
    void refreshState();
  }, []);

  const selectedRole = ROLE_BLUEPRINTS.find((role) => role.key === "trader") || ROLE_BLUEPRINTS[1];
  const policySummary = buildPolicySummary(
    selectedRole,
    ownerForm.policyProfile,
    ownerForm.teamRoot,
  );
  const roleRisk = estimateRoleRisk("trader");
  const latestAction = state?.latestAction || null;
  const activeProfile = POLICY_PROFILES[ownerForm.policyProfile] || POLICY_PROFILES.balanced;
  const activeAgents = useMemo(
    () => (state?.agents || []).filter((agent) => agent.automationEnabled),
    [state],
  );
  const resolvedAgentMap = useMemo(
    () => Object.fromEntries((resolvedAgents || []).map((entry) => [entry.id, entry.resolved])),
    [resolvedAgents],
  );

  async function refreshState() {
    const response = await fetch("/api/bootstrap");
    const data = await response.json();
    if (!data.ok) return;
    setState(data.state);
    setOwnerResolution(data.ownerResolution);
    setTreasuryResolution(data.treasuryResolution);
    setResolvedAgents(data.resolvedAgents || []);
    setOwnerForm(data.state.ownerConfig);
    setAutomationForm(data.state.automationConfig);
    setLatestMessage("Runtime state loaded.");
  }

  async function connectWallet() {
    if (typeof window === "undefined" || !window.ethereum) {
      setLatestMessage("No injected wallet found.");
      return;
    }

    try {
      const walletClient = createWalletClient({
        chain: mainnet,
        transport: custom(window.ethereum),
      });
      const [address] = await walletClient.requestAddresses();
      const response = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: address }),
      });
      const data = await response.json();
      setWalletIdentity(data.resolved);
      setLatestMessage(
        data.resolved.normalizedName
          ? `Wallet connected as ${data.resolved.normalizedName}.`
          : `Wallet connected: ${shortAddress(data.resolved.address)}.`,
      );
    } catch (error) {
      setLatestMessage(error?.shortMessage || error?.message || "Wallet connection failed.");
    }
  }

  function useConnectedIdentity() {
    if (!walletIdentity?.address) return;
    setOwnerForm((current) => ({
      ...current,
      teamRoot: walletIdentity.normalizedName || walletIdentity.address,
      treasuryInput: walletIdentity.address,
    }));
    setLatestMessage("Connected identity copied into owner setup.");
  }

  async function saveOwnerConfig() {
    const response = await fetch("/api/runtime/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerConfig: ownerForm,
      }),
    });
    const data = await response.json();
    setState(data.state);
    setLatestMessage("Owner configuration updated.");
    await refreshState();
  }

  async function saveAutomationConfig() {
    const response = await fetch("/api/runtime/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        automationConfig: normalizeNumbers(automationForm),
      }),
    });
    const data = await response.json();
    setState(data.state);
    setLatestMessage("Automation configuration updated.");
  }

  async function registerAgent() {
    const response = await fetch("/api/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...registerForm,
        teamRoot: ownerForm.teamRoot,
      }),
    });
    const data = await response.json();
    setState(data.state);
    setRegisterForm({
      name: "",
      roleKey: "ops",
      ens: "",
      walletOrEns: "",
      runtimeUrl: "",
      triggerType: "topup",
      automationEnabled: true,
    });
    setLatestMessage(`Registered ${data.agent.name}.`);
  }

  async function removeAgent(id) {
    const response = await fetch("/api/agents/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await response.json();
    setState(data.state);
    setLatestMessage("Agent removed.");
  }

  async function toggleAgent(agent) {
    const response = await fetch("/api/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...agent,
        automationEnabled: !agent.automationEnabled,
      }),
    });
    const data = await response.json();
    setState(data.state);
    setLatestMessage(`${data.agent.name} updated.`);
  }

  async function runAutomation() {
    const response = await fetch("/api/automation/run", { method: "POST" });
    const data = await response.json();
    setState(data.state);
    setLatestMessage(
      data.latestAction
        ? `Automation prepared ${data.latestAction.type} for ${data.latestAction.actorName}.`
        : "Automation ran with no new actions.",
    );
  }

  async function runPolicyCheck() {
    const response = await fetch("/api/policy/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: policyTest.agentId,
        actionType: policyTest.actionType,
        amountUsd: Number(policyTest.amountUsd),
        slippage: Number(policyTest.slippage),
      }),
    });
    const data = await response.json();
    setPolicyResponse(data);
    setLatestMessage(data.ok ? "Policy check completed." : "Policy check failed.");
  }

  async function sendActionReport() {
    const response = await fetch("/api/actions/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: reportPayload.agentId,
        roleKey: reportPayload.roleKey,
        actionType: reportPayload.actionType,
        status: reportPayload.status,
        details: safeJson(reportPayload.details),
      }),
    });
    const data = await response.json();
    setState(data.state);
    setLatestMessage("Action report stored.");
  }

  if (!state) {
    return <main className="shell"><div className="empty-state">Loading...</div></main>;
  }

  return (
    <main className="shell">
      <div className="background">
        <div className="background__glow background__glow--left" />
        <div className="background__glow background__glow--right" />
        <div className="background__grid" />
      </div>

      <section className="hero card card--hero">
        <div className="hero__copy">
          <p className="eyebrow">ETHGlobal OpenAgents MVP</p>
          <h1>Ledger Grove</h1>
          <p className="hero__lede">
            A policy control plane for treasury agents. Register an existing runtime,
            bind it to ENS and role limits, then let it call HTTP endpoints before it acts.
          </p>
          <div className="hero__chips">
            <span className="chip">HTTP Agent API</span>
            <span className="chip">ENS Identity Rail</span>
            <span className="chip">Server-backed Automation</span>
          </div>
        </div>

        <div className="hero__status">
          <div className="stat">
            <span className="stat__label">Treasury Owner</span>
            <strong>{ownerForm.teamRoot}</strong>
          </div>
          <div className="stat">
            <span className="stat__label">Connected Wallet</span>
            <strong>
              {walletIdentity?.normalizedName ||
                (walletIdentity?.address ? shortAddress(walletIdentity.address) : "Not connected")}
            </strong>
          </div>
          <div className="stat">
            <span className="stat__label">Policy Profile</span>
            <strong>{ownerForm.policyProfile}</strong>
          </div>
          <div className="stat">
            <span className="stat__label">Status</span>
            <strong>{latestMessage}</strong>
          </div>
          <div className="action-row">
            <button className="button button--secondary" type="button" onClick={() => void connectWallet()}>
              Connect Wallet
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={useConnectedIdentity}
              disabled={!walletIdentity?.address}
            >
              Use Connected Identity
            </button>
          </div>
        </div>
      </section>

      <section className="card card--config">
        <div className="stepper">
          {STEPS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`stepper__item ${step === item.key ? "is-active" : ""}`}
              onClick={() => setStep(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {step === "owner" ? (
        <section className="top-grid">
          <article className="card card--config">
            <div className="section-head">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2>Owner Setup</h2>
              </div>
              <span className="section-tag">Config</span>
            </div>

            <label className="field">
              <span>Treasury owner ENS</span>
              <input
                value={ownerForm.teamRoot}
                onChange={(event) => setOwnerForm((current) => ({ ...current, teamRoot: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Treasury vault wallet / ENS</span>
              <input
                value={ownerForm.treasuryInput}
                onChange={(event) => setOwnerForm((current) => ({ ...current, treasuryInput: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Policy profile</span>
              <select
                value={ownerForm.policyProfile}
                onChange={(event) => setOwnerForm((current) => ({ ...current, policyProfile: event.target.value }))}
              >
                <option value="balanced">Balanced treasury</option>
                <option value="defensive">Defensive treasury</option>
                <option value="growth">Growth treasury</option>
              </select>
            </label>

            <button className="button button--primary" type="button" onClick={() => void saveOwnerConfig()}>
              Save Owner Settings
            </button>

            <div className="workspace-note">
              <strong>Live identity</strong>
              <p>
                Connect a real wallet, reverse-resolve its ENS name, then copy that live identity
                into the owner and treasury fields instead of using a placeholder root.
              </p>
            </div>
          </article>

          <article className="card card--policy">
            <div className="section-head">
              <div>
                <p className="eyebrow">Policy Snapshot</p>
                <h2>Trader Rail</h2>
              </div>
              <span className="section-tag">{roleRisk.label}</span>
            </div>
            <div className="resolution-grid">
              <ResolutionCell
                label="Owner resolution"
                value={
                  ownerResolution?.normalizedName ||
                  ownerResolution?.address ||
                  ownerResolution?.input ||
                  "Pending"
                }
              />
              <ResolutionCell label="Treasury resolution" value={treasuryResolution?.address || treasuryResolution?.input || "Pending"} />
              <ResolutionCell label="Swap max" value={`$${activeProfile.traderSwapMax.toLocaleString()}`} />
              <ResolutionCell label="Rebalance max" value={`$${activeProfile.traderRebalanceMax.toLocaleString()}`} />
              <ResolutionCell label="Max slippage" value={`${activeProfile.slippageMax}%`} />
            </div>
            <div className="policy-rules" style={{ marginTop: 16 }}>
              <div className="policy-list">
                {policySummary.map((item) => (
                  <div key={item.title} className="policy-item">
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {step === "registry" ? (
        <section className="top-grid">
          <article className="card card--roles">
            <div className="section-head">
              <div>
                <p className="eyebrow">Step 2</p>
                <h2>Registered Agents</h2>
              </div>
              <span className="section-tag">{state.agents.length} agents</span>
            </div>

            <div className="agent-list">
              {state.agents.map((agent) => (
                <div key={agent.id} className="agent-row">
                  <div>
                    <strong>{agent.name}</strong>
                    <small>{agent.ens || agent.walletOrEns}</small>
                  </div>
                  <div className="resolution-grid resolution-grid--single">
                    <ResolutionCell
                      label="Resolved identity"
                      value={
                        resolvedAgentMap[agent.id]?.normalizedName ||
                        resolvedAgentMap[agent.id]?.address ||
                        "Unresolved"
                      }
                    />
                  </div>
                  <div className="agent-row__meta">
                    <span className="chip">{ROLE_NAME[agent.roleKey]}</span>
                    <span className="chip">{agent.triggerType}</span>
                    <span className="chip">{agent.automationEnabled ? "Auto on" : "Auto off"}</span>
                  </div>
                  <div className="agent-row__actions">
                    <button className="button button--ghost" type="button" onClick={() => void toggleAgent(agent)}>
                      {agent.automationEnabled ? "Pause" : "Resume"}
                    </button>
                    {!agent.isDefaultRole ? (
                      <button className="button button--ghost" type="button" onClick={() => void removeAgent(agent.id)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="card card--config">
            <div className="section-head">
              <div>
                <p className="eyebrow">Attach Existing Runtime</p>
                <h2>Add Agent</h2>
              </div>
              <span className="section-tag">HTTP</span>
            </div>

            <label className="field">
              <span>Agent name</span>
              <input value={registerForm.name} onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))} />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Role</span>
                <select
                  value={registerForm.roleKey}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      roleKey: event.target.value,
                      triggerType: event.target.value === "trader" ? "rebalance" : "topup",
                    }))
                  }
                >
                  {ROLE_BLUEPRINTS.filter((role) => role.key !== "founder").map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Trigger</span>
                <select
                  value={registerForm.triggerType}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, triggerType: event.target.value }))}
                >
                  <option value="rebalance">rebalance</option>
                  <option value="topup">topup</option>
                </select>
              </label>
              <label className="field field--wide">
                <span>ENS / subname</span>
                <input value={registerForm.ens} onChange={(event) => setRegisterForm((current) => ({ ...current, ens: event.target.value }))} placeholder={`ops.${ownerForm.teamRoot}`} />
              </label>
              <label className="field field--wide">
                <span>Wallet or runtime ENS</span>
                <input value={registerForm.walletOrEns} onChange={(event) => setRegisterForm((current) => ({ ...current, walletOrEns: event.target.value }))} />
              </label>
              <label className="field field--wide">
                <span>Runtime URL</span>
                <input value={registerForm.runtimeUrl} onChange={(event) => setRegisterForm((current) => ({ ...current, runtimeUrl: event.target.value }))} placeholder="http://your-agent-server:3001" />
              </label>
            </div>

            <label className="toggle">
              <input
                type="checkbox"
                checked={registerForm.automationEnabled}
                onChange={(event) => setRegisterForm((current) => ({ ...current, automationEnabled: event.target.checked }))}
              />
              <span>Enable automation immediately</span>
            </label>

            <div className="workspace-note">
              <strong>Real ENS / wallet binding</strong>
              <p>
                Register the agent with the actual ENS subname or wallet your runtime controls.
                Ledger Grove resolves that identity and uses it as the policy key.
              </p>
            </div>

            <button className="button button--primary" type="button" onClick={() => void registerAgent()}>
              Register Agent
            </button>
          </article>
        </section>
      ) : null}

      {step === "automation" ? (
        <section className="automation-grid">
          <article className="card card--studio">
            <div className="section-head">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Automation Controls</h2>
              </div>
              <span className="section-tag">{activeAgents.length} active agents</span>
            </div>

            <div className="explain-panel">
              <strong>When automation runs</strong>
              <p>
                Only agents with `automationEnabled = true` are considered. The server checks
                each active agent’s role and trigger. If the current treasury conditions match
                that trigger, Ledger Grove prepares an action for that specific agent.
              </p>
              <div className="explain-grid">
                <div className="resolution-cell">
                  <strong>Example</strong>
                  <span>`Market Steward` is a `trader` with trigger `rebalance`.</span>
                </div>
                <div className="resolution-cell">
                  <strong>Condition</strong>
                  <span>If stable ratio is above target, a swap plan is generated.</span>
                </div>
                <div className="resolution-cell">
                  <strong>Output</strong>
                  <span>The action is written to `latestAction`, `pendingActions`, and audit logs.</span>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Current stable ratio %</span>
                <input value={automationForm.currentStableRatio} onChange={(event) => setAutomationForm((current) => ({ ...current, currentStableRatio: event.target.value }))} />
              </label>
              <label className="field">
                <span>Target stable ratio %</span>
                <input value={automationForm.targetStableRatio} onChange={(event) => setAutomationForm((current) => ({ ...current, targetStableRatio: event.target.value }))} />
              </label>
              <label className="field">
                <span>Treasury size USD</span>
                <input value={automationForm.treasuryUsd} onChange={(event) => setAutomationForm((current) => ({ ...current, treasuryUsd: event.target.value }))} />
              </label>
              <label className="field">
                <span>Research USDC balance</span>
                <input value={automationForm.researchUsdcBalance} onChange={(event) => setAutomationForm((current) => ({ ...current, researchUsdcBalance: event.target.value }))} />
              </label>
              <label className="field">
                <span>Top-up threshold</span>
                <input value={automationForm.researchTopupThreshold} onChange={(event) => setAutomationForm((current) => ({ ...current, researchTopupThreshold: event.target.value }))} />
              </label>
              <label className="field">
                <span>Top-up amount</span>
                <input value={automationForm.researchTopupAmount} onChange={(event) => setAutomationForm((current) => ({ ...current, researchTopupAmount: event.target.value }))} />
              </label>
            </div>

            <div className="action-row">
              <button className="button button--secondary" type="button" onClick={() => void saveAutomationConfig()}>
                Save Automation Settings
              </button>
              <button className="button button--primary" type="button" onClick={() => void runAutomation()}>
                Run Automation Now
              </button>
            </div>
          </article>

          <article className="card card--output">
            <div className="section-head">
              <div>
                <p className="eyebrow">Latest Automation Output</p>
                <h2>Prepared Action</h2>
              </div>
              <span className="section-tag">{latestAction ? latestAction.type : "none"}</span>
            </div>

            <div className="workspace-note">
              <strong>What this step affects</strong>
              <p>
                Automation does not directly call your external runtime yet. It creates a
                server-approved action. Your own agent can pull or inspect that action and then
                decide to execute it using the policy API.
              </p>
            </div>

            {latestAction ? (
              <div className="quote-panel">
                <OutputPanel
                  headline={latestAction.type === "swap" ? "Autonomous swap plan" : "Autonomous transfer plan"}
                  rows={[
                    ["Actor", latestAction.actorName],
                    ["Role", ROLE_NAME[latestAction.roleKey]],
                    ["Status", latestAction.status],
                    ["Amount", latestAction.amountUsd ? `$${Number(latestAction.amountUsd).toFixed(2)}` : "-"],
                    ["Route", latestAction.type === "swap" ? `${latestAction.tokenIn} -> ${latestAction.tokenOut}` : latestAction.destination],
                  ]}
                  link={latestAction.type === "swap" ? latestAction.executionLink : ""}
                  linkLabel="Open route in Uniswap"
                />
              </div>
            ) : (
              <div className="empty-state">No automation action has been prepared yet.</div>
            )}
          </article>
        </section>
      ) : null}

      {step === "api" ? (
        <section className="top-grid">
          <article className="card card--config">
            <div className="section-head">
              <div>
                <p className="eyebrow">Step 4</p>
                <h2>Policy Check API</h2>
              </div>
              <span className="section-tag">POST /api/policy/check</span>
            </div>

            <div className="explain-panel">
              <strong>Who calls this</strong>
              <p>
                Your already-running server agent calls this endpoint before it executes any
                treasury action. This is the rule gate.
              </p>
              <div className="explain-grid">
                <div className="resolution-cell">
                  <strong>Input</strong>
                  <span>Agent identity + action type + amount + slippage.</span>
                </div>
                <div className="resolution-cell">
                  <strong>Check</strong>
                  <span>Ledger Grove matches the agent to a role and evaluates policy.</span>
                </div>
                <div className="resolution-cell">
                  <strong>Result</strong>
                  <span>Returns `approved`, `review`, or `blocked`.</span>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Agent ID</span>
                <input value={policyTest.agentId} onChange={(event) => setPolicyTest((current) => ({ ...current, agentId: event.target.value }))} />
              </label>
              <label className="field">
                <span>Action type</span>
                <select value={policyTest.actionType} onChange={(event) => setPolicyTest((current) => ({ ...current, actionType: event.target.value }))}>
                  <option value="swap">swap</option>
                  <option value="transfer">transfer</option>
                </select>
              </label>
              <label className="field">
                <span>Amount USD</span>
                <input value={policyTest.amountUsd} onChange={(event) => setPolicyTest((current) => ({ ...current, amountUsd: event.target.value }))} />
              </label>
              <label className="field">
                <span>Slippage %</span>
                <input value={policyTest.slippage} onChange={(event) => setPolicyTest((current) => ({ ...current, slippage: event.target.value }))} />
              </label>
            </div>

            <button className="button button--primary" type="button" onClick={() => void runPolicyCheck()}>
              Run Policy Check
            </button>

            <pre>{`curl -X POST http://localhost:3000/api/policy/check \\
  -H "Content-Type: application/json" \\
  -d '{"agentId":"default-trader","actionType":"swap","amountUsd":800,"slippage":0.5}'`}</pre>
          </article>

          <article className="card card--output">
            <div className="section-head">
              <div>
                <p className="eyebrow">Response</p>
                <h2>Policy Decision</h2>
              </div>
              <span className="section-tag">{policyResponse?.ok ? "ok" : "idle"}</span>
            </div>
            <pre>{JSON.stringify(policyResponse, null, 2)}</pre>
          </article>

          <article className="card card--config">
            <div className="section-head">
              <div>
                <p className="eyebrow">Report Back</p>
                <h2>Action Report API</h2>
              </div>
              <span className="section-tag">POST /api/actions/report</span>
            </div>

            <div className="explain-panel">
              <strong>Why this exists</strong>
              <p>
                After your real agent finishes execution, it sends the result here so Ledger
                Grove knows what actually happened. This keeps the UI, audit trail, and control
                plane in sync with the runtime.
              </p>
              <div className="explain-grid">
                <div className="resolution-cell">
                  <strong>Typical payload</strong>
                  <span>`executed`, `failed`, `skipped`, plus tx hash or reason.</span>
                </div>
                <div className="resolution-cell">
                  <strong>Effect</strong>
                  <span>Creates an audit record and appends execution history in Step 5.</span>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Agent ID</span>
                <input value={reportPayload.agentId} onChange={(event) => setReportPayload((current) => ({ ...current, agentId: event.target.value }))} />
              </label>
              <label className="field">
                <span>Role</span>
                <select value={reportPayload.roleKey} onChange={(event) => setReportPayload((current) => ({ ...current, roleKey: event.target.value }))}>
                  <option value="trader">trader</option>
                  <option value="ops">ops</option>
                  <option value="research">research</option>
                </select>
              </label>
              <label className="field">
                <span>Action type</span>
                <input value={reportPayload.actionType} onChange={(event) => setReportPayload((current) => ({ ...current, actionType: event.target.value }))} />
              </label>
              <label className="field">
                <span>Status</span>
                <input value={reportPayload.status} onChange={(event) => setReportPayload((current) => ({ ...current, status: event.target.value }))} />
              </label>
              <label className="field field--wide">
                <span>Details JSON</span>
                <input value={reportPayload.details} onChange={(event) => setReportPayload((current) => ({ ...current, details: event.target.value }))} />
              </label>
            </div>

            <button className="button button--primary" type="button" onClick={() => void sendActionReport()}>
              Send Action Report
            </button>
          </article>
        </section>
      ) : null}

      {step === "activity" ? (
        <section className="bottom-grid">
          <article className="card card--audit">
            <div className="section-head">
              <div>
                <p className="eyebrow">Step 5</p>
                <h2>Automation Events</h2>
              </div>
              <span className="section-tag">{state.automationEvents.length}</span>
            </div>
            <div className="workspace-note">
              <strong>What you see here</strong>
              <p>
                This column shows what Ledger Grove itself generated: triggers, prepared swap
                plans, and auto top-up decisions.
              </p>
            </div>
            <div className="audit-log">
              {state.automationEvents.length ? state.automationEvents.map((event) => (
                <div key={event.id} className="audit-item">
                  <div className="audit-item__top">
                    <div>
                      <strong>{event.agentName}</strong>
                      <small>{event.ens}</small>
                    </div>
                    <span className="status-badge">{event.status}</span>
                  </div>
                  <p>{event.message}</p>
                  <small>{new Date(event.timestamp).toLocaleString()}</small>
                </div>
              )) : <div className="empty-state">No automation events yet.</div>}
            </div>
          </article>

          <article className="card card--audit">
            <div className="section-head">
              <div>
                <p className="eyebrow">Reports</p>
                <h2>Execution Reports</h2>
              </div>
              <span className="section-tag">{state.auditLog.length}</span>
            </div>
            <div className="workspace-note">
              <strong>What is different here</strong>
              <p>
                This column shows what agents reported back after calling the APIs. If your
                server agent executes a swap and sends a tx hash, it appears here.
              </p>
            </div>
            <div className="audit-log">
              {state.auditLog.length ? state.auditLog.map((entry) => (
                <div key={entry.id} className="audit-item">
                  <div className="audit-item__top">
                    <div>
                      <strong>{entry.action}</strong>
                      <small>{ROLE_NAME[entry.roleKey]}</small>
                    </div>
                    <span className="status-badge">{entry.status}</span>
                  </div>
                  <p>{JSON.stringify(entry.details)}</p>
                  <small>{new Date(entry.timestamp).toLocaleString()}</small>
                </div>
              )) : <div className="empty-state">No audit items yet.</div>}
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}

function OutputPanel({ headline, rows, link, linkLabel }) {
  return (
    <>
      <strong>{headline}</strong>
      <div className="quote-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="quote-cell">
            <strong>{label}</strong>
            <span>{value}</span>
          </div>
        ))}
      </div>
      {link ? (
        <p>
          <a href={link} target="_blank" rel="noreferrer">
            {linkLabel}
          </a>
        </p>
      ) : null}
    </>
  );
}

function ResolutionCell({ label, value }) {
  return (
    <div className="resolution-cell">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function normalizeNumbers(config) {
  return {
    enabled: Boolean(config.enabled),
    currentStableRatio: Number(config.currentStableRatio),
    targetStableRatio: Number(config.targetStableRatio),
    treasuryUsd: Number(config.treasuryUsd),
    researchUsdcBalance: Number(config.researchUsdcBalance),
    researchTopupThreshold: Number(config.researchTopupThreshold),
    researchTopupAmount: Number(config.researchTopupAmount),
    cycleSeconds: Number(config.cycleSeconds),
  };
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Unknown";
}
