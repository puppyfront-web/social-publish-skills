# workflow contract (wechatmp article)

## Login lifecycle

1. `wechatmp check --account <name>`
2. If invalid or missing cookie, run `wechatmp login --account <name>`
3. Re-run `check` to verify state

## Publish lifecycle

1. Resolve source content from one of:
   - Absolute local markdown file
   - GitHub URL
   - Generic web URL
2. Convert to Markdown and format into WeChat-friendly HTML
3. Open WeChat article editor
4. Fill title/author/digest/content
5. Save draft by default, or publish when `--publish` is passed

## Safety defaults

- Default action is save draft
- Direct publish requires explicit `--publish`
- Never hardcode or bypass cookie logic
