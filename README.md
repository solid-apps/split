# split

Embed your pod apps (or any URL) **side by side in resizable panes**. Optional
(install from the store), not a default app.

- Starts with **two panes**, but it's an **array** — "+ Pane", remove, and the
  draggable dividers all work for **any N**.
- Each pane takes an **app name** (autocompletes from your installed apps) or a
  **URL**.
- **Draggable dividers** to resize; **stacks vertically on mobile**.
- The layout (which app/URL per pane + sizes) is saved privately to your pod, so
  it reopens the same.

## Note on iframes

`split` embeds each pane in an `<iframe>`. **Your own pod apps embed cleanly**
(same origin). Many *external* sites refuse to be framed (`X-Frame-Options` /
CSP `frame-ancestors`) — that's their choice, not a bug here. So split shines
for composing your apps: `contacts | messages`, `explorer | vellum`, a video +
notes.

## License

AGPL-3.0-only.
