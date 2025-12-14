"use client";

import { Widget } from "@/lib/schemas";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  switch (widget.type) {
    case "text_input":
      return (
        <div className="space-y-2">
          <Label htmlFor={widget.key}>{widget.label}</Label>
          <Input
            id={widget.key}
            placeholder={widget.placeholder}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
          {widget.description && (
            <p className="text-xs text-muted-foreground">
              {widget.description}
            </p>
          )}
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-2">
          <Label htmlFor={widget.key}>{widget.label}</Label>
          <Textarea
            id={widget.key}
            placeholder={widget.placeholder}
            rows={widget.rows}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      );

    case "toggle":
      return (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor={widget.key}>{widget.label}</Label>
            {widget.description && (
              <p className="text-xs text-muted-foreground">
                {widget.description}
              </p>
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
        <div className="space-y-4">
          <div className="flex justify-between">
            <Label>{widget.label}</Label>
            <span className="text-sm text-muted-foreground">
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
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{widget.labels?.left}</span>
            <span>{widget.labels?.right}</span>
          </div>
        </div>
      );

    case "radio_group":
      return (
        <div className="space-y-3">
          <Label>{widget.label}</Label>
          <RadioGroup
            value={value || ""}
            onValueChange={onChange}
            disabled={disabled}
          >
            {widget.options.map((opt) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={opt.value}
                  id={`${widget.key}-${opt.value}`}
                />
                <Label
                  htmlFor={`${widget.key}-${opt.value}`}
                  className="font-normal"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      );

    case "select":
      return (
        <div className="space-y-2">
          <Label>{widget.label}</Label>
          <Select
            value={value || ""}
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={widget.placeholder || "Select option"}
              />
            </SelectTrigger>
            <SelectContent>
              {widget.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return null;
  }
}
