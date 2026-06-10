import { createRequire } from 'module'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import MockAdapter from 'axios-mock-adapter'
import * as intents from '../../src/intents.js'
import { addDownloaderMocks } from './helper.js'

const require = createRequire(import.meta.url)

chai.use(chaiAsPromised)
const assert = chai.assert

const caps = require('./data/mocked_botium_full.json').botium.Capabilities
const downloadConverted = require('./data/expected_import.json')

describe('importer', function () {
  beforeEach(async function () {
    this.mockAdapter = new MockAdapter(intents.axios)
    addDownloaderMocks(this.mockAdapter, caps)
  })

  it('should import the chatbot data', async function () {
    const result = await intents.importHandler({ caps })
    assert.deepEqual(result, downloadConverted)
  })

  afterEach(async function () {
    if (this.connector) {
      await this.connector.Stop()
      this.connector = null
      this.mockAdapter = null
    }
  })
})
