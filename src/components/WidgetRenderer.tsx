"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Widget } from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface WidgetRendererProps {
  widget: Widget;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}

export function WidgetRenderer({
  widget,
  value,
  onChange,
  disabled,
}: WidgetRendererProps) {
  if (!widget || !widget.type) return null;

  const baseLabelStyle =
    "text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block";
  const descStyle = "text-[0.8rem] text-slate-500 dark:text-slate-400 mt-1.5";

  switch (widget.type) {
    case "text_input":
      return (
        <div>
          <Label htmlFor={widget.key} className={baseLabelStyle}>
            {widget.label}
          </Label>
          <Input
            id={widget.key}
            placeholder={widget.placeholder}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-9" // slightly smaller for modern feel
          />
          {widget.description && (
            <p className={descStyle}>{widget.description}</p>
          )}
        </div>
      );

    case "number_input":
      return (
        <div>
          <Label htmlFor={widget.key} className={baseLabelStyle}>
            {widget.label}
          </Label>
          <Input
            id={widget.key}
            type="number"
            min={widget.min}
            max={widget.max}
            value={value || ""}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            className="h-9 font-mono text-sm"
          />
        </div>
      );

    case "textarea":
      return (
        <div>
          <Label htmlFor={widget.key} className={baseLabelStyle}>
            {widget.label}
          </Label>
          <Textarea
            id={widget.key}
            placeholder={widget.placeholder}
            rows={widget.rows}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="resize-none min-h-[80px]"
          />
        </div>
      );

    case "toggle":
      return (
        <div className="flex items-center justify-between py-1">
          <div className="space-y-0.5">
            <Label
              htmlFor={widget.key}
              className="text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              {widget.label}
            </Label>
            {widget.description && (
              <p className="text-xs text-slate-500">{widget.description}</p>
            )}
          </div>
          <Switch
            id={widget.key}
            checked={!!value}
            onCheckedChange={onChange}
            disabled={disabled}
          />
        </div>
      );

    case "slider":
      return (
        <div className="py-2">
          <div className="flex justify-between mb-3 items-center">
            <Label className={baseLabelStyle + " mb-0"}>{widget.label}</Label>
            <span className="text-xs font-mono bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-slate-600">
              {value ?? widget.min}
            </span>
          </div>
          <Slider
            min={widget.min}
            max={widget.max}
            step={widget.step}
            value={[value ?? widget.min]}
            onValueChange={(vals) => onChange(vals[0])}
            disabled={disabled}
            className="py-1"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-400 mt-2">
            <span>{widget.labels?.left}</span>
            <span>{widget.labels?.right}</span>
          </div>
        </div>
      );

    case "radio_group":
      return (
        <div className="space-y-3">
          <Label className={baseLabelStyle}>{widget.label}</Label>
          <RadioGroup
            value={value || ""}
            onValueChange={onChange}
            disabled={disabled}
            className="gap-2"
          >
            {widget.options?.map((opt, idx) => {
              if (!opt?.value) return null;
              const isChecked = value === opt.value;
              return (
                <label
                  key={opt.value + idx}
                  htmlFor={`${widget.key}-${opt.value}`}
                  className={cn(
                    "flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-all",
                    isChecked
                      ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <RadioGroupItem
                    value={opt.value}
                    id={`${widget.key}-${opt.value}`}
                    className="text-indigo-600"
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isChecked ? "text-indigo-900" : "text-slate-700",
                    )}
                  >
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </RadioGroup>
        </div>
      );

    case "checkbox_group":
      const currentValues = Array.isArray(value) ? value : [];
      const handleCheckedChange = (checked: boolean, itemValue: string) => {
        if (checked) onChange([...currentValues, itemValue]);
        else onChange(currentValues.filter((v: string) => v !== itemValue));
      };

      return (
        <div className="space-y-3">
          <Label className={baseLabelStyle}>{widget.label}</Label>
          <div className="grid gap-2">
            {widget.options?.map((opt, idx) => {
              if (!opt?.value) return null;
              return (
                <div
                  key={opt.value + idx}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id={`${widget.key}-${opt.value}`}
                    checked={currentValues.includes(opt.value)}
                    onCheckedChange={(checked) =>
                      handleCheckedChange(checked as boolean, opt.value)
                    }
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={`${widget.key}-${opt.value}`}
                    className="font-normal text-sm cursor-pointer select-none"
                  >
                    {opt.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "select":
      return (
        <div>
          <Label className={baseLabelStyle}>{widget.label}</Label>
          <Select
            value={value || ""}
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger className="h-9">
              <SelectValue
                placeholder={widget.placeholder || "Select option"}
              />
            </SelectTrigger>
            <SelectContent>
              {widget.options?.map((opt, idx) => {
                if (!opt?.value) return null;
                return (
                  <SelectItem key={opt.value + idx} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return null;
  }
}
