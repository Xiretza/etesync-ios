// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Linking, TextInput as NativeTextInput } from "react-native";
import { List, HelperText, Switch, useTheme } from "react-native-paper";
import { useDispatch, useSelector } from "react-redux";

import * as Etebase from "etebase";

import { logger, LogLevel } from "./logging";

import { useCredentials } from "./credentials";

import ScrollView from "./widgets/ScrollView";
import ConfirmationDialog from "./widgets/ConfirmationDialog";
import PasswordInput from "./widgets/PasswordInput";
import SyncSettings from "./sync/SyncSettings";

import { StoreState, useAsyncDispatch } from "./store";
import { setSettings, loginEb } from "./store/actions";

import * as C from "./constants";
import { startTask, enforcePasswordRules } from "./helpers";
import { useNavigation } from "@react-navigation/native";

interface DialogPropsType {
  visible: boolean;
  onDismiss: () => void;
}

interface EncryptionFormErrors {
  oldPassword?: string;
  newPassword?: string;
}

function ChangePasswordDialog(props: DialogPropsType) {
  const etebase = useCredentials()!;
  const dispatch = useAsyncDispatch();
  const [errors, setErrors] = React.useState<EncryptionFormErrors>({});
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");

  async function onOk() {
    const fieldNotEmpty = "Password can't be empty.";
    const errors: EncryptionFormErrors = {};
    if (!oldPassword) {
      errors.oldPassword = fieldNotEmpty;
    }
    if (!newPassword) {
      errors.newPassword = fieldNotEmpty;
    } else {
      const passwordRulesError = enforcePasswordRules(newPassword);
      if (passwordRulesError) {
        errors.newPassword = passwordRulesError;
      }
    }

    setErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    await startTask(async () => {
      const serverUrl = etebase.serverUrl;
      logger.info("Changing encryption password");
      logger.info("Verifying old key");
      const username = etebase.user.username;
      try {
        const etebase = await Etebase.Account.login(username, oldPassword, serverUrl);
        await etebase.logout();
      } catch (e) {
        if (e instanceof Etebase.UnauthorizedError) {
          setErrors({ oldPassword: "Error: wrong encryption password." });
        } else {
          setErrors({ oldPassword: e.toString() });
        }
        return;
      }

      logger.info("Setting new password");
      try {
        await etebase.changePassword(newPassword);
        dispatch(loginEb(etebase));
      } catch (e) {
        setErrors({ newPassword: e.toString() });
      }
    });
  }

  const newPasswordRef = React.createRef<NativeTextInput>();

  return (
    <ConfirmationDialog
      title="Change Encryption Password"
      visible={props.visible}
      onOk={onOk}
      onCancel={props.onDismiss}
    >
      <>
        <PasswordInput
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => newPasswordRef.current!.focus()}
          error={!!errors.oldPassword}
          label="Current Password"
          value={oldPassword}
          onChangeText={setOldPassword}
        />
        <HelperText
          type="error"
          visible={!!errors.oldPassword}
        >
          {errors.oldPassword}
        </HelperText>

        <PasswordInput
          ref={newPasswordRef}
          error={!!errors.newPassword}
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <HelperText
          type="error"
          visible={!!errors.newPassword}
        >
          {errors.newPassword}
        </HelperText>
      </>
    </ConfirmationDialog>
  );
}

const SettingsScreen = function _SettingsScreen() {
  const etebase = useCredentials();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const settings = useSelector((state: StoreState) => state.settings);

  const [showChangePasswordDialog, setShowChangePasswordDialog] = React.useState(false);

  const loggedIn = !!etebase;

  return (
    <>
      <ScrollView style={{ flex: 1 }}>
        {loggedIn && (
          <List.Section>
            <List.Subheader>Account</List.Subheader>
            {!C.genericMode &&
              <List.Item
                title="Account Dashboard"
                description="Change your payment info, plan and other account settings"
                onPress={() => { Linking.openURL(C.dashboard) }}
              />
            }
            <List.Item
              title="Change Password"
              description="Change your account's password"
              onPress={() => { setShowChangePasswordDialog(true) }}
            />
          </List.Section>
        )}

        <List.Section>
          <List.Subheader>General</List.Subheader>
          <List.Item
            title="About"
            description="About and open source licenses"
            onPress={() => {
              navigation.navigate("About");
            }}
          />
        </List.Section>

        {(C.syncAppMode) && (
          <List.Section>
            <List.Subheader>Advanced</List.Subheader>
            <SyncSettings />
          </List.Section>
        )}

        <List.Section>
          <List.Subheader>Debugging</List.Subheader>
          <List.Item
            title="Enable Logging"
            description={(settings.logLevel === LogLevel.Off) ? "Click to enable debug logging" : "Click to disable debug logging"}
            accessible={false}
            right={(props) =>
              <Switch
                {...props}
                color={theme.colors.accent}
                value={settings.logLevel !== LogLevel.Off}
                onValueChange={(value) => {
                  dispatch(setSettings({ logLevel: (value) ? LogLevel.Debug : LogLevel.Off }));
                }}
              />
            }
          />
          <List.Item
            title="View Logs"
            description="View previously collected debug logs"
            onPress={() => {
              navigation.navigate("DebugLogs");
            }}
          />
        </List.Section>
      </ScrollView>

      <ChangePasswordDialog visible={showChangePasswordDialog} onDismiss={() => setShowChangePasswordDialog(false)} />
    </>
  );
};

export default SettingsScreen;
