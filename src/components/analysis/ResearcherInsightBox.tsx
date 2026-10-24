import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  Search,
  UserCheck,
} from "lucide-react";
import { Badge, type StatusTone } from "@/components/ui/Badge";
import { formatDateTimeUTC } from "@/lib/format";
import type { AnalysisInsight, InsightKind } from "@/lib/cms/types";
import { INSIGHT_KIND_LABELS } from "@/lib/cms/types";

type Props = {
  insights: AnalysisInsight[];
};

export function ResearcherInsightBox({ insights }: Props) {
  if (!insights || insights.length === 0) return null;

  function getKindIcon(kind: InsightKind) {
    switch (kind) {
      case "interpretasi":
        return <Lightbulb className="size-4 text-info" />;
      case "temuan":
        return <Search className="size-4 text-success" />;
      case "peringatan":
        return <AlertTriangle className="size-4 text-warning" />;
      case "rekomendasi":
        return <CheckCircle2 className="size-4 text-primary" />;
      default:
        return <Info className="size-4 text-primary" />;
    }
  }

  function getToneBorder(tone: StatusTone) {
    switch (tone) {
      case "info":
        return "border-info-border bg-info-bg";
      case "success":
        return "border-success-border bg-success-bg";
      case "warning":
        return "border-warning-border bg-warning-bg";
      default:
        return "border-border bg-surface/80";
    }
  }

  return (
    <div className="flex flex-col gap-3 my-2">
      {insights.map((insight) => {
        const meta = INSIGHT_KIND_LABELS[insight.kind];
        const tone = meta?.tone || "info";

        return (
          <div
            key={insight.id}
            className={`flex flex-col gap-3 rounded-card border p-4.5 shadow-xs transition-all ${getToneBorder(tone)}`}
          >
            {/* Top Bar: Kind Badge, Context tags, & Author info */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-button bg-surface shadow-2xs">
                  {getKindIcon(insight.kind)}
                </span>
                <Badge tone={tone}>{meta?.label || insight.kind}</Badge>
                {insight.regionName && insight.regionName !== "Semua Wilayah" && (
                  <span className="rounded-button bg-surface/70 px-2 py-0.5 text-[11px] font-medium text-ink-muted border border-border/50">
                    {insight.regionName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-caption text-ink-muted">
                <span className="flex items-center gap-1 font-medium text-ink">
                  <UserCheck className="size-3.5 text-primary" />
                  {insight.author.name}
                </span>
                <span>•</span>
                <span className="text-[11px]">{formatDateTimeUTC(insight.updatedAt)}</span>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex flex-col gap-1.5">
              <h4 className="text-body font-semibold text-ink leading-snug">
                {insight.title}
              </h4>
              <p className="text-body text-ink-muted leading-relaxed whitespace-pre-line">
                {insight.content}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
