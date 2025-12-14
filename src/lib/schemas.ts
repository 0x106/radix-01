// lib/schemas.ts
import { z } from "zod";

// --- Primitives ---

const WidgetBase = z.object({
  key: z
    .string()
    .describe(
      "The variable name for the data (e.g., 'story_tone', 'user_age').",
    ),
  label: z.string().describe("The visible label for the input."),
  description: z.string().optional().describe("Helper text or tooltip."),
});

// --- Widget Types ---

export const TextInputSchema = WidgetBase.extend({
  type: z.literal("text_input"),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
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
  step: z.number().optional(),
});

export const BooleanToggleSchema = WidgetBase.extend({
  type: z.literal("toggle"),
  defaultChecked: z.boolean().default(false),
});

// Options for Select/Radio/Checkbox
const OptionSchema = z.object({
  label: z.string(),
  value: z.string(),
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
  labels: z.object({
    left: z.string().optional(),
    right: z.string().optional(),
  }),
});

// --- Unions & Response ---

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
  // The conversational response
  message: z
    .string()
    .describe("The textual response/instructions to the user."),

  // The interactive interface
  widgets: z
    .array(WidgetSchema)
    .optional()
    .nullable()
    .describe("A list of UI widgets to render."),

  // Meta
  title: z
    .string()
    .optional()
    .describe("A title for the current step or interface."),
});

export type ChatResponseType = z.infer<typeof ChatResponseSchema>;
export type Widget = z.infer<typeof WidgetSchema>;
