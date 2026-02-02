/**
 * Tests for queries.js
 * CSS selectors for YouTube DOM elements
 */

const fs = require('fs');
const path = require('path');
const { loadQueries } = require('../helpers/load-source');

describe('queries.js', () => {
    beforeEach(() => {
        loadQueries();
    });

    describe('vidQuery', () => {
        test('returns comma-separated CSS selectors', () => {
            const query = vidQuery();

            expect(typeof query).toBe('string');
            expect(query).toContain(',');
        });

        test('includes old layout grid video selector', () => {
            const query = vidQuery();

            expect(query).toContain('ytd-grid-video-renderer.style-scope.ytd-grid-renderer');
        });

        test('includes rich grid renderer selector', () => {
            const query = vidQuery();

            expect(query).toContain('ytd-rich-item-renderer.style-scope.ytd-rich-grid-renderer');
        });

        test('includes rich grid row selector', () => {
            const query = vidQuery();

            expect(query).toContain('ytd-rich-item-renderer.style-scope.ytd-rich-grid-row');
        });

        test('includes rich shelf renderer selector (for shorts)', () => {
            const query = vidQuery();

            expect(query).toContain('ytd-rich-item-renderer.style-scope.ytd-rich-shelf-renderer');
        });

        test('includes section list renderer selector', () => {
            const query = vidQuery();

            expect(query).toContain('ytd-item-section-renderer.style-scope.ytd-section-list-renderer');
        });

        test('includes new lockupViewModel layout selector', () => {
            const query = vidQuery();

            expect(query).toContain('ytd-rich-item-renderer:has(lockup-view-model)');
        });

        test('excludes elements with HIDDEN_CLASS', () => {
            const query = vidQuery();

            expect(query).toContain(`:not(.${HIDDEN_CLASS})`);
        });

        test('excludes post items from shelf renderer', () => {
            const query = vidQuery();

            expect(query).toContain(':not([is-post])');
        });

        test('selects visible videos from fixture HTML', () => {
            const fixtureHtml = fs.readFileSync(
                path.join(__dirname, '../fixtures/subscription-feed.html'),
                'utf8'
            );
            document.body.innerHTML = fixtureHtml;

            const videos = document.querySelectorAll(vidQuery());

            expect(videos.length).toBeGreaterThan(0);
        });

        test('does not select hidden videos', () => {
            document.body.innerHTML = `
                <ytd-rich-item-renderer class="style-scope ytd-rich-grid-renderer ${HIDDEN_CLASS}">
                    <a id="video-title" href="/watch?v=hidden11111">Hidden Video</a>
                </ytd-rich-item-renderer>
                <ytd-rich-item-renderer class="style-scope ytd-rich-grid-renderer">
                    <a id="video-title" href="/watch?v=visible1111">Visible Video</a>
                </ytd-rich-item-renderer>
            `;

            const videos = document.querySelectorAll(vidQuery());

            expect(videos.length).toBe(1);
            expect(videos[0].querySelector('a').getAttribute('href')).toContain('visible1111');
        });
    });

    describe('sectionsQuery', () => {
        test('returns section list renderer selector', () => {
            const query = sectionsQuery();

            expect(query).toBe('ytd-item-section-renderer.style-scope.ytd-section-list-renderer');
        });

        test('selects sections from fixture HTML', () => {
            const fixtureHtml = fs.readFileSync(
                path.join(__dirname, '../fixtures/subscription-feed.html'),
                'utf8'
            );
            document.body.innerHTML = fixtureHtml;

            const sections = document.querySelectorAll(sectionsQuery());

            expect(sections.length).toBeGreaterThan(0);
        });
    });

    describe('sectionTitleQuery', () => {
        test('returns title ID selector', () => {
            const query = sectionTitleQuery();

            expect(query).toBe('#title');
        });

        test('finds title within section', () => {
            document.body.innerHTML = `
                <ytd-item-section-renderer class="style-scope ytd-section-list-renderer">
                    <div id="title">Today</div>
                    <div id="contents"></div>
                </ytd-item-section-renderer>
            `;

            const section = document.querySelector(sectionsQuery());
            const title = section.querySelector(sectionTitleQuery());

            expect(title).not.toBeNull();
            expect(title.textContent).toBe('Today');
        });
    });

    describe('sectionDismissableQuery', () => {
        test('returns dismissible ID selector', () => {
            const query = sectionDismissableQuery();

            expect(query).toBe('#dismissible');
        });

        test('finds dismissible within section', () => {
            document.body.innerHTML = `
                <ytd-item-section-renderer class="style-scope ytd-section-list-renderer">
                    <div id="title">Today</div>
                    <div id="dismissible">
                        <div id="contents"></div>
                    </div>
                </ytd-item-section-renderer>
            `;

            const section = document.querySelector(sectionsQuery());
            const dismissible = section.querySelector(sectionDismissableQuery());

            expect(dismissible).not.toBeNull();
        });
    });

    describe('sectionContentsQuery', () => {
        test('returns contents ID selector', () => {
            const query = sectionContentsQuery();

            expect(query).toBe('#contents');
        });

        test('finds contents within section', () => {
            document.body.innerHTML = `
                <ytd-item-section-renderer class="style-scope ytd-section-list-renderer">
                    <div id="title">Today</div>
                    <div id="dismissible">
                        <div id="contents">
                            <ytd-rich-item-renderer></ytd-rich-item-renderer>
                        </div>
                    </div>
                </ytd-item-section-renderer>
            `;

            const section = document.querySelector(sectionsQuery());
            const contents = section.querySelector(sectionContentsQuery());

            expect(contents).not.toBeNull();
            expect(contents.children.length).toBe(1);
        });
    });

    describe('query integration', () => {
        test('can navigate from section to videos', () => {
            const fixtureHtml = fs.readFileSync(
                path.join(__dirname, '../fixtures/subscription-feed.html'),
                'utf8'
            );
            document.body.innerHTML = fixtureHtml;

            const sections = document.querySelectorAll(sectionsQuery());

            for (const section of sections) {
                const title = section.querySelector(sectionTitleQuery());
                const dismissible = section.querySelector(sectionDismissableQuery());
                const contents = section.querySelector(sectionContentsQuery());

                expect(title).not.toBeNull();
                expect(dismissible).not.toBeNull();
                expect(contents).not.toBeNull();
            }
        });
    });
});
