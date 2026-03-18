const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const BLUE = "\x1b[34m";

export class Logger {
  public isVerbose: boolean;

  constructor(
    private readonly prefix: string,
    options?: { verbose?: boolean },
  ) {
    this.isVerbose = options?.verbose ?? false;
  }

  info(message: string): void {
    console.log(`${DIM}[${this.prefix}]${RESET} ${message}`);
  }

  verbose(label: string, body?: string): void {
    if (!this.isVerbose) {
      return;
    }
    const header = `${BLUE}${DIM}[${this.prefix}:verbose]${RESET} ${BLUE}── ${label} ──${RESET}`;
    if (body === undefined) {
      console.log(header);
      return;
    }
    console.log(header);
    const lines = body.split("\n");
    for (const line of lines) {
      console.log(`${DIM}  │${RESET} ${line}`);
    }
    console.log(`${DIM}  └${"─".repeat(60)}${RESET}`);
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
