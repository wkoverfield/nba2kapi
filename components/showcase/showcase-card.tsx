import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

export type ShowcaseProject = {
  _id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  featured: boolean;
  createdAt: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  app: "App",
  "league-tool": "League tool",
  bot: "Bot",
  "data-viz": "Data viz",
  other: "Other",
};

// Live screenshot of the project URL via microlink (already whitelisted in
// next.config). Rendered unoptimized: it is generated on demand, so the Next
// image optimizer would only add latency.
function screenshotUrl(url: string) {
  const params = new URLSearchParams({
    url,
    screenshot: "true",
    meta: "false",
    embed: "screenshot.url",
    colorScheme: "light",
    "viewport.width": "1280",
    "viewport.height": "800",
    "viewport.deviceScaleFactor": "1",
  });
  return `https://api.microlink.io/?${params.toString()}`;
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ShowcaseCard({ project }: { project: ShowcaseProject }) {
  const label = CATEGORY_LABELS[project.category] ?? "Project";
  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl border border-[#e5e2da] bg-white no-underline transition-[border-color,transform] duration-150 ease-out hover:-translate-y-0.5 hover:border-[#d8d4c8] motion-reduce:transform-none"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#f1efe8]">
        <Image
          src={screenshotUrl(project.url)}
          alt={`${project.name} screenshot`}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 400px"
          className="object-cover object-top"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2">
          <span className="inline-flex items-center rounded-full border border-[#e5e2da] bg-[#faf9f5] px-2.5 py-1 text-[11px] font-medium text-[#57534a]">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <h3 className="font-display text-[17px] font-bold tracking-[-0.01em] text-[#1a1918]">
            {project.name}
          </h3>
          <ArrowUpRight className="h-4 w-4 text-[#8a8577] transition-colors duration-150 group-hover:text-[#1a1918]" />
        </div>
        <p className="mt-1.5 flex-1 text-[13.5px] leading-[1.55] text-[#57534a]">
          {project.description}
        </p>
        <div className="mt-3 font-plex text-[11px] text-[#b5b0a1]">{hostname(project.url)}</div>
      </div>
    </a>
  );
}
