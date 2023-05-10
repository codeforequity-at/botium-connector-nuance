const Capabilities = require('./Capabilities')
const qs = require('qs')
const AdmZip = require('adm-zip')
const xml = require('xml-js')
const debug = require('debug')('botium-connector-nuance-helper')

const authenticate = async (axios, caps, mixApi, retries = 0) => {
  try {
    debug('Auth token acquiring')

    const requestOptions = {
      method: 'post',
      url: caps[Capabilities.NUANCE_OAUTH_URL],
      headers: {
        Authorization: `Basic ${Buffer.from(`${caps[mixApi ? Capabilities.NUANCE_ADMIN_CLIENT_ID : Capabilities.NUANCE_CLIENT_ID].replace(/:/g, '%3A')}:${caps[mixApi ? Capabilities.NUANCE_ADMIN_CLIENT_SECRET : Capabilities.NUANCE_CLIENT_SECRET]}`).toString('base64')}`
      },
      data: qs.stringify({
        grant_type: 'client_credentials',
        scope: mixApi ? 'mix-api' : 'dlg nlu'
      })
    }

    const res = await axios(requestOptions)
    debug(`Auth token acquired successful ${JSON.stringify(res.data)}`)

    return res
  } catch (err) {
    if (err.code === 'TOO_MANY_REQUESTS' && (retries + 1) < caps[Capabilities.NUANCE_OAUTH_MAX_RETRIES]) {
      debug('Auth token acquiring, failed because API limit reached. Waiting and retrying')
      await new Promise(resolve => setTimeout(resolve, caps[Capabilities.NUANCE_OAUTH_RETRY_DELAY_SEC] * 1000))
      return authenticate(axios, caps, mixApi, retries + 1)
    } else {
      throw new Error(`Failed to get access token: ${err.message}`)
    }
  }
}
const zipToJson = (zipFile, caps) => {
  const zip = new AdmZip(zipFile)
  const xmlFileName = `${caps[Capabilities.NUANCE_LANGUAGE]}/${caps[Capabilities.NUANCE_LANGUAGE]}.trsx`
  const nluXML = zip.readAsText(xmlFileName)
  if (!nluXML || nluXML.length === 0) {
    throw new Error(`Invalid export, nlu file not found for ${caps[Capabilities.NUANCE_LANGUAGE]}`)
  }
  const nluJSON = xml.xml2js(nluXML, { compact: false })

  return { nluJSON, zip, nluXML, xmlFileName }
}

module.exports = {
  authenticate,
  zipToJson
}
