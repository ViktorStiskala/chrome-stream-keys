# =============================================================================
# Configuration - App metadata, paths, and signing identities
# =============================================================================

# App metadata
APP_NAME="Stream Keys"
BUNDLE_ID="com.getstreamkeys.StreamKeys"

# Apple Developer identities
DEVELOPER_NAME="Viktor Stískala"
TEAM_ID_SUFFIX="D8Z6CRA2WJ"
DEVELOPER_ID_APP="Developer ID Application: $DEVELOPER_NAME ($TEAM_ID_SUFFIX)"
APPLE_DISTRIBUTION="Apple Distribution: $DEVELOPER_NAME ($TEAM_ID_SUFFIX)"
INSTALLER_CERT="3rd Party Mac Developer Installer: $DEVELOPER_NAME ($TEAM_ID_SUFFIX)"

# Build paths (relative to PROJECT_ROOT)
BUILD_DIR="build/production/safari"
XCODE_DIR="$BUILD_DIR/xcode"
APP_PATH="$XCODE_DIR/DerivedData/Build/Products/Release/$APP_NAME.app"
EXTENSION_PATH="$APP_PATH/Contents/PlugIns/$APP_NAME Extension.appex"
