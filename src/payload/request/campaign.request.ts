import { enum_, maxLength, minLength, object, optional, string } from "valibot";

enum Objective {
  SALES = "SALES",
  ENGAGEMENT = "ENGAGEMENT",
  AWARENESS = "AWARENESS",
  DOWNLOADER = "DOWNLOADER",
}

enum Timeline {
  ONE_WEEK = "ONE_WEEK",
  TWO_WEEKS = "TWO_WEEKS",
  THREE_WEEKS = "THREE_WEEKS",
  FOUR_WEEKS = "FOUR_WEEKS",
}

export const createCampaignBodySpec = object({
  country: string("Country must be string"),
  industry: optional(string("Industry must be string")),
  category: string("Category must be string"),
  objective: enum_(
    Objective,
    "Objective must be one of SALES, ENGAGEMENT, AWARENESS",
  ),
  product: string("Product must be string", [
    minLength(10, "Product must be more than 10 characters"),
    maxLength(255, "Product must be less than 255 characters"),
  ]),
  targetAudience: string("Target audience must be string"),
  timeline: enum_(
    Timeline,
    "Timeline must be one of ONE_WEEK, TWO_WEEKS, THREE_WEEKS, FOUR_WEEKS",
  ),
});