import * as Y                 from './dist/SyncedStore-bundle.esm.js'
import { LWWMap,getYjsValue } from './dist/SyncedStore-bundle.esm.js'
import { syncedStore }        from './dist/SyncedStore-bundle.esm.js'
import { Observable }         from './dist/SyncedStore-bundle.esm.js'
import { getYjsDoc }          from './dist/SyncedStore-bundle.esm.js'

/**** MockSyncProvider - used to simulate synchronization without actual network ****/

class MockSyncProvider extends Observable {
  constructor (DocumentName, Store) {
    super()
    this.DocumentName = DocumentName
    this.Store        = Store
    this.connected    = true
    this.SyncPartners = []
    this.UpdateQueue  = []             // updates not yet sent to "SyncPartners"
    
  /**** internal state tracking ****/

    this.Updates   = 0
    this.Conflicts = 0
    
    this.Store.on('update', this._handleUpdate.bind(this))
  }

/**** connect ****/

  connect () {
    this.connected = true
    
    if (this.UpdateQueue.length > 0) {            // process any queued messages
      const UpdateQueue = [...this.UpdateQueue]; this.UpdateQueue = []
      UpdateQueue.forEach((Update) => {  // send pending updates to all partners
        this.SyncPartners.forEach((Partner) => {
          Partner._receiveUpdate(Update,this)
        })  
      })
    }
    
    this.emit('status', [{ status:'connected' }])
    return this
  }
  
/**** disconnect ****/

  disconnect () {
    this.connected = false
    this.emit('status', [{ status:'disconnected' }])
    return this
  }
  
/**** destroy ****/

  destroy () {
    this.disconnect()
    this.SyncPartners = []
    this.Store.off('update', this._handleUpdate)
    this.emit('status', [{ status:'destroyed' }])
    return this
  }
   
/**** addSyncPartner ****/
 
  addSyncPartner (Partner) {
    if (! this.SyncPartners.includes(Partner)) {
      this.SyncPartners.push(Partner)
      Partner.SyncPartners.push(this)
    }
    return this
  }
     
/**** _handleUpdate - processes changes made in the local store ****/

  _handleUpdate (Update,Origin) {
    if (Origin === this) return           // skip updates we generated ourselves

    this.Updates++
   
  /**** propagate update to all connected sync partners ****/

    if (this.connected) { 
      this.SyncPartners.forEach((Partner) => {
        Partner._receiveUpdate(Update,this)
      })
    } else {                     // queue update for when connection is restored
      this.UpdateQueue.push(Update)
    }
  }
       
/**** _receiveUpdate - invoked by the sender of an update(!) while sender is connected ****/

  _receiveUpdate (Update,Sender) {
    if (! this.connected) {
      this.UpdateQueue.push(Update)
      return
    }
    
    try {                                           // apply the update to store
      Y.applyUpdate(this.Store, Update, Sender)
    } catch (err) {
      this.Conflicts++
      console.warn('Conflict detected during sync:', err)
      
      // in real CRDT, conflicts are resolved automatically
      // here we simulate conflict resolution
      this.emit('conflict', {
        update:  Update,
        resolved:true
      })
    }
  }
}

/**** runTests - executes all test cases ****/

  async function runTests () {
    console.log('starting SyncedStore tests with mocked provider...')
    
    await testStoreInitialization()
    await testMockedSyncProviderSetup()
    await testDataSynchronization()
    await testConflictResolution()             // is subject to race conditions!
    await testOfflineSimulation()
    await testObservability()
    await testAdvancedDataTypes()
    await testCleanup()
    
    console.log('all tests completed!')
  }

/**** testStoreInitialization - Test Case 1 ****/

  async function testStoreInitialization () {
    console.log('\n1. testing store initialization...')
    
    const Store = syncedStore({ 
      Users:   {}, 
      Messages:[] 
    })
    
    const Provider = new MockSyncProvider('test-doc', getYjsDoc(Store))
    
    console.assert(Provider instanceof MockSyncProvider, 'Provider should be an instance of MockSyncProvider')
    console.assert(Provider.connected === true,          'Provider should be connected by default')
    
    console.log('✓ Store initialization test passed')
  }

/**** testMockedSyncProviderSetup - Test Case 2 ****/

  async function testMockedSyncProviderSetup () {
    console.log('\n2. testing mocked SyncProvider setup...')
    
    const Store    = syncedStore({ Counter:{} })
    const Doc      = getYjsDoc(Store)
    const Provider = new MockSyncProvider('test-doc', Doc)
    
  /**** track update events ****/

    let UpdateCaptured = false
    Doc.on('update', () => {
      UpdateCaptured = true
    })
    
    Store.Counter.Value = 1                                     // make a change
    
    console.assert(UpdateCaptured,       'Provider should capture updates')
    console.assert(Provider.Updates > 0, 'Update counter should increase')
    
    console.log('✓ Mocked SyncProvider setup test passed')
  }

/**** testDataSynchronization - Test Case 3 ****/

  async function testDataSynchronization () {
    console.log('\n3. testing data synchronization...')
    
  /**** create two stores ****/

    const StoreA = syncedStore({ Counter:{}, Tasks:[] })
    const StoreB = syncedStore({ Counter:{}, Tasks:[] })
    
  /**** create providers and link them ****/
    
    const ProviderA = new MockSyncProvider('sync-doc', getYjsDoc(StoreA))
    const ProviderB = new MockSyncProvider('sync-doc', getYjsDoc(StoreB))
    
    ProviderA.addSyncPartner(ProviderB)
    
  /**** make changes in store A ****/
    
    StoreA.Counter.Value = 5
    StoreA.Tasks.push('Task 1')
    
  /**** check if changes synchronized to store B ****/
    
    console.assert(StoreB.Counter.Value === 5,        'Counter should be synchronized')
    console.assert(StoreB.Tasks.length  === 1,        'Tasks array should be synchronized')
    console.assert(StoreB.Tasks[0]      === 'Task 1', 'Task content should be synchronized')
    
  /**** test batch updates ****/
    
    StoreB.Tasks.push('Task 2')
    StoreB.Tasks.push('Task 3')
    StoreB.Counter.Value = 10
    
    console.assert(StoreA.Counter.Value === 10, 'Batch updates should synchronize count')
    console.assert(StoreA.Tasks.length  === 3,  'Batch updates should synchronize all tasks')
    
    console.log('✓ Data synchronization test passed')
  }

/**** testConflictResolution - Test Case 4 ****/

  async function testConflictResolution () {
    console.log('\n4. testing conflict resolution...')
    
  /**** create two stores with same initial data ****/

    const StoreA = syncedStore({ Contents:{} })
    const StoreB = syncedStore({ Contents:{} })
    
  /**** create providers ****/
    
    const ProviderA = new MockSyncProvider('conflict-doc', getYjsDoc(StoreA))
    const ProviderB = new MockSyncProvider('conflict-doc', getYjsDoc(StoreB))
    
    let ConflictDetected = false
    ProviderA.on('conflict', () => {
      ConflictDetected = true
    })

  /**** link providers but disconnect them to simulate offline changes ****/
    
    ProviderA.addSyncPartner(ProviderB)                     // this is bilateral
    ProviderA.disconnect(); ProviderB.disconnect()        // "disconnect" is not
    
  /**** make conflicting changes ****/
    
    StoreA.Contents.Value = 'changed by A'
    StoreB.Contents.Value = 'changed by B'
    
  /**** reconnect to sync changes ****/
    
    ProviderA.connect(); ProviderB.connect()           // ...and so is "connect"
    await new Promise((resolve) => setTimeout(resolve,100)) // wait for updates to be applied

    console.assert(ConflictDetected == false, 'conflict should have been resolved')
    
    // due to CRDT nature, one value should deterministically win and
    // both stores should converge to the same Value
    console.assert(StoreA.Contents.Value === StoreB.Contents.Value, 'Stores should converge to the same Value after conflict')
    if (StoreA.Contents.Value !== StoreB.Contents.Value) {
      console.log('StoreA.Contents.Value',StoreA.Contents.Value)
      console.log('StoreB.Contents.Value',StoreB.Contents.Value)
    }

    console.log('✓ Conflict resolution test passed')
  }

/**** testOfflineSimulation - Test Case 5 ****/

  async function testOfflineSimulation () {
    console.log('\n5. testing offline simulation...')
    
  /**** create two stores with providers ****/

    const StoreA = syncedStore({ Messages:[] })
    const StoreB = syncedStore({ Messages:[] })
    
    const ProviderA = new MockSyncProvider('offline-doc', getYjsDoc(StoreA))
    const ProviderB = new MockSyncProvider('offline-doc', getYjsDoc(StoreB))
    
    ProviderA.addSyncPartner(ProviderB)
    
  /**** disconnect provider A (simulating offline) ****/
    
    ProviderA.disconnect()
    
  /**** make changes while B is offline ****/
    
    StoreA.Messages.push('Message 1')
    StoreA.Messages.push('Message 2')
    StoreA.Messages.push('Message 3')
    
  /**** Store B shouldn't see the changes yet ****/
    
    console.assert(StoreB.Messages.length === 0, 'Offline store should not receive updates')
    
  /**** reconnect A ****/
    
    ProviderA.connect()
    
  /**** now B should have all Messages ****/
    
    console.assert(StoreB.Messages.length === 3,           'Reconnected store should receive queued updates')
    console.assert(StoreB.Messages[0]     === 'Message 1', 'First message should be synchronized')
    console.assert(StoreB.Messages[2]     === 'Message 3', 'Last message should be synchronized')
    
    console.log('✓ Offline simulation test passed')
  }

/**** testObservability - Test Case 6 ****/

  async function testObservability () {
    console.log('\n6. testing observability...')
    
    const Store = syncedStore({ 
      Counter:{},
      nested: {}
    })
    Store.Counter.Value = 0
    Store.nested.Value = 'initial'
    
    const Provider = new MockSyncProvider('observe-doc', getYjsDoc(Store))
    
    let UpdateCount   = 0
    let StatusChanges = 0
    
    getYjsDoc(Store).on('update', () => {
      UpdateCount++
    })
    
    Provider.on('status', () => {
      StatusChanges++
    })
    
  /**** make changes to trigger updates ****/

    Store.Counter.Value = 1
    Store.nested.Value  = 'changed'
    
  /**** disconnect to trigger status change ****/
    
    Provider.disconnect()
    
    console.assert(UpdateCount   >= 2, 'Observer should detect store updates')
    console.assert(StatusChanges >= 1, 'Observer should detect status changes')
    
    console.log('✓ Observability test passed')
  }

/**** testAdvancedDataTypes - Test Case 7 ****/

  async function testAdvancedDataTypes () {
    console.log('\n7. testing advanced data types...')
    
  /**** create stores with various data types ****/

    const StoreA = syncedStore({
      LWWMapVector:[],
      KeyValue:    {},
      longText:    'text',
      nestedStructure:{} // contents of nested structures are automatically observed
    })
    
    const StoreB = syncedStore({
      LWWMapVector:[],
      KeyValue:    {},
      longText:    'text',
      nestedStructure:{} // contents of nested structures are automatically observed
    })
    
  /**** set up synchronization ****/
    
    const ProviderA = new MockSyncProvider('types-doc', getYjsDoc(StoreA))
    const ProviderB = new MockSyncProvider('types-doc', getYjsDoc(StoreB))
    
    ProviderA.addSyncPartner(ProviderB)
    
  /**** test Key-Value ****/
    
    Object.assign(StoreA.KeyValue, { User:'alice', Role:'admin' })
    
  /**** test long text ****/
    
    StoreA.longText.insert(0, `
  This is a multi-line text
  that tests the synchronization
  of longer content.
    `.trim())
    
  /**** test nested structures ****/
    
    const LWWMapA = new LWWMap(getYjsValue(StoreA.LWWMapVector))
      LWWMapA.set('Key','Value')
    StoreA.nestedStructure.Arrays = [[],[]]
    StoreA.nestedStructure.Maps   = { first:{}, second:{} }

    StoreA.nestedStructure.Arrays[0].push('item1', 'item2')    // should trigger update
    StoreA.nestedStructure.Maps.first.Prop = 'nested property' // should trigger update
    
  /**** verify synchronization of all types ****/
       
    const LWWMapB = new LWWMap(getYjsValue(StoreB.LWWMapVector))
    console.assert(LWWMapB.get('Key') === 'Value', 'LWWMap should sync')

    console.assert(StoreB.KeyValue.User === 'alice',                 'Key-Value should sync')
    console.assert(StoreB.longText.toString().includes('multi-line'),'Text should sync')
    console.assert(StoreB.nestedStructure.Arrays[0].length === 2,    'Arrays should sync')
    console.assert(StoreB.nestedStructure.Maps.first.Prop  === 'nested property', 'Nested Maps should sync')
    
    console.log('✓ Advanced data types test passed')
  }

/**** testCleanup - Test Case 8 ****/

  async function testCleanup () {
    console.log('\n8. testing cleanup...')
    
    const Store = syncedStore({ Data:{} })
      Store.Data.Value = 'test'
    const Provider = new MockSyncProvider('cleanup-doc', getYjsDoc(Store))
    
  /**** make changes to ensure provider is working ****/

    Store.Data.Value = 'before cleanup'
    
  /**** destroy the provider ****/
    
    Provider.destroy()
    
    console.assert(Provider.connected === false, 'Provider should be disconnected after destroy')
    
  /**** try to make changes after destroy ****/
    
    Store.Data.Value = 'after cleanup'
        
    let UpdateReceived = false
    getYjsDoc(Store).on('update', () => {
      UpdateReceived = true
    })
    
  /**** original provider should not interfere ****/
    
    Store.Data.Value = 'final Value'
    
    console.assert(UpdateReceived,                     'new provider should work correctly')
    console.assert(Store.Data.Value === 'final Value', 'Store should be usable after provider cleanup')
    
    console.log('✓ Cleanup test passed')
  }

/**** run all the tests ****/

  runTests()