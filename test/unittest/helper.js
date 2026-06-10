import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Capabilities from '../../src/Capabilities.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const addDownloaderMocks = (mockAdapter, caps) => {
  mockAdapter.onPost(caps[Capabilities.NUANCE_OAUTH_URL])
    .reply(200, {
      access_token: 'mockedAccessToken'
    })
  // somehow works just with regex
  const url = new RegExp(`${caps[Capabilities.NUANCE_API_URL]}/v4/projects/${caps[Capabilities.NUANCE_PROJECT_ID]}/.export`)
  mockAdapter.onGet(url)
    .reply(() => {
      const data = fs.readFileSync(path.join(__dirname, '/data/nuanceExportResponse.zip'))
      return [200, data]
    })
}
