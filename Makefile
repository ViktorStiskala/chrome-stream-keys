.PHONY: build build-chrome build-firefox clean logos

BUILD_DIR = build
ICON_SOURCE = assets/icon.png
LOGO_SIZES = 16 32 48 128
LOGO_FILES = $(addprefix logo/StreamKeys_,$(addsuffix .png,$(LOGO_SIZES)))

# Source files to include (paths relative to src/)
SRC_FILES = \
	background.js \
	handlers/base.js \
	handlers/disney.js \
	handlers/hbomax.js \
	settings/settings.html \
	settings/settings.js \
	settings/settings.css

# Generate logo files from source icon
logo/StreamKeys_%.png: $(ICON_SOURCE)
	@mkdir -p logo
	@magick $(ICON_SOURCE) -filter Lanczos -resize $*x$* $@
	@echo "Generated $@"

logos: $(LOGO_FILES)

# Build Chrome extension
build-chrome: $(LOGO_FILES)
	@rm -rf $(BUILD_DIR)/chrome
	@mkdir -p $(BUILD_DIR)/chrome/extension
	@# Copy source files preserving directory structure
	@for file in $(SRC_FILES); do \
		mkdir -p $(BUILD_DIR)/chrome/extension/$$(dirname $$file); \
		cp src/$$file $(BUILD_DIR)/chrome/extension/$$file; \
	done
	@# Copy manifest
	@cp manifests/chrome.json $(BUILD_DIR)/chrome/extension/manifest.json
	@# Copy logos
	@mkdir -p $(BUILD_DIR)/chrome/extension/logo
	@cp logo/StreamKeys_*.png $(BUILD_DIR)/chrome/extension/logo/
	@# Create zip
	@cd $(BUILD_DIR)/chrome/extension && zip -r ../stream-keys-chrome.zip .
	@echo "Created $(BUILD_DIR)/chrome/stream-keys-chrome.zip"

# Build Firefox extension
build-firefox: $(LOGO_FILES)
	@rm -rf $(BUILD_DIR)/firefox
	@mkdir -p $(BUILD_DIR)/firefox/extension
	@# Copy source files preserving directory structure
	@for file in $(SRC_FILES); do \
		mkdir -p $(BUILD_DIR)/firefox/extension/$$(dirname $$file); \
		cp src/$$file $(BUILD_DIR)/firefox/extension/$$file; \
	done
	@# Copy manifest
	@cp manifests/firefox.json $(BUILD_DIR)/firefox/extension/manifest.json
	@# Copy logos
	@mkdir -p $(BUILD_DIR)/firefox/extension/logo
	@cp logo/StreamKeys_*.png $(BUILD_DIR)/firefox/extension/logo/
	@# Create zip
	@cd $(BUILD_DIR)/firefox/extension && zip -r ../stream-keys-firefox.zip .
	@echo "Created $(BUILD_DIR)/firefox/stream-keys-firefox.zip"

# Build both extensions
build: clean $(LOGO_FILES)
	@$(MAKE) build-chrome
	@$(MAKE) build-firefox

clean:
	@rm -rf $(BUILD_DIR)
