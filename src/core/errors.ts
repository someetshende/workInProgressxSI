export class OrielError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrielError";
    this.status = status;
  }
}
