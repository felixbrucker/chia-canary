import {Client, Intents, MessageOptions, MessagePayload, MessageEmbed} from 'discord.js'

import {make} from '../logging/logger'
import {Observable, Subscription} from 'rxjs'
import {ErrorEvent} from '../chia-log/stream-factory/error-event-factory'
import {
  PlotScanDurationStateChangedEvent
} from '../chia-log/stream-factory/plot-scan-duration-state-changed-event-factory'
import {TotalPlotsChangedEvent} from '../chia-log/stream-factory/total-plots-changed-event-factory'
import {State} from '../chia-log/state'
import {DriveErrorEvent} from '../chia-log/stream-factory/drive-error-event-factory'
import {Subscriber} from './subscriber'

export class Discord implements Subscriber {
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

  private readonly subscriptions: Subscription[]

  public constructor(
    private readonly client: Client,
    private readonly notifyUserId: string,
    private readonly chainName: string,
    private readonly machineName: string,
    errorEventStream: Observable<ErrorEvent>,
    plotScanDurationStateChangedEvents: Observable<PlotScanDurationStateChangedEvent>,
    totalPlotsChangedEvents: Observable<TotalPlotsChangedEvent>,
    driveErrorEvents: Observable<DriveErrorEvent>,
  ) {
    this.subscriptions = [
      errorEventStream.subscribe(this.handleErrorEvent.bind(this)),
      plotScanDurationStateChangedEvents.subscribe(this.handlePlotScanDurationStateChangedEvent.bind(this)),
      totalPlotsChangedEvents.subscribe(this.handleTotalPlotsChangedEvent.bind(this)),
      driveErrorEvents.subscribe(this.handleDriveErrorEvent.bind(this)),
    ]
  }

  public shutdown() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe())
  }

  private async handleDriveErrorEvent(event: DriveErrorEvent): Promise<void> {
    const embed = this.makeMessageEmbed()
      .setColor('RED')
      .setDescription(`Drive ${event.drivePath} encountered multiple errors`)
    await this.sendMessageToUser({ embeds: [embed] })
  }

  private async handleTotalPlotsChangedEvent(event: TotalPlotsChangedEvent): Promise<void> {
    const embed = this.makeMessageEmbed()
    const descriptionSuffix = `from ${event.from} to ${event.to}`
    switch (event.state) {
      case State.normal:
        embed
          .setColor('GREEN')
          .setDescription(`Plot count recovered ${descriptionSuffix}`)
        break
      case State.degraded:
        if (event.from > event.to) {
          embed.setColor('RED').setDescription(`Plot count degraded ${descriptionSuffix}`)
        } else {
          embed.setColor('ORANGE').setDescription(`Plot count increased ${descriptionSuffix}`)
        }
        break
    }
    await this.sendMessageToUser({ embeds: [embed] })
  }

  private async handlePlotScanDurationStateChangedEvent(event: PlotScanDurationStateChangedEvent): Promise<void> {
    const embed = this.makeMessageEmbed()
    switch (event.state) {
      case State.normal:
        embed
          .setColor('GREEN')
          .setDescription(`Plot scan duration recovered from ${event.from.toFixed(3)} sec to ${event.to.toFixed(3)} sec`)
        break
      case State.degraded:
        embed
          .setColor('RED')
          .setDescription(`Plot scan duration degraded from ${event.from.toFixed(3)} sec to: ${event.to.toFixed(3)} sec`)
        break
    }
    await this.sendMessageToUser({ embeds: [embed] })
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
    return new MessageEmbed().setAuthor({ name: `${this.chainName} | ${this.machineName}` })
  }
}
