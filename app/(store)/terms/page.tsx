import type { Metadata } from "next";
import { PolicyPage } from "@/components/store/policy-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return (
    <PolicyPage title="Terms of Service" sections={[{"h": "Status", "p": "Terms of service must be drafted and reviewed before launch. This is a placeholder."}, {"h": "To be confirmed", "p": "Order acceptance · Pricing and availability · Limited-edition releases · Shipping, returns and exchanges · Intellectual property in LSW graphics and marks · Governing law and contact information."}]} />
  );
}
