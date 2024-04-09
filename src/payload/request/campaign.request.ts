import { Objective, Timeline } from "database/entities/enum";
import {
  enum_,
  minLength,
  number,
  object,
  optional,
  string,
  transform,
} from "valibot";

export const createCampaignBodySpec = object({
  country: string("Country must be string"),
  industry: optional(string("Industry must be string")),
  category: string("Category must be string"),
  objective: enum_(
    Objective,
    "Objective must be one of SALES, ENGAGEMENT, AWARENESS",
  ),
  product: string("Product must be string", [
    minLength(50, "Product must be more than 50 characters"),
  ]),
  targetAudience: string("Target audience must be string", [
    minLength(50, "Target audience must be more than 50 characters"),
  ]),
  timeline: enum_(
    Timeline,
    "Timeline must be one of ONE_WEEK, TWO_WEEKS, THREE_WEEKS, FOUR_WEEKS",
  ),
  influencerCount: optional(
    transform(
      string(),
      (input) => parseInt(input),
      number("Influencer count must be number"),
    ),
  ),
});
