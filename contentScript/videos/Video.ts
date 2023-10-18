import {isVideoIdWatched, log, unwatchVideo, watchVideo} from '../common';
import {MARK_UNWATCHED_BTN, MARK_WATCHED_BTN, changeMarkWatchedToMarkUnwatched, hideElement} from '../ui';

function getVideoIdFromUrl(url: string) {
    if (typeof url !== 'string') {
        return;
    }

    if (url.includes('shorts')) {
        return url.split('shorts/')[1].split('&')[0];
    }
    else {
        return url.split('=')[1].split('&')[0];
    }
}

function getVideoId(item: HTMLElement) {
    return getVideoIdFromUrl(item.querySelectorAll('a')[0].getAttribute('href'));
}

export class BaseVideo {
    containingDiv: HTMLElement;

    videoId: string;
    buttonId: string;
    isStored: boolean;

    isShort: boolean;
    isPremiere: boolean;

    constructor(containingDiv: HTMLElement) {
        this.containingDiv = containingDiv;
        this.videoId = getVideoId(containingDiv);
        this.isStored = isVideoIdWatched(this.videoId);
        this.buttonId = this.isStored ? MARK_UNWATCHED_BTN : MARK_WATCHED_BTN;

        log(`Checking video ${this.videoId} for premiere`);
        const thumbOverlay = containingDiv.querySelector('ytd-thumbnail-overlay-time-status-renderer');
        if (!thumbOverlay) {
            this.isPremiere = false;
        }
        else {
            this.isPremiere = thumbOverlay.getAttribute('overlay-style') === 'UPCOMING';
        }

        log(`Checking video ${this.videoId} for short`);
        const videoHref = containingDiv.querySelectorAll('a')[0].getAttribute('href');
        if (!videoHref) {
            this.isShort = (videoHref.includes('shorts') || videoHref.includes('adurl'));
        }
        else {
            log('Video URL is null - ad.');
            this.isShort = true;
        }
    }

    hasButton() {
        throw new Error('Subclasses must implement hasButton method');
    }

    addButton() {
        throw new Error('Subclasses must implement addButton method');
    }

    hide() {
        hideElement(this.containingDiv);
    }

    markWatched() {
        changeMarkWatchedToMarkUnwatched(this.containingDiv, this.videoId);

        this.hide();
        this.isStored = true;

        watchVideo(this.videoId);
    }

    markUnwatched() {
        unwatchVideo(this.videoId);
    }
}
