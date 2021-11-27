import {ChiaLogSubscriber} from '../chia-log/subscriber/chia-log-subscriber';

export interface Sink {
  subscribeTo(source: ChiaLogSubscriber): void
}
