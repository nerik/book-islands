const cliProgress = require('cli-progress')
module.exports = (total) => {
  const progressBar = new cliProgress.SingleBar({
    stopOnComplete: true,
    clearOnComplete: true,
    barsize: 30,
    format: '[{bar}] {percentage}% | {eta_formatted}/{duration_formatted} | {value}/{total}'
  }, cliProgress.Presets.rect)
  progressBar.start(total, 0)
  return progressBar
}