import {logError} from '../util';

import {getCurrentPage, log, watchVideo} from './common';
import {vidQuery} from './queries';
import {getSettings} from './settings';
import {destroyUI, initUI} from './ui';

const PAGES = Object.freeze({
    'subscriptions': '/feed/subscriptions',
    'video': '/watch',
    'short': '/shorts',
    'channel': '/videos',
    'channelLive': '/streams',
    'home': '',
});

function handlePageChange() {
    const page = getCurrentPage();

    log(`Page was changed to ${page}`);

    //unload old page
    destroyUI();

    //handle new page
    try {
        if (page === PAGES.subscriptions) {
            initUI();
        }
        else if (page === PAGES.video) {
            if (getSettings()['settings.hide.watched.auto.store']) {
                const videoId = new URL(window.location.href).searchParams.get('v');

                log(`Marking video ${videoId} as watched from video page`);
                watchVideo(videoId);
            }
        }
        else if (page === PAGES.home) {
            if (getSettings()['settings.hide.watched.support.home']) {
                initUI();
            }
        }
        else if (page.includes(PAGES.short)) {
            if (getSettings()['settings.hide.watched.auto.store']) {
                const videoId = page.split('/')[2];

                log(`Marking short ${videoId} as watched from shorts page`);
                watchVideo(videoId);
            }
        }
        else if (
            (
                page.includes(PAGES.channel)
                || page.includes(PAGES.channelLive)
            )
            && getSettings()['settings.hide.watched.support.channel']
        ) {
            initUI();
        }
    }
    catch (error) {
        logError(error);
    }
}

let extensionStarted = false;
export async function startExtension() {
    if (extensionStarted) {
        return;
    }
    extensionStarted = true;

    let startPageHandled = false;

    function initPageHandler() {
        const pageLoader = document.querySelector('yt-page-navigation-progress');

        //if the page loader element isnt ready, wait for it
        if (!pageLoader) {
            window.requestAnimationFrame(initPageHandler);
            return;
        }

        log('Found page loader');

        const pageChangeObserver = new MutationObserver((mutations) => {
            for (const mutationRecord of mutations) {
                //is page fully loaded?
                if (mutationRecord.target.attributes['aria-valuenow'].value === '100') {
                    handlePageChange();
                }
            }
        });

        //observe when the page loader becomes visible or hidden
        pageChangeObserver.observe(pageLoader, {attributes: true, attributeFilter: ['hidden']});

        if (!startPageHandled) {
            log('Initializing...');

            startPageHandled = true;
            handlePageChange();
        }
    }

    initPageHandler();

    while (!startPageHandled) {
        await new Promise(resolve => setTimeout(resolve, 500));

        if (document.querySelectorAll<HTMLElement>(vidQuery()).length > 0) {
            log('Initializing...');

            startPageHandled = true;
            handlePageChange();
        }
    }
}
