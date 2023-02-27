import {hostname} from 'os'

import {defaultLogger} from './logging/logger'
import {TotalPlotsSubscriber} from './chia-log/subscriber/total-plots-subscriber'
import {version} from '../package.json'
import {Canary} from './canary'
import {SignagePointSubscriber} from './chia-log/subscriber/signage-point-subscriber'
import {PlotScanDurationSubscriber} from './chia-log/subscriber/plot-scan-duration-subscriber'
import {Logger} from './sink/logger'
import {ErrorSubscriber} from './chia-log/subscriber/error-subscriber'
import {ChiaLogFileDetector} from './chia-log/chia-log-file-detector'
import {Discord} from './sink/discord'
import {Config} from './config/config'
import {Client} from 'discord.js'

process.on('unhandledRejection', (err: Error) => defaultLogger.error(err))
process.on('uncaughtException', (err: Error) => defaultLogger.error(err));

(async () => {
  defaultLogger.info(`Chia Canary ${version}`)

  const config = new Config()
  if (!await config.isAccessible()) {
    await config.save()
  }
  await config.load()

  const logFileDetector = new ChiaLogFileDetector(config.coinBlacklist)
  const logFiles = await logFileDetector.detect()

  if (logFiles.length === 0) {
    defaultLogger.warn(`No log files found, exiting ..`)

    process.exit(0)
  }

  let client: Client = null
  if (config.discordBotToken && config.discordNotificationUserId) {
    client = await Discord.makeAuthenticatedDiscordClient(config.discordBotToken)
  }

  defaultLogger.info(`Subscribing to changes for ${logFiles.map(logFile => logFile.name).join(', ')}`)

  for (const logFile of logFiles) {
    const canary = Canary.makeForLogFile(logFile.path)

    canary.addSink(new Logger(logFile.name))

    if (config.discordBotToken && config.discordNotificationUserId) {
      const discordSink = new Discord(
        client,
        config.discordNotificationUserId,
        logFile.name,
        config.machineName || hostname()
      )
      canary.addSink(discordSink)
    }

    canary.addChiaLogSubscriber(
      new TotalPlotsSubscriber(),
      new SignagePointSubscriber(),
      new PlotScanDurationSubscriber(),
      new ErrorSubscriber(config.errorLogBlacklist)
    )
  }
})()
