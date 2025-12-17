import { z } from "zod";

// --- Primitives ---
const WidgetBase = z.object({
  key: z.string().describe("The variable name (e.g., 'user_age')."),
  label: z.string().describe("The label for the input."),
  description: z.string().optional(),
});

const OptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

// --- Widget Types ---
export const TextInputSchema = WidgetBase.extend({
  type: z.literal("text_input"),
  placeholder: z.string().optional(),
});

export const TextAreaSchema = WidgetBase.extend({
  type: z.literal("textarea"),
  placeholder: z.string().optional(),
  rows: z.number().default(3),
});

export const NumberInputSchema = WidgetBase.extend({
  type: z.literal("number_input"),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const BooleanToggleSchema = WidgetBase.extend({
  type: z.literal("toggle"),
  defaultChecked: z.boolean().default(false),
});

export const SelectSchema = WidgetBase.extend({
  type: z.literal("select"),
  options: z.array(OptionSchema),
  placeholder: z.string().optional(),
});

export const RadioGroupSchema = WidgetBase.extend({
  type: z.literal("radio_group"),
  options: z.array(OptionSchema),
});

export const CheckboxGroupSchema = WidgetBase.extend({
  type: z.literal("checkbox_group"),
  options: z.array(OptionSchema),
});

export const SliderSchema = WidgetBase.extend({
  type: z.literal("slider"),
  min: z.number().default(0),
  max: z.number().default(100),
  step: z.number().default(1),
  labels: z
    .object({
      left: z.string().optional(),
      right: z.string().optional(),
    })
    .optional(),
});

// --- Union ---
export const WidgetSchema = z.discriminatedUnion("type", [
  TextInputSchema,
  TextAreaSchema,
  NumberInputSchema,
  BooleanToggleSchema,
  SelectSchema,
  RadioGroupSchema,
  CheckboxGroupSchema,
  SliderSchema,
]);

export const ChatResponseSchema = z.object({
  message: z.string(),
  widgets: z.array(WidgetSchema).optional().nullable(),
});

// export type Widget = z.infer<typeof WidgetSchema>;

type BaseWidget = z.infer<typeof WidgetSchema>;

// 2. Export a type that includes the UI-only 'response' field
// We use Omit/Intersection to ensure TS knows 'response' exists on your widgets
export type Widget = BaseWidget & {
  response?: any;
};
