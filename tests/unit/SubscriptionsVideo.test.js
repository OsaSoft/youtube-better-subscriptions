/**
 * Tests for videos/SubscriptionsVideo.js
 * Button placement on real feed markup is covered in tests/integration/real-dom.test.js and
 * subs-observer.test.js; these check the class on minimal cards.
 */

const { loadUtil, loadSubscriptionsVideo } = require('../helpers/load-source');

describe('SubscriptionsVideo.js', () => {
    describe('SubscriptionVideo class', () => {
        let SubscriptionVideo;

        function load(settingsOverrides = {}) {
            Object.assign(settings, settingsOverrides);
            loadSubscriptionsVideo();
            SubscriptionVideo = global.SubscriptionVideo;
        }

        beforeEach(() => {
            loadUtil();
            global.watchedVideos = {};
            global.buildMarkWatchedButton = jest.fn(() => {
                const button = document.createElement('div');
                button.id = MARK_WATCHED_BTN;
                return button;
            });
        });

        // January 2026 lockup card; the ⋮ is optional because YouTube builds it last
        function lockupCard({ menu = true } = {}) {
            document.body.innerHTML = `
                <ytd-rich-item-renderer>
                    <yt-lockup-view-model>
                        <div class="ytLockupViewModelVertical">
                            <a href="/watch?v=abc12345678">Title</a>
                            ${menu ? '<div class="ytLockupMetadataViewModelMenuButton"><button></button></div>' : ''}
                        </div>
                    </yt-lockup-view-model>
                </ytd-rich-item-renderer>
            `;
            return document.querySelector('ytd-rich-item-renderer');
        }

        test('finds the lockup as its content and fades the whole lockup', () => {
            load();
            const video = new SubscriptionVideo(lockupCard());

            expect(video.videoId).toBe('abc12345678');
            expect(video.contentDiv.tagName).toBe('YT-LOCKUP-VIEW-MODEL');
            expect(video.getFadeTarget()).toBe(video.contentDiv);
        });

        test('compact: the button goes under the ⋮, and hasButton then sees it', () => {
            load({ "settings.mark.watched.button.compact": true });
            const video = new SubscriptionVideo(lockupCard());

            expect(video.hasButton()).toBe(false);
            video.addButton();

            const container = document.querySelector('.subs-btn-container');
            expect(container.classList.contains('subs-btn-container--compact')).toBe(true);
            expect(container.closest('.ytLockupMetadataViewModelMenuButton')).not.toBeNull();
            expect(video.hasButton()).toBe(true);
        });

        test('compact without the ⋮ yet: awaits it', () => {
            load({ "settings.mark.watched.button.compact": true });
            const video = new SubscriptionVideo(lockupCard({ menu: false }));

            expect(video.awaitsMenuButton()).toBe(true);
        });

        test('not compact: the button goes below the lockup', () => {
            load({ "settings.mark.watched.button.compact": false });
            const video = new SubscriptionVideo(lockupCard());

            video.addButton();

            const container = document.querySelector('.subs-btn-container');
            expect(container.classList.contains('subs-btn-container--bottom')).toBe(true);
            expect(container.previousElementSibling.classList.contains('ytLockupViewModelVertical')).toBe(true);
            expect(video.awaitsMenuButton()).toBe(false);
        });

        test('no button when the mark watched button is turned off', () => {
            load({ "settings.hide.mark.watched.button": true });
            const video = new SubscriptionVideo(lockupCard());

            video.addButton();

            expect(document.querySelector('.subs-btn-container')).toBeNull();
            expect(video.awaitsMenuButton()).toBe(false);
        });
    });
});
