# troubleshooting (wechatmp article)

## Cannot find editor after login

- Re-run with `SOCIAL_PUBLISH_HEADLESS=0`
- Confirm current account has publishing permission
- Manually verify the account can open "new article" page in browser

## Markdown/GitHub URL fetch failed

- Check network reachability
- For GitHub URL, prefer `blob/.../*.md` or repo root URL
- For local markdown, ensure source path is absolute

## Content appears without style

- WeChat editor may normalize some styles
- Keep structure semantic (`h1/h2`, `blockquote`, `pre`, `table`)
- Prefer simple HTML and inline styles over complex CSS

## Publish button not found

- UI labels can vary by account type
- First run should use `SOCIAL_PUBLISH_HEADLESS=0` and inspect visible button text
- Keep default draft flow if publish CTA is not stable
