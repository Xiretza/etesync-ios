// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from 'react';
import { useSelector } from 'react-redux';
import { ParamListBase } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { Image, Linking, View } from 'react-native';
import { Divider, List, Text, Paragraph } from 'react-native-paper';
import SafeAreaView from 'react-native-safe-area-view';

import { StoreState } from './store';

import ScrollView from './widgets/ScrollView';
import ConfirmationDialog from './widgets/ConfirmationDialog';
import PrettyFingerprint from './widgets/PrettyFingerprint';
import Container from './widgets/Container';
import { Subheading } from './widgets/Typography';

import LogoutDialog from './LogoutDialog';
import { useRemoteCredentials } from './login';

import * as C from './constants';

const menuItems = [
  {
    title: 'Settings',
    path: 'Settings',
    icon: 'settings',
  },
];

const externalMenuItems = [
  {
    title: 'Report issue',
    link: C.reportIssue,
    icon: 'bug',
  },
  {
    title: 'Contact developer',
    link: `mailto:${C.contactEmail}`,
    icon: 'email',
  },
];

if (!C.genericMode) {
  externalMenuItems.unshift(
    {
      title: 'FAQ',
      link: C.faq,
      icon: 'forum',
    }
  );
  externalMenuItems.unshift(
    {
      title: 'Web site',
      link: C.homePage,
      icon: 'home',
    }
  );
}

function FingerprintDialog(props: { visible: boolean, onDismiss: () => void }) {
  const userInfo = useSelector((state: StoreState) => state.cache.userInfo);

  if (!userInfo) {
    return null;
  }

  const publicKey = userInfo.publicKey;

  return (
    <ConfirmationDialog
      title="Security Fingerprint"
      visible={props.visible}
      onOk={props.onDismiss}
      onCancel={props.onDismiss}
    >
      <>
        <Paragraph>
          Your security fingerprint is:
        </Paragraph>
        {publicKey &&
          <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 15 }}>
            <PrettyFingerprint publicKey={publicKey} />
          </View>
        }
      </>
    </ConfirmationDialog>
  );
}

interface PropsType {
  navigation: any;
}

export default function Drawer(props: PropsType) {
  const [showFingerprint, setShowFingerprint] = React.useState(false);
  const [showLogout, setShowLogout] = React.useState(false);
  const navigation = props.navigation as DrawerNavigationProp<ParamListBase>;
  const etesync = useRemoteCredentials();
  const loggedIn = !!etesync;
  const syncCount = useSelector((state: StoreState) => state.syncCount);

  return (
    <>
      <SafeAreaView style={{ backgroundColor: '#424242' }}>
        <Container style={{ backgroundColor: 'transparent' }}>
          <Image
            style={{ width: 48, height: 48, marginBottom: 15 }}
            source={require('./images/icon.png')}
          />
          <Subheading style={{ color: 'white' }}>{C.appName}</Subheading>
          {etesync &&
            <Text style={{ color: 'white' }}>{etesync.credentials.email}</Text>
          }
        </Container>
      </SafeAreaView>
      <ScrollView style={{ flex: 1 }}>
        <>
          {menuItems.map((menuItem) => (
            <List.Item
              key={menuItem.title}
              title={menuItem.title}
              onPress={() => {
                navigation.closeDrawer();
                navigation.navigate(menuItem.path);
              }}
              left={(props) => <List.Icon {...props} icon={menuItem.icon} />}
            />
          ))}
          {etesync &&
            <>
              <List.Item
                title="Show Fingerprint"
                onPress={() => {
                  setShowFingerprint(true);
                }}
                left={(props) => <List.Icon {...props} icon="fingerprint" />}
              />
            </>
          }
          {loggedIn &&
            <>
              <List.Item
                title="Logout"
                onPress={() => setShowLogout(true)}
                disabled={syncCount > 0}
                left={(props) => <List.Icon {...props} icon="exit-to-app" />}
              />
            </>
          }
        </>
        <Divider />
        <List.Section title="External links">
          {externalMenuItems.map((menuItem) => (
            <List.Item
              key={menuItem.title}
              title={menuItem.title}
              onPress={() => { Linking.openURL(menuItem.link) }}
              left={(props) => <List.Icon {...props} icon={menuItem.icon} />}
            />
          ))}
        </List.Section>
      </ScrollView>

      <FingerprintDialog visible={showFingerprint} onDismiss={() => setShowFingerprint(false)} />
      <LogoutDialog
        visible={showLogout}
        onDismiss={(loggedOut) => {
          if (loggedOut) {
            navigation.closeDrawer();
          }
          setShowLogout(false);
        }}
      />
    </>
  );
}
