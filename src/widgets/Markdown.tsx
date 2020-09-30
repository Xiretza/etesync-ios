// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Linking } from "react-native";
import { useTheme } from "react-native-paper";
import MarkdownDisplay from "react-native-markdown-display";

const Markdown = React.memo(function _Markdown(props: { content: string }) {
  const theme = useTheme();

  const blockBackgroundColor = (theme.dark) ? "#555555" : "#cccccc";

  return (
    <MarkdownDisplay
      style={{
        body: { color: theme.colors.text },
        link: { color: theme.colors.accent, textDecorationLine: "underline" },
        hr: { backgroundColor: theme.colors.placeholder },
        blockquote: { backgroundColor: blockBackgroundColor },
        code_inline: { backgroundColor: blockBackgroundColor }, // eslint-disable-line @typescript-eslint/camelcase
        code_block: { backgroundColor: blockBackgroundColor }, // eslint-disable-line @typescript-eslint/camelcase
        fence: { backgroundColor: blockBackgroundColor },
      }}
      mergeStyle
      onLinkPress={(url) => {
        Linking.openURL(url);
        return true;
      }}
    >
      {props.content}
    </MarkdownDisplay>
  );
});

export default Markdown;

