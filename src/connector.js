const path = require('path')
const fs = require('fs')
const util = require('util')

const grpc = require('@grpc/grpc-js')
const axios = require('axios')
const protoLoader = require('@grpc/proto-loader')
const googleProtoFiles = require('google-proto-files')
const debug = require('debug')('botium-connector-nuance')
const _ = require('lodash')

const Capabilities = require('./Capabilities')
const { authenticate } = require('./helper')
const { struct } = require('./structJson')

const DEFAULTS = {
  [Capabilities.NUANCE_OAUTH_URL]: 'https://auth.crt.nuance.com/oauth2/token',
  [Capabilities.NUANCE_DLG_ENDPOINT]: 'dlg.api.nuance.com:443',
  [Capabilities.NUANCE_DLG_ENDPOINT]: 'dlg.api.nuance.com:443',
  [Capabilities.NUANCE_API_URL]: 'https://mix.api.nuance.com/',

  [Capabilities.NUANCE_CHANNEL]: 'default',
  [Capabilities.NUANCE_LANGUAGE]: 'en-US',
  [Capabilities.NUANCE_LIBRARY]: 'default',
  // Authorization rate limit: 50 requests/minute per IP address
  // We try max for a minute to authenticate
  [Capabilities.NUANCE_OAUTH_MAX_RETRIES]: 6,
  [Capabilities.NUANCE_OAUTH_RETRY_DELAY_SEC]: 10,
  [Capabilities.NUANCE_NLU_ENDPOINT]: 'nlu.api.nuance.com:443',
  [Capabilities.NUANCE_NLU_ENTITY_VALUE_MODE]: 'FORCE_LITERAL'
}

// Local env: imported files must not be here anymore because protoLoader finds them via includeDirs.
// So definition of the imported files is duplicated.
// Dev/prod environments: it has to be a difference between local, and dev/prod environments. Before this change protoLoader
// did not find imported files just on dev/prod. So to be sure I kept duplicated import-file-definitions.
const PROTOFILES = [
  'proto/nuance/asr/v1/recognizer.proto',
  'proto/nuance/asr/v1/resource.proto',
  'proto/nuance/asr/v1/result.proto',
  'proto/nuance/dlg/v1/dlg_interface.proto',
  'proto/nuance/dlg/v1/dlg_messages.proto',
  'proto/nuance/dlg/v1/common/dlg_common_messages.proto',
  'proto/nuance/nlu/v1/interpretation-common.proto',
  'proto/nuance/nlu/v1/multi-intent-interpretation.proto',
  'proto/nuance/nlu/v1/result.proto',
  'proto/nuance/nlu/v1/runtime.proto',
  'proto/nuance/nlu/v1/single-intent-interpretation.proto',
  'proto/nuance/rpc/error_details.proto',
  'proto/nuance/rpc/status.proto',
  'proto/nuance/rpc/status_code.proto',
  'proto/nuance/tts/v1/nuance_tts_v1.proto'
]

const getGrpcError = (error, res) => {
  if (error?.code) {
    debug(`GRPC error: ${error.message}, (${error.code}), (${error.details})`)
    return new Error(`${error.message}, (${error.code})`)
  }

  return error
}

class BotiumConnectorNuance {
  constructor ({ queueBotSays, caps, bottleneck, testContext }) {
    this.queueBotSays = queueBotSays
    this.caps = Object.assign({}, DEFAULTS, caps)
    this.bottleneck = bottleneck || ((promise) => promise)
    this.testContext = testContext
    this.sessionId = null
    this.accessToken = null
    this.accessTokenExpires = null
    this.selector = {
      channel: this.caps[Capabilities.NUANCE_CHANNEL],
      language: this.caps[Capabilities.NUANCE_LANGUAGE],
      library: this.caps[Capabilities.NUANCE_LIBRARY]
    }
  }

  Validate () {
    debug('Validate called')
    if (!this.caps[Capabilities.NUANCE_CLIENT_ID]) throw new Error('NUANCE_CLIENT_ID capability required')
    if (!this.caps[Capabilities.NUANCE_CLIENT_SECRET]) throw new Error('NUANCE_CLIENT_SECRET capability required')
    if (!this.caps[Capabilities.NUANCE_CONTEXT_TAG]) throw new Error('NUANCE_CONTEXT_TAG capability required')
    if (!this.caps[Capabilities.NUANCE_CHANNEL]) throw new Error('NUANCE_CHANNEL capability required')
    this.caps = Object.assign({}, this.caps)
  }

  async Start () {
    debug('Start called')

    // nuance/asr/v1/resource.proto
    // proto/asr/v1/resource.proto
    // /app/server/node_modules/botium-connector-nuance/proto/asr/v1/nuance/asr/v1/resource.proto
    // maybe this dynamic loading is not required?
    const toProtoFilePath = (file) => {
      const res1 = path.join(__dirname, '..', file)
      if (fs.existsSync(res1)) {
        debug(`Proto file found, dev environment: ${res1}`)
        return res1
      }

      const res2 = path.join(__dirname, file)
      if (fs.existsSync(res2)) {
        debug(`Proto file found, prod environment: ${res2}`)
        return res2
      }

      throw new Error(`Proto file not found: "${file}" (as "${res1}" or "${res2})"`)
    }
    const protoFilePaths = PROTOFILES.map(file => toProtoFilePath(file))
    const protoRoot = path.join(__dirname, '..', 'proto')
    const googleProtoPath = googleProtoFiles.getProtoPath('..')
    debug(`Loading proto file definitions using root ${protoRoot} and google proto path ${googleProtoPath}`)
    const packageDefinition = protoLoader.loadSync(
      protoFilePaths,
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [
          path.join(__dirname, '..', 'proto'), // another way to load imported proto files
          googleProtoPath // this is not required on local, but somehow required on dev server, and I suppose on prod too
        ]
      })
    debug('Loading proto files')
    const proto = grpc.loadPackageDefinition(packageDefinition)
    debug('Loading proto files loaded')
    const callCredentials = grpc.credentials.createFromMetadataGenerator(async (params, callback) => {
      let accessToken = 'Placeholder'
      try {
        accessToken = await this._getAccessTokenWeak()
      } catch (err) {
        // throwing error just freezes everything.
        // api is not called, error is not displayed, just getting timeout error from mocha after a while
        // Then it is a bit better to use invalid access token, and kill the process with auth error
        debug(`Failed to acquire access token ===> ${JSON.stringify(err.message)}`)
      }

      const md = new grpc.Metadata()
      md.set('authorization', `Bearer ${accessToken}`)
      return callback(null, md)
    })
    const channelCredentials = grpc.credentials.createSsl()
    const credentials = grpc.credentials.combineChannelCredentials(channelCredentials, callCredentials)

    this.dialogService = new proto.nuance.dlg.v1.DialogService(this.caps[Capabilities.NUANCE_DLG_ENDPOINT], credentials)
    this.testContext && this.testContext.dialogService(this.dialogService)
    this.nluService = new proto.nuance.nlu.v1.Runtime(this.caps[Capabilities.NUANCE_NLU_ENDPOINT], credentials)
    this.testContext && this.testContext.nluService(this.nluService)

    const toGrpcStructWeak = (obj) => {
      try {
        if (obj && !obj.fields) {
          return struct.encode(obj)
        }
      } catch (e) {
        debug(`Failed to convert to grpc, fall back to non-converted value: ${util.inspect(obj)}`)
      }

      return obj
    }
    return this.bottleneck(new Promise((resolve, reject) => {
      const startParams = {
        session_id: this.caps[Capabilities.NUANCE_SESSION_ID],
        selector: this.selector,
        payload: {
          model_ref: {
            uri: `urn:nuance-mix:tag:model/${this.caps[Capabilities.NUANCE_CONTEXT_TAG]}/mix.dialog`,
            type: 0
          },
          data: toGrpcStructWeak(this.caps[Capabilities.NUANCE_INITIAL_CONTEXT]),
          suppress_log_user_data: this.caps[Capabilities.NUANCE_SUPPRESS_LOG_USER_DATA]
        },
        session_timeout_sec: this.caps[Capabilities.NUANCE_SESSION_TIMEOUT_SEC],
        user_id: this.caps[Capabilities.NUANCE_USER_ID],
        client_data: this.caps[Capabilities.NUANCE_CLIENT_DATA]
      }

      debug(`Starting conversation: ${JSON.stringify(startParams)}`)

      this.dialogService.Start(startParams, async (error, res) => {
        const grpcError = getGrpcError(error, res)
        if (grpcError) {
          return reject(new Error(`Failed to init session: ${grpcError.message}`))
        }
        debug(`Init session successful: ${JSON.stringify(res)}`)
        if (res?.payload?.session_id) {
          this.sessionId = res.payload.session_id
        } else {
          debug('Session ID not found!!!')
          return reject(new Error('Session ID not found in init session response'))
        }
        try {
          if (this.caps[Capabilities.NUANCE_SKIP_WELCOME_MESSAGE]) {
            debug('Welcome message check turned off')
          } else {
            debug('Sending welcome message request')
            const kickOffResult = await Promise.all(this._sendMessage({ messageText: null }))
            debug(`Welcome message request successful: ${JSON.stringify(kickOffResult)}`)
            await this._handleResponse(kickOffResult)
          }
          return resolve()
        } catch (err) {
          debug(`Welcome message request failed: ${err.message || err}`)
          return reject(new Error(`Failed to send welcome message: ${err.message || err}`))
        }
      })
    }))
  }

  async UserSays (msg) {
    await new Promise((resolve) => setTimeout(() => resolve(), 1000))
    debug('UserSays called')
    debug(`Sending message ${JSON.stringify(msg)}`)
    const res = await Promise.all(this._sendMessage(msg))
    debug(`Response received: ${JSON.stringify(res)}`)
    await this._handleResponse(res)
  }

  async Stop () {
    debug('Stop called')
    if (this.sessionId && this.dialogService) {
      return this.bottleneck(new Promise((resolve, reject) => {
        this.dialogService.Stop({
          session_id: this.sessionId
        }, (error, res) => {
          this.sessionId = null
          // do not clean access token. For performance test it can be helpful
          // this.accessToken = null
          this.dialogService = null
          this.nluService = null
          const grpcError = getGrpcError(error, res)
          if (grpcError) {
            if (grpcError.message && grpcError.message.startsWith('5 NOT_FOUND: Could not find session for')) {
              debug(`Failed to terminate session, It has to be already terminated by chatbot (${error.message})`)
              resolve(error)
            }
            return reject(`Failed to stop conversation: ${grpcError.message}`)
          }
          debug('Session terminated')
          return resolve(res)
        })
      }))
    }

    debug(`Cant terminate session ${JSON.stringify({
      sessionId: !!this.sessionId,
      dialogService: !!this.dialogService
    })}`)
    this.sessionId = null
    this.accessToken = null
    this.dialogService = null
    this.nluService = null
  }

  async _handleResponse ([response, nlpResponse]) {
    const botMsg = { sourceData: [response, nlpResponse] }
    if (nlpResponse) {
      if (nlpResponse?.status?.code >= 400) {
        debug(`NLP response, illegal status code: ${nlpResponse}`)
      } else {
        botMsg.nlp = {}
        /* eslint-disable camelcase */
        const intents = nlpResponse.result?.interpretations?.map(({ single_intent_interpretation }) => ({
          name: single_intent_interpretation.intent,
          confidence: single_intent_interpretation.confidence
        }))
        /* eslint-enable camelcase */
        if (intents && intents.length > 0) {
          botMsg.nlp.intent = {
            name: intents[0].name,
            incomprehension: ['NO_INTENT', 'NO_MATCH'].includes(intents[0].name),
            confidence: intents[0].confidence,
            intents: intents.slice(1)
          }
        }
        // each interpretation has its own entities, we extract just from the first
        const entities = []
        for (const [name, structs] of Object.entries(nlpResponse.result?.interpretations[0]?.single_intent_interpretation?.entities || [])) {
          for (const struct of structs.entities) {
            const _extractLeaf = (struct) => {
              if (struct.entities) {
                if ((_.isObject(struct.entities) ? Object.keys(struct.entities) : struct.entities).length) {
                  return null
                }
              }
              if (!struct.struct_value && !struct.literal) {
                return
              }
              let value
              switch (this.caps[Capabilities.NUANCE_NLU_ENTITY_VALUE_MODE]) {
                case 'FORCE_LITERAL':
                  value = struct.literal || JSON.stringify(struct.struct_value)
                  break
                case 'FORCE_STRUCT':
                  value = struct.struct_value ? JSON.stringify(struct.struct_value) : struct.literal
                  break
                case 'LITERAL_FOR_COMPLEX':
                default:
                  // entity struct can be very deep. It has more sense to return the literal instead
                  // "struct_value": {
                  //   "fields": {
                  //     "nuance_CALENDAR": {
                  //       "structValue": {
                  if (!struct.struct_value || !struct.struct_value.fields || !(Object.values(struct.struct_value.fields)[0].structValue)) {
                    value = JSON.stringify(struct.struct_value)
                  } else {
                    value = struct.literal
                  }
                  break
              }
              return { name: name, value: value, confidence: struct.confidence }
            }

            const _getBotiumEntity = (struct) => {
              // leaf
              const leaf = _extractLeaf(struct)
              if (leaf) {
                return leaf
              }

              // node
              // as I see an entry cant be both node and leaf?
              // https://docs.nuance.com/mix/apis/nlu-grpc/v1/ref-topics/interpretation-results-entities/#relationship-entity
              if (struct.entities) {
                for (const entry of _.isArray(struct.entities) ? struct.entities : Object.values(struct.entities)) {
                  const node = _getBotiumEntity(entry)
                  if (node) {
                    return node
                  }
                }
              }
            }
            const botiumEntity = _getBotiumEntity(struct)
            if (botiumEntity) {
              entities.push(botiumEntity)
            }
          }
        }
        if (entities.length > 0) {
          botMsg.nlp.entities = entities
        }
      }
    }

    for (const message of response.payload.messages || []) {
      const messageText = message.visual.map(({ text }) => text).join('\n')
      const toSend = Object.assign({}, botMsg, { messageText })
      debug(`Extacted message ${JSON.stringify(Object.assign({}, toSend, { sourceData: '...' }))}`)
      setTimeout(() => this.queueBotSays(toSend), 0)
    }
    if (response.payload.qa_action?.message.visual?.length) {
      const toSend = Object.assign({}, botMsg, {
        messageText: response.payload.qa_action.message.visual.map(({ text }) => text).join('\n')
      })
      /* eslint-disable camelcase */
      const buttons = response.payload.qa_action.selectable?.selectable_items?.map(({ display_text, value }) => ({
        text: display_text,
        payload: value.value
      }))
      /* eslint-enable camelcase */
      if (buttons && buttons.length) {
        toSend.buttons = buttons
      }
      debug(`Extacted message ${JSON.stringify(Object.assign({}, toSend, { sourceData: '...' }))}`)
      setTimeout(() => this.queueBotSays(toSend), 0)
    }
  }

  _sendMessage ({ messageText }) {
    const result = [new Promise((resolve, reject) => {
      this.dialogService.Execute({
        session_id: this.sessionId,
        selector: this.selector,
        payload: { user_input: messageText ? { user_text: messageText } : null }
      }, (error, res) => {
        const grpcError = getGrpcError(error, res)
        if (grpcError) {
          return reject(`Failed to send message: ${grpcError.message}`)
        }
        return resolve(res)
      })
    })]

    if (this.caps[Capabilities.NUANCE_NLP_ANALYTICS_ENABLE] && messageText) {
      // we use the same throttling for NLP as for Dialog technically, but api limits are not the same
      // we have to use different setting for the throttling to adopt different api limits
      result.push(new Promise((resolve, reject) => {
        this.nluService.Interpret({
          parameters: {
            interpretation_result_type: 'SINGLE_INTENT',
            max_interpretations: 5
          },
          model: {
            uri: `urn:nuance-mix:tag:model/${this.caps[Capabilities.NUANCE_CONTEXT_TAG]}/mix.nlu?=language=eng-USA`
          },
          client_data: this.caps[Capabilities.NUANCE_CLIENT_DATA],
          user_id: this.caps[Capabilities.NUANCE_USER_ID],
          input: {
            text: messageText
          }
        }, (error, res) => {
          const grpcError = getGrpcError(error, res)
          if (grpcError) {
            return reject(`Failed to retrieve NLP info: ${grpcError.message}`)
          }
          return resolve(res)
        })
      }))
    }

    return result
  }

  async _getAccessTokenWeak () {
    const now = new Date().getTime()
    if (this.accessToken && this.accessTokenExpires && now < this.accessTokenExpires) {
      debug(`Auth token reusing (${Math.trunc((this.accessTokenExpires - now) / 1000)}s remaining)`)
      return this.accessToken
    }

    this.accessTokenExpires = null
    this.accessToken = null

    try {
      debug('Auth token acquiring')

      const authResult = await authenticate(axios, this.caps)
      debug('Auth token acquired successful')
      this.accessTokenExpires = new Date().getTime() + (authResult.data.expires_in - 10) * 1000
      this.accessToken = authResult.data.access_token
      return this.accessToken
    } catch (err) {
      throw new Error(`Failed to get access token: ${err.message}`)
    }
  }
}

BotiumConnectorNuance.axios = axios
BotiumConnectorNuance.PROTOFILES = PROTOFILES

module.exports = BotiumConnectorNuance
