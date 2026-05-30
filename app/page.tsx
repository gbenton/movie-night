import { AppShell } from "../components/AppShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Movie Night",
  description: "Filter trusted movie lists by what you can actually stream right now.",
};

export default function Page() {
  return <AppShell />;
}
