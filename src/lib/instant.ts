import { init } from "@instantdb/react";
import schema from "@/instant.schema";

const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;

export const db = init({ appId, schema });
