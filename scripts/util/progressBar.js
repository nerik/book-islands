const cliProgress = require('cli-progress')
module.exports = (total) => {
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
  progressBar.start(total, 0)
  return progressBar
}