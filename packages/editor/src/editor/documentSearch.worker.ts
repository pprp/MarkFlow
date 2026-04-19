import { countFuzzySearchMatches } from './documentSearch'

type DocumentSearchWorkerRequest = {
  requestId: number
  content: string
  query: string
}

type DocumentSearchWorkerResponse = {
  requestId: number
  count: number
}

self.addEventListener('message', (event: MessageEvent<DocumentSearchWorkerRequest>) => {
  const response: DocumentSearchWorkerResponse = {
    requestId: event.data.requestId,
    count: countFuzzySearchMatches(event.data.content, event.data.query),
  }

  self.postMessage(response)
})

export {}
