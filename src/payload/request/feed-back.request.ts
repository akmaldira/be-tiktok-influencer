import { maxValue, minValue, number, object, string, transform } from "valibot";

export const createFeedBackBodySpec = object({
  rating: transform(
    string(),
    (input) => parseInt(input),
    number("Rating must be valid number", [
      minValue(1, "Rating must be at least 1"),
      maxValue(5, "Rating must be at most 5"),
    ]),
  ),
  message: string("Message must be string"),
});
