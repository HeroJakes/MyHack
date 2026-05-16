import { onRequest } from 'firebase-functions/v2/https'
import logger from 'firebase-functions/logger'

export const helloWorld = onRequest((request, response) => {
  logger.info('Hello logs from Firebase Functions', { structuredData: true })
  response.send('Hello from Firebase Functions!')
})
