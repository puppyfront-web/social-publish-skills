# runtime requirements (wechatmp article)

- Node.js >= 20
- Playwright Chromium installed (`npx playwright install chromium`)
- Execute commands in repository root (`social-publish-skills`)
- For QR login, run on user's local machine with visible browser

Environment variables:

- `SOCIAL_PUBLISH_DATA_DIR`: override persistent data root
- `SOCIAL_PUBLISH_HEADLESS=0`: run headed browser for debugging (recommended for first run)
- `SOCIAL_PUBLISH_CHROME_PATH`: optional Chrome executable path
- `SOCIAL_PUBLISH_LOGIN_STDIN=1`: finish login by pressing Enter in terminal
