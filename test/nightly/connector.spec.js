require('dotenv').config()
const assert = require('chai').assert
const BotiumConnectorNuance = require('../../src/connector')
const { readCaps } = require('./helper')

describe('connector', function () {
  beforeEach(async function () {
    this.timeout(20000)
    this.caps = readCaps()
    this.botMsgs = []
    const queueBotSays = (botMsg) => {
      if (this.botMsgPromiseResolve) {
        this.botMsgPromiseResolve(botMsg)
        this.botMsgPromiseResolve = null
      } else {
        this.botMsgs.push(botMsg)
      }
    }
    this.connector = new BotiumConnectorNuance({ queueBotSays, caps: this.caps })
    await this.connector.Validate()
    await this.connector.Start()
    this._nextBotMsg = async () => {
      const nextBotMsg = this.botMsgs.shift()
      if (nextBotMsg) {
        return nextBotMsg
      }
      return new Promise(resolve => {
        this.botMsgPromiseResolve = resolve
      })
    }
  })


  it('should successfully execute a simple convo with buttons', async function () {
    const res1 = await this._nextBotMsg()
    assert.equal(res1.messageText, 'Hi I\'m Windborne Airlines\' virtual assistant.')
    console.log('Bot message 1/1 valid')

    const res2 = await this._nextBotMsg()
    assert.equal(res2.messageText, 'I can help with lots of things, like your Flight Status, Booking a Flight or Looking for Lost Luggage. How can I help you today?')
    console.log('Bot message 1/2 valid')

    await this.connector.UserSays({ messageText: 'book a flight for tomorrow' })
    console.log('User message sent')

    const res3 = await this._nextBotMsg()
    assert.equal(res3.messageText, 'Sure I can help you with that.')
    console.log('Bot message 2/1 valid')

    const res4 = await this._nextBotMsg()
    assert.equal(res4.messageText, 'Where do you want to go?')
    assert.isTrue(!!res4.buttons?.find(button => (button.text === 'Atlanta')), '"Atlanta" button not found')
    console.log('Bot message 2/2 valid')
  }).timeout(25000)

  afterEach(async function () {
    await this.connector.Stop()
  })
})
