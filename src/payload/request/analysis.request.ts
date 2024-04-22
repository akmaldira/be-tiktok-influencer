import {
  array,
  maxLength,
  minLength,
  number,
  object,
  optional,
  string,
  transform,
} from "valibot";

export const analysisDetailSpec = object({
  videoUrl: string("Video URL must be string"),
  cost: optional(
    transform(
      string(),
      (input) => parseInt(input, 10),
      number("Cost must be number"),
    ),
  ),
});

export const createAnalysisBodySpec = object({
  campaignName: string("Campaign name must be string"),
  details: array(analysisDetailSpec, "Details must be array", [
    minLength(1, "Video must be at least 1"),
    maxLength(5, "Video must be at most 5"),
  ]),
});

export const updateAnalysisQuerySpec = object({
  id: optional(string("Analysis ID must be string")),
});
