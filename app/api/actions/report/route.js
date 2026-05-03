import { NextResponse } from "next/server";
import { updateRuntimeState } from "../../../../lib/runtime-store.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json();

  const next = await updateRuntimeState((state) => {
    const record = {
      id: `report-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...body,
    };
    return {
      ...state,
      actionReports: [record, ...state.actionReports].slice(0, 40),
      auditLog: [
        {
          id: `audit-${Date.now()}`,
          timestamp: record.timestamp,
          action: body.actionType || "external-report",
          roleKey: body.roleKey || "ops",
          status: body.status || "reported",
          details: body.details || {},
        },
        ...state.auditLog,
      ].slice(0, 40),
    };
  });

  return NextResponse.json({ ok: true, state: next });
}
