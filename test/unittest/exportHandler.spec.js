const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const assert = chai.assert
const MockAdapter = require('axios-mock-adapter')

const intents = require('../../src/intents')
const Capabilities = require("../../src/Capabilities")
const { zipToJson } = require("../../src/helper")

const { addDownloaderMocks } = require('./helper')
const toUpload = require('./data/utterances_to_export.json')
const expectedExport = require('./data/expected_export_api.json')
const BotiumConnectorNuance = require("../../src/connector");
const MOCKED_JOB_ID = 'mockedJobId'

describe('exporter', function () {
  beforeEach(async function () {
    this.mockAdapter = new MockAdapter(intents.axios)
    this.caps = require('./data/mocked_botium_full.json').botium.Capabilities
    const connector = new BotiumConnectorNuance({ caps: this.caps })
    await connector.Validate()
    this.caps = connector.caps

    addDownloaderMocks(this.mockAdapter, this.caps)
    // somehow works just with regex
    this.mockAdapter.onPost(new RegExp(`${this.caps[Capabilities.NUANCE_API_URL]}/v4/projects/${this.caps[Capabilities.NUANCE_PROJECT_ID]}/.replace`))
      .reply((config) => {
        this.importedFile = config.data
        return [200, {
          id: MOCKED_JOB_ID
        }]
      })
    const responses = [
      [[200], { status: 'RUNNING' }],
      [[200], { status: 'COMPLETED' }]
    ]
    this.promiseUploadFinised = new Promise(resolve => {
      this.promiseUploadFinisedResolve = resolve
    })
    this.mockAdapter.onGet(new RegExp(`${this.caps[Capabilities.NUANCE_API_URL]}/v4/projects/${this.caps[Capabilities.NUANCE_PROJECT_ID]}/jobs/${MOCKED_JOB_ID}*`))
      .reply(() => {
        const res = responses.shift()
        if (res?.[1].status === 'COMPLETED') {
          this.promiseUploadFinisedResolve()
        }
        return res
      })

  })

  it('should export the chatbot data', async function () {
    await intents.exportHandler({ caps: this.caps }, toUpload)
    await this.promiseUploadFinised

    const { nluJSON } = zipToJson(this.importedFile, this.caps)

    assert.deepEqual(nluJSON, expectedExport)
  }).timeout(5000)

  afterEach(async function () {
    if (this.connector) {
      await this.connector.Stop()
    }
    this.connector = null
    this.mockAdapter = null
    this.promiseUploadFinised = null
    this.promiseUploadFinisedResolve = null
  })
})
