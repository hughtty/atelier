import {
  PenLine,
  Layers,
  RotateCcw,
  ListChecks,
  FileOutput,
} from "lucide-react";

export interface QuickActionsProps {
  readonly onAction: (command: string) => void;
  readonly disabled: boolean;
  readonly isZh: boolean;
}

interface ChipDef {
  readonly icon: React.ReactNode;
  readonly labelZh: string;
  readonly labelEn: string;
  readonly commandZh: string;
  readonly commandEn: string;
}

// Atelier literary-mode quick actions. The InkOS "市场雷达" chip
// (Qidian/Fanqie market rankings) was removed — it has no place in literary
// writing. These chips are dispatched as natural-language commands to the
// agent, which routes to the appropriate tool.
const CHIPS: ReadonlyArray<ChipDef> = [
  {
    icon: <PenLine size={12} />,
    labelZh: "写下一章",
    labelEn: "Write next chapter",
    commandZh: "写下一章",
    commandEn: "write next chapter",
  },
  {
    icon: <Layers size={12} />,
    labelZh: "审计上章",
    labelEn: "Audit last chapter",
    commandZh: "审计上一章",
    commandEn: "audit the last chapter",
  },
  {
    icon: <RotateCcw size={12} />,
    labelZh: "修订上章",
    labelEn: "Revise last chapter",
    commandZh: "修订上一章关键问题",
    commandEn: "revise the last chapter to fix critical issues",
  },
  {
    icon: <ListChecks size={12} />,
    labelZh: "章节进度",
    labelEn: "Chapter status",
    commandZh: "显示本书所有章节的状态",
    commandEn: "show status of all chapters in this book",
  },
  {
    icon: <FileOutput size={12} />,
    labelZh: "导出",
    labelEn: "Export",
    commandZh: "导出全书为 markdown",
    commandEn: "export the book as markdown",
  },
];

export function QuickActions({ onAction, disabled, isZh }: QuickActionsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-1 py-1">
      {CHIPS.map((chip) => {
        const label = isZh ? chip.labelZh : chip.labelEn;
        const command = isZh ? chip.commandZh : chip.commandEn;
        return (
          <button
            key={label}
            onClick={() => onAction(command)}
            disabled={disabled}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/30 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-40 disabled:pointer-events-none group"
          >
            <span className="group-hover:scale-110 transition-transform">{chip.icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
