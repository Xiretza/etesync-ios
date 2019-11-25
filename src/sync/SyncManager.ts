import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';

import * as EteSync from 'etesync';
import { Action } from 'redux-actions';

const CURRENT_VERSION = EteSync.CURRENT_VERSION;

import { syncInfoSelector } from '../SyncHandler';
import { store, persistor, CredentialsData, JournalsData, SyncStateJournalData, SyncStateEntryData } from '../store';
import { addJournal, fetchAll, fetchEntries, fetchUserInfo, createUserInfo } from '../store/actions';

import { logger } from '../logging';

// import { SyncManagerAddressBook } from './SyncManagerAddressBook';
import { SyncManagerCalendar } from './SyncManagerCalendar';
import { SyncManagerTaskList } from './SyncManagerTaskList';

import sjcl from 'sjcl';
import * as Random from 'expo-random';

async function prngAddEntropy() {
  const entropyBits = 1024;
  const bytes = await Random.getRandomBytesAsync(entropyBits / 8);
  const buf = new Uint32Array(new Uint8Array(bytes).buffer);
  sjcl.random.addEntropy(buf as any, entropyBits, 'Random.getRandomBytesAsync');
}
// we seed the entropy in the beginning + on every sync
prngAddEntropy();

export class SyncManager {
  public static getManager(etesync: CredentialsData) {
    // FIXME: Should make a singleton per etesync
    return new SyncManager(etesync);
  }

  protected etesync: CredentialsData;
  protected userInfo: EteSync.UserInfo;
  protected collectionType: string;
  protected syncStateJournals: SyncStateJournalData;
  protected syncStateEntries: SyncStateEntryData;

  private managers = [
    SyncManagerCalendar,
    SyncManagerTaskList,
    // SyncManagerAddressBook,
  ];

  constructor(etesync: CredentialsData) {
    this.etesync = etesync;
  }

  public async fetchAllJournals() {
    const entries = store.getState().cache.entries;
    const etesync = this.etesync;
    const me = etesync.credentials.email;

    const userInfoAction = await store.dispatch(fetchUserInfo(etesync, me));
    let userInfo = await userInfoAction.payload;
    if (userInfoAction.error || !userInfoAction.payload) {
      userInfo = new EteSync.UserInfo(me, CURRENT_VERSION);
      const keyPair = EteSync.AsymmetricCryptoManager.generateKeyPair();
      const cryptoManager = userInfo.getCryptoManager(etesync.encryptionKey);

      userInfo.setKeyPair(cryptoManager, keyPair);

      await store.dispatch(createUserInfo(etesync, userInfo));
    }

    const haveJournals = await store.dispatch<any>(fetchAll(etesync, entries));
    if (!haveJournals) {
      for (const collectionType of ['ADDRESS_BOOK', 'CALENDAR', 'TASKS']) {
        const collection = new EteSync.CollectionInfo();
        collection.uid = EteSync.genUid();
        collection.type = collectionType;
        collection.displayName = 'Default';

        const journal = new EteSync.Journal({ uid: collection.uid });
        const keyPair = userInfo.getKeyPair(userInfo.getCryptoManager(etesync.encryptionKey));
        const cryptoManager = journal.getCryptoManager(etesync.encryptionKey, keyPair);
        journal.setInfo(cryptoManager, collection);
        const journalAction: Action<EteSync.Journal> = await store.dispatch<any>(addJournal(etesync, journal));
        // FIXME: Limit based on error code to only do it for associates.
        if (!journalAction.error) {
          await store.dispatch(fetchEntries(etesync, collection.uid, null));
        }
      }
    }
  }

  public async sync() {
    const keepAwakeTag = 'SyncManager';
    const storeState = store.getState();

    if (storeState.connection?.type === 'none') {
      logger.info('Disconnected, aborting sync');
      return false;
    }

    try {
      activateKeepAwake(keepAwakeTag);
      prngAddEntropy();
      await this.fetchAllJournals();

      const entries = storeState.cache.entries;
      const journals = storeState.cache.journals as JournalsData; // FIXME: no idea why we need this cast.
      const userInfo = storeState.cache.userInfo!;
      syncInfoSelector({ etesync: this.etesync, entries, journals, userInfo });

      // FIXME: make the sync parallel
      for (const syncManager of this.managers.map((ManagerClass) => new ManagerClass(this.etesync, userInfo))) {
        await syncManager.init();
        await syncManager.sync();
      }

      // We do it again here so we decrypt the newly added items too
      syncInfoSelector({ etesync: this.etesync, entries, journals, userInfo });
    } catch (e) {
      if (e instanceof EteSync.NetworkError) {
        // Ignore network errors
        return false;
      }
      throw e;
    } finally {
      deactivateKeepAwake(keepAwakeTag);
    }

    // Force flusing the store to disk
    persistor.persist();

    return true;
  }

  public async clearDeviceCollections() {
    const storeState = store.getState();
    const userInfo = storeState.cache.userInfo!;

    for (const syncManager of this.managers.map((ManagerClass) => new ManagerClass(this.etesync, userInfo))) {
      await syncManager.init();
      await syncManager.clearDeviceCollections();
    }
  }
}
