export * from 'yjs'

// @ts-ignore 
import {
  syncedStore, SyncedDoc,SyncedArray,SyncedMap,SyncedXml,SyncedText, Box,boxed,
  observeDeep, areSame, 
  Y, getYjsDoc,getYjsValue
} from "@syncedstore/core"
// @ts-ignore 
import { PREFERRED_TRIM_SIZE, fetchUpdates, storeState, clearDocument, IndexeddbPersistence } from 'y-indexeddb'
// @ts-ignore
import { WebsocketProvider, messageAuth, messageAwareness, messageQueryAwareness, messageSync } from 'y-websocket'
// @ts-ignore
import { WebrtcConn, Room, SignalingConn, WebrtcProvider } from 'y-webrtc'
// @ts-ignore
import { YKeyValue } from 'y-utility/y-keyvalue'
// @ts-ignore
import { LWWMap } from 'y-lwwmap'
// @ts-ignore
import { Observable } from 'lib0/observable'

export {
  PREFERRED_TRIM_SIZE, fetchUpdates, storeState, clearDocument, IndexeddbPersistence,
  WebsocketProvider, messageAuth, messageAwareness, messageQueryAwareness, messageSync,
  WebrtcConn, Room, SignalingConn, WebrtcProvider,
  YKeyValue, LWWMap,
  Observable,
  syncedStore, SyncedDoc,SyncedArray,SyncedMap,SyncedXml,SyncedText, Box,boxed,
  observeDeep, areSame, 
  Y, getYjsDoc,getYjsValue
}
