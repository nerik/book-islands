const cliProgress = require('cli-progress')
const { USE_PROGRESS_BAR } = require('../constants')

module.exports = (total) => {
  if (USE_PROGRESS_BAR === false) {
    return { start: () => {}, increment: () => {}, stop: () => {} }
  }
  const progressBar = new cliProgress.SingleBar(
    {
      stopOnComplete: true,
      clearOnComplete: true,
      barsize: 30,
      // format: '[{bar}] {percentage}% | {duration_formatted} / {eta_formatted} | {value}/{total}'
    },
    cliProgress.Presets.rect
  )
  progressBar.start(total, 0)
  return progressBar
}
