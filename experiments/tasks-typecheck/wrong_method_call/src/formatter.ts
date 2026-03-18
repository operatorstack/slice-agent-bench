export class TextFormatter {
  bold(text: string): string {
    return `**${text}**`;
  }

  italic(text: string): string {
    return `_${text}_`;
  }

  heading(text: string, level: number): string {
    const prefix = "#".repeat(Math.max(1, Math.min(level, 6)));
    return `${prefix} ${text}`;
  }

  codeBlock(text: string, lang: string): string {
    return ["```" + lang, text, "```"].join("\n");
  }
}
