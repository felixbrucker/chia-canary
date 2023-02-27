import {Client, Intents, MessageOptions, MessagePayload, MessageEmbed} from 'discord.js'

import {Sink} from './sink'
import {ChiaLogSubscriber, State} from '../chia-log/subscriber/chia-log-subscriber'
import {TotalPlotsChangedEvent, TotalPlotsSubscriber} from '../chia-log/subscriber/total-plots-subscriber'
import {
  SignagePointSubscriber,
  SkippedSignagePointsEvent,
  StateChangedEvent
} from '../chia-log/subscriber/signage-point-subscriber'
import {
  PlotScanDurationStateChangedEvent,
  PlotScanDurationSubscriber
} from '../chia-log/subscriber/plot-scan-duration-subscriber'
import {ErrorEvent, ErrorSubscriber} from '../chia-log/subscriber/error-subscriber'
import {make} from '../logging/logger'

export class Discord implements Sink {
  public static async makeAuthenticatedDiscordClient(botToken: string): Promise<Client> {
    const logger = make({ name: 'Discord' })
    const client = new Client({ intents: [Intents.FLAGS.DIRECT_MESSAGES] })

    await new Promise((resolve, reject) => {
      client.on('ready', resolve)
      client.on('error', (err) => { logger.error(err) })
      client.login(botToken).catch(reject)
    })

    logger.info('Initialized')

    return client
  }

  constructor(
    private readonly client: Client,
    private readonly notifyUserId: string,
    private readonly chainName: string,
    private readonly machineName: string,
  ) {}

  subscribeTo(source: ChiaLogSubscriber): void {
    if (source instanceof TotalPlotsSubscriber) {
      source.onChange(this.handleTotalPlotsChangedEvent.bind(this))
    } else if (source instanceof SignagePointSubscriber) {
      source.onChange(this.handleSignagePointStateChangedEvent.bind(this))
      source.onSkippedSignagePoints(this.handleSignagePointSkippedEvent.bind(this))
    } else if (source instanceof PlotScanDurationSubscriber) {
      source.onChange(this.handlePlotScanDurationStateChangedEvent.bind(this))
    } else if (source instanceof ErrorSubscriber) {
      source.onError(this.handleErrorEvent.bind(this))
    }
  }

  private async handleTotalPlotsChangedEvent(event: TotalPlotsChangedEvent): Promise<void> {
    const embed = this.makeMessageEmbed()
    const descriptionSuffix = `from ${event.from} to ${event.to}`
    switch (event.state) {
      case State.normal:
        embed
          .setColor('GREEN')
          .setDescription(`Plot count recovered ${descriptionSuffix}`)
        await this.sendMessageToUser({ embeds: [embed] })
        break
      case State.degraded:
        if (event.from > event.to) {
          embed.setColor('RED').setDescription(`Plot count degraded ${descriptionSuffix}`)
        } else {
          embed.setColor('ORANGE').setDescription(`Plot count increased ${descriptionSuffix}`)
        }
        await this.sendMessageToUser({ embeds: [embed] })
        break
    }
  }

  private async handleSignagePointStateChangedEvent(event: StateChangedEvent): Promise<void> {
    const embed = this.makeMessageEmbed()
    switch (event.state) {
      case State.normal:
        embed
          .setColor('GREEN')
          .setDescription('Signage points are being received normally again')
        await this.sendMessageToUser({ embeds: [embed] })
        break
      case State.degraded:
        embed
          .setColor('RED')
          .setDescription(`No signage points received since ${event.lastSignagePoint.receivedAt.format('YYYY-MM-DD hh:mm:ss')}`)
        await this.sendMessageToUser({ embeds: [embed] })
        break
    }
  }

  private async handleSignagePointSkippedEvent(event: SkippedSignagePointsEvent): Promise<void> {
    const embed = this.makeMessageEmbed()
      .setColor('RED')
      .setDescription(`Skipped ${event.skipped} signage points from ${event.from.number} to ${event.to.number}\n\nTook: ${event.to.receivedAt.from(event.from.receivedAt, true)}`)
    await this.sendMessageToUser({ embeds: [embed] })
  }

  private async handlePlotScanDurationStateChangedEvent(event: PlotScanDurationStateChangedEvent): Promise<void> {
    const embed = this.makeMessageEmbed()
    switch (event.state) {
      case State.normal:
        embed
          .setColor('GREEN')
          .setDescription(`Plot scan duration recovered from ${event.from.toFixed(3)} sec to ${event.to.toFixed(3)} sec`)
        await this.sendMessageToUser({ embeds: [embed] })
        break
      case State.degraded:
        embed
          .setColor('RED')
          .setDescription(`Plot scan duration degraded from ${event.from.toFixed(3)} sec to: ${event.to.toFixed(3)} sec`)
        await this.sendMessageToUser({ embeds: [embed] })
        break
    }
  }

  private async handleErrorEvent(event: ErrorEvent): Promise<void> {
    const embed = this.makeMessageEmbed()
      .setColor('RED')
      .setDescription(`Encountered an error log entry:\n\n${event.message}`)
    await this.sendMessageToUser({ embeds: [embed] })
  }

  private async sendMessageToUser(message: MessagePayload | MessageOptions) {
    const user = await this.client.users.fetch(this.notifyUserId)
    await user.send(message)
  }

  private makeMessageEmbed(): MessageEmbed {
    return new MessageEmbed().setAuthor(`${this.chainName} | ${this.machineName}`)
  }
}
