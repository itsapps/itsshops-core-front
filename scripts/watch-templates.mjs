import chokidar from 'chokidar'
import fsExtra from 'fs-extra'

fsExtra.copySync('src/templates', 'dist/templates', { overwrite: true })

chokidar.watch('src/templates', { ignoreInitial: true }).on('all', (event, path) => {
  fsExtra.copySync('src/templates', 'dist/templates', { overwrite: true })
  console.log(`[templates] ${event}: ${path}`)
})
