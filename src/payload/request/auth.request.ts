import { email, maxLength, minLength, object, string } from "valibot";

export const loginCredentialBodySpec = object({
  email: string("Email must be string", [email("Invalid email address.")]),
  password: string("Password must be string", [
    minLength(8, "Password must be at least 8 characters."),
    maxLength(255, "Password must be at most 255 characters."),
  ]),
});

export const registerCredentialBodySpec = object({
  name: string("Name must be string", [
    minLength(3, "Name must be at least 3 characters."),
    maxLength(255, "Name must be at most 255 characters."),
  ]),
  email: string("Email must be string", [email("Invalid email address.")]),
  password: string("Password must be string", [
    minLength(8, "Password must be at least 8 characters."),
    maxLength(255, "Password must be at most 255 characters."),
  ]),
});
