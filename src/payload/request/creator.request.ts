import {
  BaseSchema,
  Output,
  maxValue,
  minValue,
  number,
  object,
  optional,
  string,
  transform,
} from "valibot";

const followersFilterSpec = object({
  from: number("Followers from must be number", [
    minValue(0, "Followers from must be at least 0"),
  ]),
  to: number("Followers to must be number", [
    minValue(1, "Followers to must be at least 0"),
  ]),
});

export const paginationSpec = object({
  page: number("Page must be number", [minValue(1, "Page must be at least 1")]),
  perPage: number("PerPage must be number", [
    minValue(1, "PerPage must be at least 1"),
    maxValue(25, "PerPage must be at most 25"),
  ]),
});

export const searchCreatorQuerySpec = object({
  country: optional(string("Country must be string")),
  industry: optional(string("Industry must be string")),
  followers: optional(
    transform<BaseSchema, Output<typeof followersFilterSpec> | undefined>(
      string(),
      (input) => JSON.parse(input),
      followersFilterSpec,
    ),
  ),
  engagementRate: optional(string("Engagement rate must be string")),
  language: optional(string("Language must be string")),
  address: optional(string("Address must be string")),
  category: optional(string("Category must be string")),
  keywords: optional(string("Keywords must be string")),
  hashtags: optional(string("Hashtags must be string")),
  pagination: optional(
    transform<BaseSchema, Output<typeof paginationSpec> | undefined>(
      string(),
      (input) => JSON.parse(input),
      paginationSpec,
    ),
  ),
});
