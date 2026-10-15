import type { Metadata } from "next";
import { AuthenticatedAgentChat } from "@/app/_components/authenticated-agent-chat";

export const metadata: Metadata = { title: "Assistant", robots: { index: false, follow: false } };

export default async function SessionPage({
  params,
}: {
  readonly params: Promise<{ readonly sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <AuthenticatedAgentChat sessionId={sessionId} />;
}
