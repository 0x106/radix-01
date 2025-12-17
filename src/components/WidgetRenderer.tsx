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

import { Widget } from "@/lib/schemas"; // This now includes { response?: any }

interface WidgetRendererProps {
  widget: Widget;
  value: any; // This will receive widget.response from the parent
  onChange: (value: any) => void;
  disabled?: boolean;
}

export function WidgetRenderer({
  widget,
  value,
  onChange,
  disabled,
}: WidgetRendererProps) {
  // Guard clause: If the widget object itself is malformed during stream, render nothing.
  if (!widget || !widget.type) return null;

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

    case "number_input":
      return (
        <div className="space-y-2">
          <Label htmlFor={widget.key}>{widget.label}</Label>
          <Input
            id={widget.key}
            type="number"
            min={widget.min}
            max={widget.max}
            value={value || ""}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
          />
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
            {/* Safe access for optional labels object */}
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
            {/* SAFEGUARD: Use optional chaining (?.) and check for opt.value */}
            {widget.options?.map((opt, idx) => {
              if (!opt?.value) return null; // Skip partial options
              return (
                <div
                  key={opt.value + idx}
                  className="flex items-center space-x-2"
                >
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
              );
            })}
          </RadioGroup>
        </div>
      );

    case "checkbox_group":
      const currentValues = Array.isArray(value) ? value : [];

      const handleCheckedChange = (checked: boolean, itemValue: string) => {
        if (checked) {
          onChange([...currentValues, itemValue]);
        } else {
          onChange(currentValues.filter((v: string) => v !== itemValue));
        }
      };

      return (
        <div className="space-y-3">
          <Label>{widget.label}</Label>
          <div className="grid gap-2">
            {/* SAFEGUARD: Use optional chaining */}
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
                    className="font-normal cursor-pointer"
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
              {/* SAFEGUARD: Use optional chaining */}
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
      // Gracefully handle unknown or incomplete types during streaming
      return null;
  }
}
