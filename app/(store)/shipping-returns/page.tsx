import type { Metadata } from "next";
import { PolicyPage } from "@/components/store/policy-page";

export const metadata: Metadata = { title: "Shipping & Returns", description: "Draft shipping and returns information for LSW. Final terms will be published before orders open." };

export default function Page() {
  return (
    <PolicyPage title="Shipping & Returns" sections={[{"h": "Status", "p": "Shipping rates, delivery windows, and the returns and exchange policy for DROP 001 have not been finalized. This page will be updated with confirmed terms before orders open."}, {"h": "To be confirmed before launch", "p": "Shipping regions and carriers · Processing time · Shipping rates · Return window and condition requirements · Exchange process · Who pays return shipping · Policy for limited-edition and final-sale items."}, {"h": "Checkout", "p": "Shipping options are set in the payment provider (see docs/LAUNCH.md) and must match the policy published here."}]} />
  );
}
