"use client";
import type { RiskLevel } from "@/lib/types";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

const styles: Record<RiskLevel, { bg: string; border: string; text: string; icon: JSX.Element; label: string }> = {
  high: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    icon: <AlertTriangle className="h-5 w-5" />,
    label: "High risk",
  },
  medium: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    icon: <AlertCircle className="h-5 w-5" />,
    label: "Watch out",
  },
  low: {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    text: "text-emerald-800",
    icon: <Info className="h-5 w-5" />,
    label: "FYI",
  },
};

export function RiskFlagChip({
  level,
  clause,
  reason,
}: {
  level: RiskLevel;
  clause: string;
  reason: string;
}) {
  const s = styles[level];
  return (
    <div className={`rounded-lg border ${s.border} ${s.bg} p-4`}>
      <div className={`flex items-center gap-2 text-sm font-semibold ${s.text}`}>
        {s.icon}
        <span>{s.label}</span>
      </div>
      <p className="mt-2 text-sm text-ink italic">"{clause}"</p>
      <p className="mt-1 text-sm text-slate-700">{reason}</p>
    </div>
  );
}
