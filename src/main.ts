import {defaultLogger} from './logging/logger'
import {version} from '../package.json'
import {Canary} from './canary'
import {ChiaLogFileDetector} from './chia-log/chia-log-file-detector'
import {Discord} from './subscriber/discord'
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

  let client: Client|undefined
  if (config.discordBotToken && config.discordNotificationUserId) {
    client = await Discord.makeAuthenticatedDiscordClient(config.discordBotToken)
  }

  defaultLogger.info(`Subscribing to changes for ${logFiles.map(logFile => logFile.name).join(', ')}`)

  const canaries = logFiles.map(logFile => Canary.makeForLogFile(logFile, config, client))

  process.on('SIGINT', () => {
    canaries.forEach(canary => canary.shutdown())
    process.exit()
  })
})()
