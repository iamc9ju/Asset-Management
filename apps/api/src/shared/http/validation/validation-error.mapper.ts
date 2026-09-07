import type { ValidationError } from "class-validator";

export interface FieldValidationError {
  readonly field: string;
  readonly messages: string[];
}

function collectFieldErrors(
  errors: ValidationError[],
  parentPath = "",
): FieldValidationError[] {
  const fieldErrors: FieldValidationError[] = [];

  for (const error of errors) {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const messages = Object.entries(error.constraints ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, message]) => message);

    if (messages.length > 0) {
      fieldErrors.push({ field, messages });
    }

    if (error.children && error.children.length > 0) {
      fieldErrors.push(...collectFieldErrors(error.children, field));
    }
  }

  return fieldErrors.sort((left, right) =>
    left.field.localeCompare(right.field),
  );
}

export function mapValidationErrors(
  errors: ValidationError[],
): Readonly<Record<string, unknown>> {
  return {
    fields: collectFieldErrors(errors),
  };
}
