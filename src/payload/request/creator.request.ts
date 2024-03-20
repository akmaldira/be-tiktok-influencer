import {
  BaseSchema,
  Output,
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
  pagination: optional(
    transform<BaseSchema, Output<typeof paginationSpec> | undefined>(
      string(),
      (input) => JSON.parse(input),
      paginationSpec,
    ),
  ),
});
