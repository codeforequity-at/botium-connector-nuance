require('dotenv').config()
const { exportHandler } = require('../../src/intents')
const { readCaps } = require('./helper')

describe('exporthandler', function () {
  beforeEach(async function () {
    this.caps = readCaps()
  })
  it('should successfully upload existing utterances', async function () {
    await exportHandler({ caps: this.caps }, {
      utterances: [
        {
          name: 'iBookFlight',
          utterances: ['flight status', 'book a flight']
        },
        {
          name: 'somenewintent',
          utterances: ['something new delme please now!!!!!!!!!!!!!!!']
        }
      ]
    }, {
      statusCallback: (data) => console.log(data)
    })
  }).timeout(50000)
})
