import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('test/fixtures');
const fixtures = {
  home: ['id="main-container"', 'id="sidebar-wrapper"', 'data-testid="kicks-top-nav"', 'livestream-results-card', 'channel-chatroom'],
  browse: ['id="main-container"', 'id="sidebar-wrapper"', 'livestream-results-card', 'Resize chatroom', '/category/slots'],
  category: ['id="main-container"', 'id="sidebar-wrapper"', 'livestream-results-card', 'category/just-chatting'],
  search: ['id="main-container"', 'id="sidebar-wrapper"', 'data-testid="search"', 'search-results'],
  channel: ['id="main-container"', 'id="sidebar-wrapper"', 'data-testid="channel-player"', 'channel-chatroom', 'aria-valuemin'],
  chat: ['id="main-container"', 'id="sidebar-wrapper"', 'chat-resizer', 'data-testid="chatroom"', 'chatroom-messages', 'fixture=/emotes/7001', 'add-chat-sticker'],
  drops: ['data-testid="sidebar-drops"', 'Drops &amp; rewards', 'data-testid="empty-state-root"', '/drops/coming-soon'],
  'sticker-scroll': ['chat-emotes-picker-panel', 'data-testid="sticker-scroll"', 'data-testid="native-sticker-shell"', 'data-testid="native-sticker-list"', 'dataset.emoteId', 'overflow-y-auto'],
};

for (const [name, markers] of Object.entries(fixtures)) {
  test(`fixture ${name} retains the current Kick shell contract`, () => {
    const html = readFileSync(resolve(root, `${name}.html`), 'utf8');
    for (const marker of markers) assert.ok(html.includes(marker), `${name} fixture lost ${marker}`);
  });
}
