const debug = require('debug')('botium-connector-nuance-intents')
const axios = require('axios')
const xml = require('xml-js')
const { authenticate, zipToJson } = require('./helper')
const BotiumConnectorNuance = require('./connector')
const Capabilities = require('./Capabilities')

const axiosCustomError = async (options, msg) => {
  let res
  try {
    res = await axios(options)
  } catch (err) {
    throw new Error(`${msg}: ${err.message}`)
  }
  return res
}

const _importIt = async ({ caps }) => {
  let authResult
  try {
    authResult = await authenticate(axios, caps, true)
  } catch (err) {
    throw new Error(`failed to authenticate: ${err.message}`)
  }
  const accessToken = authResult.data.access_token

  const requestOptionsImport = {
    url: new URL(`/v4/projects/${caps[Capabilities.NUANCE_PROJECT_ID]}/.export`, caps[Capabilities.NUANCE_API_URL]),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      accept: 'application/json'
    },
    responseType: 'arraybuffer',
    method: 'get'
  }
  debug(`import request: ${JSON.stringify(requestOptionsImport, null, 2)}`)

  const responseImport = await axiosCustomError(requestOptionsImport, 'Import failed')

  const { nluJSON, zip, nluXML, xmlFileName } = zipToJson(responseImport.data, caps)

  const utterances = {}
  const samples = nluJSON.elements.find(e => e.name === 'project')?.elements.find(e => e.name === 'samples')?.elements || []

  const _extractTextFromSampleEntry = (entry) => {
    if (entry.type === 'text') {
      return entry.text
    } else if (entry.elements) {
      if (entry.elements.length === 1) {
        return _extractTextFromSampleEntry(entry.elements[0])
      } else {
        throw new Error(`Illegal sample entry length: ${JSON.stringify(entry)}`)
      }
    } else {
      throw new Error(`Illegal sample entry type: ${JSON.stringify(entry)}`)
    }
  }
  for (const sample of samples) {
    const intentName = sample.attributes?.intentref
    if (!intentName) {
      // TODO
      console.log(`intent name not found in ${JSON.stringify(sample)}`)
    } else {
      const text = sample.elements.map(entry => _extractTextFromSampleEntry(entry)).join(' ')
      if (!utterances[intentName]) {
        utterances[intentName] = {
          name: intentName,
          utterances: [text]
        }
      } else {
        utterances[intentName].utterances.push(text)
      }
    }
  }

  return { rawUtterances: utterances, zip, nluJSON, nluXML, xmlFileName, accessToken }
}
/**
 *
 * @param caps
 * @param buildconvos
 * @returns {Promise<{utterances: *, convos: *}>}
 */
const importNuanceIntents = async ({ caps, buildconvos }) => {
  try {
    const connector = new BotiumConnectorNuance({ caps })
    await connector.Validate()
    caps = connector.caps
    if (!caps[Capabilities.NUANCE_API_URL]) {
      throw new Error('NUANCE_API_URL capability is required')
    }
    if (!caps[Capabilities.NUANCE_ADMIN_CLIENT_ID]) {
      throw new Error('NUANCE_ADMIN_CLIENT_ID capability is required')
    }
    if (!caps[Capabilities.NUANCE_ADMIN_CLIENT_SECRET]) {
      throw new Error('NUANCE_ADMIN_CLIENT_SECRET capability is required')
    }
    if (!caps[Capabilities.NUANCE_PROJECT_ID]) {
      throw new Error('NUANCE_PROJECT_ID capability is required')
    }
    const downloadResult = await _importIt({ caps })
    const utterances = Object.values(downloadResult.rawUtterances)
    const convos = []
    if (buildconvos) {
      for (const utterance of utterances) {
        const convo = {
          header: {
            name: utterance.name
          },
          conversation: [
            {
              sender: 'me',
              messageText: utterance.name
            },
            {
              sender: 'bot',
              asserters: [
                {
                  name: 'INTENT',
                  args: [utterance.name]
                }
              ]
            }
          ]
        }
        convos.push(convo)
      }
    }

    return {
      convos,
      utterances
    }
  } catch (err) {
    throw new Error(`Import failed: ${err.message}`)
  }
}

const exportNuanceIntents = async ({ caps, uploadmode }, { convos, utterances }, { statusCallback }) => {
  try {
    const status = (log, obj) => {
      if (obj) {
        debug(log, obj)
      } else {
        debug(log)
      }
      if (statusCallback) statusCallback(log, obj)
    }
    const connector = new BotiumConnectorNuance({ caps })
    await connector.Validate()
    caps = connector.caps
    if (!caps[Capabilities.NUANCE_API_URL]) {
      throw new Error('NUANCE_API_URL capability is required')
    }
    if (!caps[Capabilities.NUANCE_ADMIN_CLIENT_ID]) {
      throw new Error('NUANCE_ADMIN_CLIENT_ID capability is required')
    }
    if (!caps[Capabilities.NUANCE_ADMIN_CLIENT_SECRET]) {
      throw new Error('NUANCE_ADMIN_CLIENT_SECRET capability is required')
    }
    if (!caps[Capabilities.NUANCE_PROJECT_ID]) {
      throw new Error('NUANCE_PROJECT_ID capability is required')
    }
    const { rawUtterances, zip, nluJSON, xmlFileName, accessToken } = await _importIt({ caps })

    let samples
    if (uploadmode === 'replace') {
      samples = []
      nluJSON.elements.find(e => e.name === 'project').elements.find(e => e.name === 'samples').elements = samples
    } else {
      samples = nluJSON.elements.find(e => e.name === 'project').elements.find(e => e.name === 'samples').elements
    }

    for (const { name, utterances: list } of utterances) {
      for (const u of list) {
        if (uploadmode === 'replace' || !rawUtterances[name] || rawUtterances[name].utterances.indexOf(u) < 0) {
          samples.push({
            type: 'element',
            name: 'sample',
            attributes: {
              intentref: name,
              count: '1',
              excluded: 'false',
              fullyVerified: 'false'
            },
            elements: [
              {
                type: 'text',
                text: u
              }
            ]
          })
        }
      }
    }

    const nluXml = xml.js2xml(nluJSON, { compact: false })
    zip.updateFile(xmlFileName, Buffer.from(nluXml, 'utf-8'))

    const requestOptionsExport = {
      url: new URL(`/v4/projects/${caps[Capabilities.NUANCE_PROJECT_ID]}/.replace`, caps[Capabilities.NUANCE_API_URL]),
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      data: zip.toBuffer(),
      method: 'post'
    }
    debug(`export request: ${JSON.stringify(Object.assign({}, requestOptionsExport, { data: '...' }), null, 2)}`)
    const responseExport = await axiosCustomError(requestOptionsExport, 'Export failed')
    debug(`export response: ${JSON.stringify(responseExport.data, null, 2)}`)
    const jobId = responseExport.data.id
    if (!jobId) {
      throw new Error('Job id is not set')
    }
    const roStatus = {
      url: new URL(`/v4/projects/${caps[Capabilities.NUANCE_PROJECT_ID]}/jobs/${jobId}`, caps[Capabilities.NUANCE_API_URL]),
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
    debug(`status request: ${JSON.stringify(roStatus, null, 2)}`)
    let importRunning = true
    let resStatus

    for (let tries = 0; tries < 20 && importRunning; tries++) {
      resStatus = (await axiosCustomError(roStatus, 'Status check failed')).data
      // Some other state to check?
      importRunning = ['RUNNING', 'STARTED'].includes(resStatus.status)
      if (importRunning) {
        status(`Export state is "${resStatus.status}". Waiting 1s`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    if (resStatus.status !== 'COMPLETED') {
      throw new Error(`Export failed ${JSON.stringify(resStatus, null, 2)}`)
    }

    status('File exported to Nuance successful')
  } catch (err) {
    throw new Error(`Export process failed: ${err.message}`)
  }

  debug('export finished')
}

module.exports = {
  axios,
  importHandler: ({ caps, buildconvos, ...rest } = {}) => importNuanceIntents({
    caps,
    buildconvos,
    ...rest
  }),
  importArgs: {
    caps: {
      describe: 'Capabilities',
      type: 'json',
      skipCli: true
    },
    buildconvos: {
      describe: 'Build convo files for intent assertions (otherwise, just write utterances files)',
      type: 'boolean',
      default: false
    }
  },
  exportHandler: ({ caps, uploadmode, ...rest } = {}, { convos, utterances } = {}, { statusCallback } = {}) => exportNuanceIntents({
    caps,
    uploadmode,
    ...rest
  }, {
    convos,
    utterances
  }, { statusCallback }),
  exportArgs: {
    caps: {
      describe: 'Capabilities',
      type: 'json',
      skipCli: true
    },
    uploadmode: {
      describe: 'Appending Nuance intents and user examples or replace them',
      choices: ['append', 'replace'],
      default: 'append'
    }
  }
}
