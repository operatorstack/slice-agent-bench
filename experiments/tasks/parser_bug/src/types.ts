export interface ParsedAmount {
  currency: string | null;
  amount: number;
}

export interface ParseOptions {
  defaultCurrency?: string;
  strict?: boolean;
}
