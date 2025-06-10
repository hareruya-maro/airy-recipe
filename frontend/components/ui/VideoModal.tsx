import React, { useCallback, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Button, Modal } from "react-native-paper";
import YoutubeIframe from "react-native-youtube-iframe";

type VideoModalProps = {
  visible: boolean;
  onClose: () => void;
  videoUrl: string | null;
};

/**
 * YouTube動画を表示するモーダルコンポーネント
 */
export const VideoModal: React.FC<VideoModalProps> = ({
  visible,
  onClose,
  videoUrl,
}) => {
  // 動画再生状態
  const [playing, setPlaying] = useState(false);

  // YouTubeプレーヤーのイベントハンドラー
  const onStateChange = useCallback((state: string) => {
    if (state === "ended") {
      setPlaying(false);
    }
  }, []);

  // YouTubeの動画IDを抽出する関数
  const extractYouTubeID = (url: string | null): string | undefined => {
    if (!url) return undefined;

    // YouTubeのURL形式に一致する正規表現パターン
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^/?]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^/?]+)/,
    ];

    // 各パターンでマッチするか確認
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // マッチしない場合はそのまま返す（既にIDのみの可能性）
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }

    return undefined;
  };

  // モーダルを閉じるときは再生も停止する
  const handleClose = () => {
    setPlaying(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onDismiss={handleClose}
      contentContainerStyle={styles.videoModalContainer}
    >
      <View style={styles.videoModalContent}>
        <Text style={styles.videoModalTitle}>料理手順の解説動画</Text>

        <View style={styles.videoPlayerContainer}>
          {videoUrl && extractYouTubeID(videoUrl) && (
            <YoutubeIframe
              height={(Dimensions.get("window").width - 32) * (9 / 16)}
              width={Dimensions.get("window").width - 32}
              videoId={extractYouTubeID(videoUrl) || ""}
              play={playing}
              onChangeState={onStateChange}
              initialPlayerParams={{
                controls: true,
                cc_lang_pref: "ja",
                modestbranding: true,
                preventFullScreen: false,
              }}
            />
          )}
        </View>

        <Button
          mode="contained"
          onPress={handleClose}
          style={styles.videoModalCloseButton}
        >
          閉じる
        </Button>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // 動画モーダル用スタイル
  videoModalContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  videoModalContent: {
    width: "100%",
    backgroundColor: "#121212",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  videoModalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  videoPlayerContainer: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  videoModalCloseButton: {
    width: "100%",
    borderRadius: 30,
  },
});
