# Security

This document describes the security model of YouTube Better Subscriptions and provides instructions for verifying extension integrity and manual installation.

## Security Model

### Minimal Permissions

This extension requests only the permissions it needs:

- **storage**: To save your watched videos list and settings (synced across browsers via your browser account)
- **Host permissions**: Limited to YouTube domains (`*://*.youtube.com/*`) only

The extension cannot:
- Access your browsing history on other sites
- Read or modify data on non-YouTube websites
- Access your YouTube account credentials
- Make network requests to third-party servers

### Transparency

- **No build system**: The extension is vanilla JavaScript with no compilation, bundling, or minification. What you see in the repository is exactly what runs in your browser.
- **Open source**: All code is publicly available for review on GitHub.
- **No external dependencies**: The extension doesn't load any external scripts or resources.

## Verifying Extension Integrity

Each release includes a `SHA256SUMS.txt` file containing the checksum of the extension ZIP file. You can verify that your download matches the official release.

### On Linux/macOS

```bash
# Download both files from the release
wget https://github.com/nickyout/youtube-better-subscriptions/releases/download/vX.X.X/yt-better-subscriptions-X.X.X.zip
wget https://github.com/nickyout/youtube-better-subscriptions/releases/download/vX.X.X/SHA256SUMS.txt

# Verify the checksum
sha256sum -c SHA256SUMS.txt
```

### On Windows (PowerShell)

```powershell
# After downloading both files
$hash = (Get-FileHash yt-better-subscriptions-X.X.X.zip -Algorithm SHA256).Hash.ToLower()
$expected = (Get-Content SHA256SUMS.txt).Split(" ")[0]
if ($hash -eq $expected) { "OK" } else { "MISMATCH" }
```

## Manual Installation

If you prefer not to use browser extension stores, you can install directly from GitHub.

### Chrome (Unpacked Extension)

1. Download the latest release ZIP from [GitHub Releases](https://github.com/nickyout/youtube-better-subscriptions/releases)
2. Extract the ZIP to a permanent location (don't delete this folder)
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top-right corner)
5. Click **Load unpacked**
6. Select the extracted folder containing `manifest.json`

**Note**: Chrome will show a warning about developer mode extensions. The extension will persist across browser restarts but you'll need to manually update by downloading new releases.

### Firefox (Temporary Add-on)

Firefox only allows unsigned extensions as temporary add-ons (they don't persist across browser restarts).

1. Download the latest release ZIP from [GitHub Releases](https://github.com/nickyout/youtube-better-subscriptions/releases)
2. Extract the ZIP file
3. Open Firefox and go to `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on...**
5. Select the `manifest.json` file from the extracted folder

**Note**: The extension will be removed when Firefox closes. For persistent installation, use the official [Firefox Add-ons](https://addons.mozilla.org/) version.

### Firefox (Persistent - Developer/Nightly only)

In Firefox Developer Edition or Nightly, you can disable signature enforcement:

1. Go to `about:config`
2. Set `xpinstall.signatures.required` to `false`
3. Install the XPI file directly

**Warning**: This reduces browser security. Only do this if you understand the risks.

## Comparing Store Extension with GitHub Release

If you want to verify that the store version matches the GitHub release:

### Chrome

1. Find your Chrome profile folder:
   - Windows: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions`
   - macOS: `~/Library/Application Support/Google/Chrome/Default/Extensions`
   - Linux: `~/.config/google-chrome/Default/Extensions`

2. Locate the extension folder (named by extension ID)

3. Compare with the GitHub release:
   ```bash
   diff -r /path/to/chrome/extension /path/to/github/release
   ```

### Firefox

1. Firefox extensions (XPI files) are ZIP archives
2. The extension location varies by OS:
   - Windows: `%APPDATA%\Mozilla\Firefox\Profiles\<profile>\extensions`
   - macOS: `~/Library/Application Support/Firefox/Profiles/<profile>/extensions`
   - Linux: `~/.mozilla/firefox/<profile>/extensions`

3. Extract and compare:
   ```bash
   unzip extension.xpi -d extracted
   diff -r extracted /path/to/github/release
   ```

## Reporting Security Issues

If you discover a security vulnerability, please report it by:

1. **GitHub Issues**: Open an issue at https://github.com/nickyout/youtube-better-subscriptions/issues
2. **Private disclosure**: If the issue is sensitive, please note that in the issue title and avoid including exploit details publicly
