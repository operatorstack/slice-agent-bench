import { TextFormatter } from "./formatter.js";

export function renderTitle(fmt: TextFormatter, title: string): string {
  return fmt.header(title, 1);
}

export function renderCode(fmt: TextFormatter, code: string): string {
  return fmt.codeBlock(code, "typescript");
}
