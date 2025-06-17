const {
  withAndroidManifest,
  withAppBuildGradle,
} = require("@expo/config-plugins");

module.exports = function withCustomAndroidConfiguration(config) {
  // 以前のマニフェスト修正
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    if (manifest.application && manifest.application.length > 0) {
      const mainApplication = manifest.application[0];
      mainApplication.$ = mainApplication.$ || {};
      mainApplication.$["android:appComponentFactory"] =
        "androidx.core.app.CoreComponentFactory";
      mainApplication.$["tools:replace"] = "android:appComponentFactory";
    }
    return config;
  });

  // ★【新規追加】古いSupport Libraryを強制的に除外する設定
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      config.modResults.contents = addResolutionStrategy(
        config.modResults.contents
      );
    } else {
      throw new Error(
        "Cannot add resolutionStrategy to build.gradle because it's not groovy"
      );
    }
    return config;
  });

  return config;
};

function addResolutionStrategy(gradleFile) {
  const strategy = `
allprojects {
    configurations.all {
        resolutionStrategy {
            // com.android.supportライブラリの全てのバージョンを強制的に除外
            exclude group: "com.android.support"
        }
    }
}
`;
  // 既に同じ設定がない場合のみ追記する
  if (!gradleFile.includes("resolutionStrategy")) {
    return strategy + gradleFile;
  }
  return gradleFile;
}
