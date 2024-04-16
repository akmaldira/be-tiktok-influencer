import { object, optional, string } from "valibot";

export const createAnalysisBodySpec = object({
  videoUrl: string("Video URL must be string"),
});

export const updateAnalysisQuerySpec = object({
  id: optional(string("Analysis ID must be string")),
});
