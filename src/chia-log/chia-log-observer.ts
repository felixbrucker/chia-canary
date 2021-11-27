import { Tail } from 'tail';

export class ChiaLogObserver {
  public static makeForLogFile(logFilePath: string): ChiaLogObserver {
    return new ChiaLogObserver(logFilePath);
  }

  private tail: Tail;

  private constructor(logFilePath: string) {
    this.tail = new Tail(logFilePath);
  }

  public onLogLine(cb: (line: string) => void): void {
    this.tail.on('line', cb);
  }
}
