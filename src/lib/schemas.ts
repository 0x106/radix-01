import { z } from "zod";

// --- Primitives ---
const WidgetBase = z.object({
  key: z.string().describe("The unique ID/variable name."),
  containerId: z
    .string()
    .describe("The ID of the container this widget belongs to."),
  label: z.string().describe("The label for the input."),
  description: z.string().optional(),

  // UPDATED: Added object arrays to support Table rows
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.array(z.record(z.string(), z.string())), // <--- The only change in WidgetBase
    ])
    .optional()
    .nullable()
    .describe(
      "The current value of the widget. Set this to pre-fill data or update the user's input.",
    ),
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
    .object({ left: z.string().optional(), right: z.string().optional() })
    .optional(),
});

// NEW: Table Schema
export const TableWidgetSchema = WidgetBase.extend({
  type: z.literal("table"),
  columns: z.array(
    z.object({
      header: z.string().describe("Display name for the column"),
      key: z.string().describe("Key used in the data object"),
    }),
  ),
});

export const TextDisplaySchema = WidgetBase.extend({
  type: z.literal("text_display"),
  variant: z.enum(["user", "assistant", "system"]).default("system"),
});

export const WidgetSchema = z.discriminatedUnion("type", [
  TextInputSchema,
  TextAreaSchema,
  NumberInputSchema,
  BooleanToggleSchema,
  SelectSchema,
  RadioGroupSchema,
  CheckboxGroupSchema,
  SliderSchema,
  TableWidgetSchema,
  TextDisplaySchema,
]);

export const ContainerSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

// --- Actions ---
export const ActionTypeSchema = z.enum([
  "ADD_CONTAINER",
  "UPDATE_CONTAINER",
  "DELETE_CONTAINER",
  "ADD_WIDGET",
  "UPDATE_WIDGET",
  "DELETE_WIDGET",
]);

export const WidgetActionSchema = z.object({
  type: ActionTypeSchema,
  widget: WidgetSchema.optional(),
  container: ContainerSchema.optional(),
  targetId: z.string().optional(),
});

export const ChatResponseSchema = z.object({
  message: z.string(),
  actions: z.array(WidgetActionSchema).optional(),
  title: z
    .string()
    .optional()
    .describe(
      "A short, concise title for the workspace (3-5 words). Only generate this for the first turn or if the topic changes significantly.",
    ),
});

export type Widget = z.infer<typeof WidgetSchema>;
export type Container = z.infer<typeof ContainerSchema>;
export type WidgetAction = z.infer<typeof WidgetActionSchema>;
