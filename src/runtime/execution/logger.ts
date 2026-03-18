const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";

export class Logger {
  constructor(private readonly prefix: string) {}

  info(message: string): void {
    console.log(`${DIM}[${this.prefix}]${RESET} ${message}`);
  }

  step(current: number, total: number): void {
    console.log(
      `\n${BOLD}${CYAN}[${this.prefix}] Step ${current}/${total}${RESET}`,
    );
  }

  tool(name: string, args: Record<string, unknown>): void {
    const argsPreview =
      Object.keys(args).length > 0 ? ` ${JSON.stringify(args)}` : "";
    console.log(
      `${MAGENTA}[${this.prefix}] tool:${name}${RESET}${DIM}${argsPreview}${RESET}`,
    );
  }

  success(message: string): void {
    console.log(`${GREEN}${BOLD}[${this.prefix}] ${message}${RESET}`);
  }

  warn(message: string): void {
    console.log(`${YELLOW}[${this.prefix}] ${message}${RESET}`);
  }

  error(message: string): void {
    console.error(`${RED}${BOLD}[${this.prefix}] ${message}${RESET}`);
  }
}
