import { z } from "zod";

// --- Primitives ---
const WidgetBase = z.object({
  key: z.string().describe("The unique ID/variable name."),
  label: z.string().describe("The label for the input."),
  description: z.string().optional(),
});

const OptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

// --- Widget Types (Same as before) ---
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

// --- NEW: Actions Schema ---

export const ActionTypeSchema = z.enum(["ADD", "UPDATE", "DELETE"]);

export const WidgetActionSchema = z.object({
  type: ActionTypeSchema.describe("The action to perform on the global state"),
  key: z.string().describe("The key of the widget to target"),
  widget: WidgetSchema.optional().describe(
    "The widget definition. Required for ADD and UPDATE. Ignored for DELETE.",
  ),
});

export const ChatResponseSchema = z.object({
  message: z.string(),
  // Instead of a fresh list, we ask for a list of actions/diffs
  actions: z.array(WidgetActionSchema).optional(),
});

type BaseWidget = z.infer<typeof WidgetSchema>;
export type Widget = BaseWidget & {
  response?: any;
};

export type WidgetAction = z.infer<typeof WidgetActionSchema>;
