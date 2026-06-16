import dynamic from "next/dynamic";
import type { JSX } from "react";

const HomeContent = dynamic(
  () => import("@/app/components/HomeContent"),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto flex max-w-md flex-col gap-7 px-5 pt-10">
        <div className="h-6 w-32 animate-pulse rounded-full bg-ink-800" />
        <div className="h-12 w-72 animate-pulse rounded-lg bg-ink-800" />
        <div className="h-14 w-full animate-pulse rounded-2xl bg-ink-800" />
      </div>
    ),
  },
);

export default function Home(): JSX.Element {
  return <HomeContent />;
}
