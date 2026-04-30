import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy-server";
import { getOrCreatePrivyUser } from "@/lib/privy-user";
import { initStarkFlow } from "@/lib/starkflow-init";
import { getWalletDeploymentState } from "@/lib/starknet-read";

export async function POST(req: NextRequest) {
  try {
    const claims = await verifyPrivyToken(req);
    const userJwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    const appUser = await getOrCreatePrivyUser(claims);

    if (appUser.starknetAddress) {
      const deployment = await getWalletDeploymentState(
        appUser.starknetAddress,
        appUser.preferredNetwork,
      );

      return NextResponse.json({
        address: appUser.starknetAddress,
        deployed: deployment.deployed,
        network: deployment.network,
      });
    }

    if (!userJwt) {
      return NextResponse.json({ error: "Missing Privy bearer token" }, { status: 401 });
    }

    const flow = await initStarkFlow(appUser.id);

    return NextResponse.json({
      address: flow.address,
      deployed: flow.deployed,
      network: flow.network,
    });
  } catch (err) {
    console.error("[/api/onboard]", err);
    return NextResponse.json(
      { error: "Failed to onboard wallet", details: String(err) },
      { status: err instanceof Error && err.message.includes("token") ? 401 : 500 },
    );
  }
}
