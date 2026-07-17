import { z } from "zod";
import { locales } from "@/i18n/config";

export const localeSchema = z.object({ locale: z.enum(locales) });
