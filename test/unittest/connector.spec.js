const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const assert = chai.assert
const debug = require('debug')('botium-connector-nuance-unittest-connector')

const Connector = require('../../src/connector')
const capsWithNlp = require('./data/mocked_botium_full.json').botium.Capabilities

const USER_MESSAGE_WELCOME = 'WELCOME'
const NUANCE_NLP_RESPONSE_WITH_DEEP_ENTITY = require('./data/nuanceNlpResponseWithDeepEntity.json')
const NUANCE_NLP_RESPONSE_BUTTONS = require('./data/nuanceNlpResponseButtons.json')

const REQUEST_TO_RESPONSE = {
  [USER_MESSAGE_WELCOME]: {
    // we dont ask for welcome message
    request: null,
    response: {
      payload: {
        messages: [
          {
            visual: [
              {
                text: "mockedMessage"
              }
            ],
          }
        ],
        qa_action: {
          message: {
            "visual": [
              {
                "text": "mockedQaText"
              }
            ],
          }
        }
      }
    },
    nlpResponse: 'It is not called at all',
    expectedBotiumMessages: [
      {
        messageText: "mockedMessage"
      }, {
        messageText: "mockedQaText"
      }
    ]
  },
  "Show me buttons": {
    request: "Show me buttons",
    "response": {
      "payload": {
        "qa_action": {
          "message": {
            "visual": [
              {
                "text": "Where do you want to go?"
              }
            ]
          },
          "selectable": {
            "selectable_items": [
              {
                "value": {
                  "id": "eArrivalCity",
                  "value": "Atlanta"
                },
                "description": "",
                "display_text": "Atlanta",
                "display_image_uri": ""
              },
              {
                "value": {
                  "id": "eArrivalCity",
                  "value": "Cleveland"
                },
                "description": "",
                "display_text": "Cleveland",
                "display_image_uri": ""
              }
            ]
          }
        }
      }
    },
    nlpResponse: NUANCE_NLP_RESPONSE_BUTTONS,
    expectedBotiumMessages: [
      {
        "buttons": [
          {
            "payload": "Atlanta",
            "text": "Atlanta"
          },
          {
            "payload": "Cleveland",
            "text": "Cleveland"
          }
        ],
        "messageText": "Where do you want to go?",
        "nlp": {
          "entities": [
            {
              "confidence": 0.9597064256668091,
              "name": "eDepartureDate",
              "value": "tomorrow"
            }
          ],
          "intent": {
            "confidence": 0.9976494908332825,
            "incomprehension": false,
            "intents": [
              {
                "confidence": 0.000567290117032826,
                "name": "iFlightStatus"
              },
              {
                "confidence": 0.00019170483574271202,
                "name": "iEntities"
              }
            ],
            "name": "iBookFlight"
          }
        }
      }
    ]
  },
  "Show me deep entity": {
    request: "Show me deep entity",
    response: {
      payload: {
        messages: [
          {
            "visual": [
              {
                "text": "mockedMessage"
              }
            ],
          }
        ]
      }
    },
    nlpResponse: NUANCE_NLP_RESPONSE_WITH_DEEP_ENTITY,
    expectedBotiumMessages: [
      {
        "messageText": "mockedMessage",
        "nlp": {
          "entities": [
            {
              "confidence": 0.9597064256668091,
              "name": "eDepartureDate",
              "value": "tomorrow"
            }
          ],
          "intent": {
            "confidence": 0.9976494908332825,
            "incomprehension": false,
            "intents": [
              {
                "confidence": 0.000567290117032826,
                "name": "iFlightStatus"
              },
              {
                "confidence": 0.00019170483574271202,
                "name": "iEntities"
              }
            ],
            "name": "iBookFlight"
          }
        }
      }]
  }

}

describe('connector', function () {
  describe('rich elements', function () {
    beforeEach(async function () {

      this.botMsgs = []
      const queueBotSays = (botMsg) => {
        delete botMsg.sourceData
        if (this.botMsgPromiseResolve) {
          this.botMsgPromiseResolve(botMsg)
          this.botMsgPromiseResolve = null
        } else {
          this.botMsgs.push(botMsg)
        }
      }
      this._nextBotMsg = async () => {
        const nextBotMsg = this.botMsgs.shift()
        if (nextBotMsg) {
          return nextBotMsg
        }
        return new Promise(resolve => {
          this.botMsgPromiseResolve = resolve
        })
      }
      const connector = new Connector({
        caps: capsWithNlp,
        queueBotSays,
        testContext: {
          dialogService: (dialogService) => {
            dialogService.Start = (startRequest, callback) => {
              setTimeout(() => callback(null,
                {
                  payload: {
                    session_id: 'mockedSessionId'
                  }
                }
              ), 500)
            }
            dialogService.Execute = (executeRequest, callback) => {
              const messageText = executeRequest.payload?.user_input?.user_text || USER_MESSAGE_WELCOME
              setTimeout(() => callback(null, REQUEST_TO_RESPONSE[messageText].response), 500)
            }
            dialogService.Stop = (stopRequest, callback) => {
              setTimeout(() => callback(null, {}), 500)
            }
          },
          nluService: function (nluService) {
            nluService.Interpret = (interpretRequest, callback) => {
              const messageText = interpretRequest?.input?.text
              if (!messageText) {
                throw new Error('message text not found')
              }
              setTimeout(() => callback(null, REQUEST_TO_RESPONSE[messageText].nlpResponse), 500)
            }
          }
        }
      })

      await connector.Validate()
      await connector.Start()
      this.connector = connector
    })

    Object.entries(REQUEST_TO_RESPONSE).forEach(([name, entry]) => {
      // we dont ask for welcome message
      if (entry.request) {
        it(`should handle ${name}`, async function () {
          const res1 = await this._nextBotMsg()
          debug(`bot message received ${JSON.stringify(res1)}`)
          assert.deepEqual(res1, REQUEST_TO_RESPONSE[USER_MESSAGE_WELCOME].expectedBotiumMessages[0])

          const res2 = await this._nextBotMsg()
          debug(`bot message received ${JSON.stringify(res2)}`)
          assert.deepEqual(res2, REQUEST_TO_RESPONSE[USER_MESSAGE_WELCOME].expectedBotiumMessages[1])

          await this.connector.UserSays({messageText: entry.request})

          for (const expectedBotiumMessage of entry.expectedBotiumMessages) {
            const res3 = await this._nextBotMsg()
            debug(`bot message received ${JSON.stringify(res3)}`)
            assert.deepEqual(res3, expectedBotiumMessage)
          }
        })
      }
    })

    afterEach(async function () {
      if (this.connector) {
        await this.connector.Stop()
        this.connector = null
        this.mock = null
      }
    })
  })
})
