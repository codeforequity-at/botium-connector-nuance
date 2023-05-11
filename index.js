const BotiumConnectorNuance = require('./src/connector')
const { importHandler, importArgs } = require('./src/intents')
const { exportHandler, exportArgs } = require('./src/intents')

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorNuance,
  Import: {
    Handler: importHandler,
    Args: importArgs
  },
  Export: {
    Handler: exportHandler,
    Args: exportArgs
  },
  PluginDesc: {
    name: 'Nuance Mix',
    provider: 'Nuance Communications Inc',
    features: {
      intentResolution: true,
      intentConfidenceScore: true,
      entityResolution: true,
      entityConfidenceScore: true,
      testCaseGeneration: true,
      testCaseExport: true
    },
    capabilities: [
      {
        name: 'NUANCE_CLIENT_ID',
        label: 'Nuance Client Id',
        description: 'Nuance Client Id',
        type: 'string',
        required: true
      },
      {
        name: 'NUANCE_CLIENT_SECRET',
        label: 'Nuance Client Secret',
        description: 'Nuance Client Secret',
        type: 'secret',
        required: true
      },
      {
        name: 'NUANCE_CONTEXT_TAG',
        label: 'Nuance Context Tag',
        description: 'The Id of the application',
        type: 'string',
        required: true
      },
      {
        name: 'NUANCE_CHANNEL',
        label: 'Nuance Channel',
        description: 'Nuance Channel',
        type: 'string',
        required: true
      },
      {
        name: 'NUANCE_LANGUAGE',
        label: 'Nuance Language',
        description: 'Nuance Language (Default: en-US)',
        type: 'string',
        required: false
      },
      {
        name: 'NUANCE_OAUTH_URL',
        label: 'Nuance Oauth Url',
        description: 'Nuance Oauth Url (Default: https://auth.crt.nuance.com/oauth2/token)',
        type: 'url',
        required: false
      },
      {
        name: 'NUANCE_DLG_ENDPOINT',
        label: 'Nuance Dlg Endpoint',
        description: 'Nuance DLG Endpoint (dlg.api.nuance.com:443)',
        type: 'string',
        required: false
      },
      {
        name: 'NUANCE_NLP_ANALYTICS_ENABLE',
        label: 'Nlp Analytics',
        description: 'Nlp Analytics',
        type: 'boolean',
        required: false,
        advanced: true
      },
      {
        name: 'NUANCE_NLU_ENDPOINT',
        label: 'Nuance NLU Endpoint (Just for Nlp Analytics)',
        description: 'Nuance NLU Endpoint (nlu.api.nuance.com:443)',
        type: 'string',
        required: false,
        advanced: true
      },
      {
        name: 'NUANCE_API_URL',
        label: 'Nuance Api URL',
        description: 'Nuance Api URL (Just for Botium Uploader/Downloader. Default: https://mix.api.nuance.com/)',
        type: 'string',
        required: false,
        advanced: true
      },
      {
        name: 'NUANCE_ADMIN_CLIENT_ID',
        label: 'Nuance Service Account Client Id',
        description: 'Nuance Service Account Client Id (Just for Botium Uploader/Downloader)',
        type: 'string',
        required: false,
        advanced: true
      },
      {
        name: 'NUANCE_ADMIN_CLIENT_SECRET',
        label: 'Nuance Service Account Client Secret',
        description: 'Nuance Service Account Client Secret (Just for Botium Uploader/Downloader)',
        type: 'secret',
        required: false,
        advanced: true
      },
      {
        name: 'NUANCE_PROJECT_ID',
        label: 'Nuance Project Id',
        description: 'Nuance Project Id (Just for Botium Uploader/Downloader)',
        type: 'string',
        required: false,
        advanced: true
      }
    ]
  }
}
