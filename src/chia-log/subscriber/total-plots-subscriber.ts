import {EventEmitter} from 'events';

import {ChiaLogObserver} from '../chia-log-observer';
import {ChiaLogSubscriber, State} from './chia-log-subscriber';

export type TotalPlotsChangedEvent = {
  state: State,
  from: number,
  to: number,
};

export class TotalPlotsSubscriber implements ChiaLogSubscriber {
  private readonly regex = /Total ([0-9]*) plots/;
  private readonly emitter = new EventEmitter();
  private currentTotalPlots = 0;
  private pastTotalPlotsStack = [];

  public subscribeTo(observer: ChiaLogObserver): void {
    observer.onLogLine(this.handleLogLine.bind(this));
  }

  public get state(): State {
    return this.pastTotalPlotsStack.length > 0 ? State.degraded : State.normal;
  }

  public onChange(cb: (event: TotalPlotsChangedEvent) => void): void {
    this.emitter.on('change', cb);
  }

  private handleLogLine(line: string): void {
    const matches = line.match(this.regex);
    if (!matches) {
      return;
    }

    const totalPlots = parseInt(matches[1], 10);
    if (totalPlots < this.currentTotalPlots) {
      this.pastTotalPlotsStack.push(this.currentTotalPlots);
      this.emitter.emit('change', {
        state: this.state,
        from: this.currentTotalPlots,
        to: totalPlots,
      });
    } else if (this.state === State.degraded && totalPlots >= this.topmostLastTotalPlots) {
      while (totalPlots >= this.topmostLastTotalPlots) {
        this.pastTotalPlotsStack.pop();
      }
      this.emitter.emit('change', {
        state: this.state,
        from: this.currentTotalPlots,
        to: totalPlots,
      });
    }
    this.currentTotalPlots = totalPlots;
  }

  private get topmostLastTotalPlots(): number {
    if (this.pastTotalPlotsStack.length === 0) {
      return 0;
    }

    return this.pastTotalPlotsStack[this.pastTotalPlotsStack.length - 1];
  }
}
