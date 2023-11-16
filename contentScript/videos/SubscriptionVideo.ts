import {buildMarkWatchedButton} from '../ui';

import {BaseVideo} from './Video';

export class Video extends BaseVideo {
    contentDiv: HTMLElement;

    constructor(containingDiv: HTMLElement) {
        super(containingDiv);
        this.contentDiv = this.containingDiv.querySelector('.ytd-rich-item-renderer');
    }

    hasButton() {
        return !!this.contentDiv.querySelector('#' + this.buttonId);
    }

    addButton() {
        const buttonContainer = this.contentDiv.firstChild as HTMLElement;
        // stored = false - build "Mark as watched"
        // stored = true  - build "Mark as unwatched"
        const markButton = buildMarkWatchedButton(buttonContainer, this.containingDiv, this.videoId, !this.isStored);
        buttonContainer.append(markButton);
    }
}
