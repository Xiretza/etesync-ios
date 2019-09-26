import * as localforage from 'localforage';
import { combineReducers } from 'redux';
import { createMigrate, persistReducer, createTransform } from 'redux-persist';
import session from 'redux-persist/lib/storage/session';

import { List, Map as ImmutableMap } from 'immutable';

import * as EteSync from '../api/EteSync';
import {
  JournalsData, FetchType, EntriesData, EntriesFetchRecord, UserInfoData, JournalsFetchRecord, UserInfoFetchRecord,
  CredentialsTypeRemote, JournalsType, EntriesType, UserInfoType, SettingsType,
  fetchCount, journals, entries, credentials, userInfo, settingsReducer, encryptionKeyReducer,
} from './reducers';

export interface StoreState {
  fetchCount: number;
  credentials: CredentialsTypeRemote;
  settings: SettingsType;
  encryptionKey: {key: string};
  cache: {
    journals: JournalsType;
    entries: EntriesType;
    userInfo: UserInfoType;
  };
}

const settingsPersistConfig = {
  key: 'settings',
  storage: localforage,
};

const credentialsPersistConfig = {
  key: 'credentials',
  storage: localforage,
  whitelist: ['value'],
};

const encryptionKeyPersistConfig = {
  key: 'encryptionKey',
  storage: session,
};

const journalsSerialize = (state: JournalsData) => {
  if (state === null) {
    return null;
  }

  return state.map((x, uid) => x.serialize()).toJS();
};

const journalsDeserialize = (state: {}) => {
  if (state === null) {
    return null;
  }

  const newState = new Map<string, EteSync.Journal>();
  Object.keys(state).forEach((uid) => {
    const x = state[uid];
    const ret = new EteSync.Journal(x.version);
    ret.deserialize(x);
    newState.set(uid, ret);
  });
  return ImmutableMap(newState);
};

const entriesSerialize = (state: FetchType<EntriesData>) => {
  if ((state === null) || (state.value == null)) {
    return null;
  }

  return state.value.map((x) => x.serialize()).toJS();
};

const entriesDeserialize = (state: EteSync.EntryJson[]): FetchType<EntriesData> => {
  if (state === null) {
    return new EntriesFetchRecord({value: null});
  }

  return new EntriesFetchRecord({value: List(state.map((x: any) => {
    let ret = new EteSync.Entry();
    ret.deserialize(x);
    return ret;
  }))});
};

const userInfoSerialize = (state: FetchType<UserInfoData>) => {
  if ((state === null) || (state.value == null)) {
    return null;
  }

  return state.value.serialize();
};

const userInfoDeserialize = (state: EteSync.UserInfoJson) => {
  if (state === null) {
    return null;
  }

  let ret = new EteSync.UserInfo(state.owner!, state.version);
  ret.deserialize(state);
  return ret;
};

const cacheSerialize = (state: any, key: string) => {
  if (key === 'entries') {
    let ret = {};
    state.forEach((value: FetchType<EntriesData>, mapKey: string) => {
      ret[mapKey] = entriesSerialize(value);
    });
    return ret;
  } else if (key === 'journals') {
    return journalsSerialize(state.value);
  } else if (key === 'userInfo') {
    return userInfoSerialize(state);
  }

  return state;
};

const cacheDeserialize = (state: any, key: string) => {
  if (key === 'entries') {
    let ret = {};
    Object.keys(state).forEach((mapKey) => {
      ret[mapKey] = entriesDeserialize(state[mapKey]);
    });
    return ImmutableMap(ret);
  } else if (key === 'journals') {
    return new JournalsFetchRecord({value: journalsDeserialize(state)});
  } else if (key === 'userInfo') {
    return new UserInfoFetchRecord({value: userInfoDeserialize(state)});
  }

  return state;
};

const cacheMigrations = {
  0: (state: any) => {
    return {
      ...state,
      journals: undefined
    };
  },
};

const cachePersistConfig = {
  key: 'cache',
  version: 1,
  storage: localforage,
  transforms: [createTransform(cacheSerialize, cacheDeserialize)],
  migrate: createMigrate(cacheMigrations, { debug: false}),
};

const reducers = combineReducers({
  fetchCount,
  settings: persistReducer(settingsPersistConfig, settingsReducer),
  credentials: persistReducer(credentialsPersistConfig, credentials),
  encryptionKey: persistReducer(encryptionKeyPersistConfig, encryptionKeyReducer),
  cache: persistReducer(cachePersistConfig, combineReducers({
    entries,
    journals,
    userInfo,
  })),
});

export default reducers;
